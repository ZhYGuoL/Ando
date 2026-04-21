import { create } from 'zustand'
import type { PermissionCardState } from '../components/permission/PermissionCard'
import type { CompletionCardState } from '../components/completion/CompletionCard'
import {
  PAPER_FRAME_SETTINGS_DEFERRED,
  PAPER_MCP_SERVER_LABEL,
  paperMcpTools,
} from '../mcp/paperMcp'

export type FeedMessageType = 'human' | 'agent' | 'system'

export type FeedPermissionPayload = {
  actionTitle: string
  resource: string
  description: string
  policyAgentName: string
  policyPathGlob: string
}

export type FeedCompletionPayload = {
  state: CompletionCardState
  taskName: string
  stats: {
    durationLabel: string
    files: string
    subprocesses: string
    errors: string
    approvals: string
  }
}

export type FeedSubprocessPayload = {
  routeId: string
  name: string
  subtitle: string
  progressPct: number
  /** Design track: transcript uses MCP-shaped steps; transport stub in `src/mcp/paperMcp.ts`. */
  integration?: 'paper-mcp'
}

export type FeedMessage = {
  id: string
  channelId: string
  type: FeedMessageType
  authorId: string
  authorName: string
  timestamp: string
  timestampDateTime: string
  /** Primary body for humans; agents may use `paragraphs` instead. */
  text?: string
  paragraphs?: string[]
  permissionCard?: FeedPermissionPayload
  completionCard?: FeedCompletionPayload
  subprocess?: FeedSubprocessPayload
  /** Multiple workers under one agent turn (coding + design, etc.). */
  subprocesses?: FeedSubprocessPayload[]
  continuingLine?: boolean
}

/** Sub-process rows for feed rendering — prefers `subprocesses`, falls back to legacy `subprocess`. */
export function feedMessageSubprocesses(msg: FeedMessage): FeedSubprocessPayload[] {
  if (msg.subprocesses && msg.subprocesses.length > 0) return msg.subprocesses
  if (msg.subprocess) return [msg.subprocess]
  return []
}

export type SidebarAgentStatus = 'running' | 'idle' | 'blocked'

export type StoreSubprocessStatus = 'running' | 'completed' | 'killed' | 'failed'

export type StoreSubprocessLogStep = {
  type: 'read' | 'write' | 'analyze' | 'spawn' | 'mcp'
  description: string
  timestamp: string
}

export type StoreSubProcess = {
  id: string
  name: string
  type: string
  status: StoreSubprocessStatus
  startedAt: string
  elapsedMs: number
  progress: number
  parentAgentId: string
   log?: StoreSubprocessLogStep[]
  /** Demo: index into `log` for the active milestone (-1 = not started). Bar % moves only when this advances. */
  demoPlanStep?: number
  /** Wall-clock ms of last milestone advance; used with variable gaps between steps. */
  demoLastAdvanceWallMs?: number
  partialResult?: string
  integration?: 'paper-mcp'
}

export type StoreCompletedTask = {
  id: string
  description: string
  startedAt: string
  completedAt: string
  outcome: 'completed' | 'killed' | 'failed'
  filesChanged: string
  subProcessCount: number
  approvalsNeeded: number
}

export type StoreAgent = {
  id: string
  name: string
  role: string
  /** Channel key without `#` — e.g. `frontend`, `infra` */
  channel: string
  status: SidebarAgentStatus
  currentTask: {
    description: string
    startedAt: string
    subProcessCount: number
  }
  taskSummary: string
  identitySummary: string
  avatarClassName: string
  subProcesses: StoreSubProcess[]
  taskHistory: StoreCompletedTask[]
  memory: {
    recentDecisions: string[]
    openThreads: string[]
    constraints: string[]
  }
}

export type CockpitTaskHistoryRow = {
  key: string
  name: string
  duration: string
  outcome: 'completed' | 'killed' | 'failed'
  filesChanged: string
}

export const FRONTEND_PERMISSION_MESSAGE_ID = 'msg-f-004'
export const BACKEND_PERMISSION_MESSAGE_ID = 'msg-i-003'
export const FRONTEND_COMPLETION_MESSAGE_ID = 'msg-f-completion'

/** Composer identity for interactive demo (matches sidebar “Zhiyuan”). */
export const DEMO_HUMAN_AUTHOR = { id: 'zhiyuan', name: 'Zhiyuan' } as const

const FRONTEND_AGENT_ACK_MESSAGE_ID = 'msg-f-003'

const REVIEW_DELAY_MS = 800

function formatFeedClockFromIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--:--'
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function isoPlusMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString()
}

export function formatStoreElapsedMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function formatDurationBetween(isoStart: string, isoEnd: string): string {
  const a = new Date(isoStart).getTime()
  const b = new Date(isoEnd).getTime()
  return formatStoreElapsedMs(b - a)
}

export function formatRunningLabel(taskStartedAtIso: string): string {
  const start = new Date(taskStartedAtIso).getTime()
  return formatStoreElapsedMs(Date.now() - start)
}

export type CockpitTaskHistoryState = Pick<NaveStore, 'messages' | 'agents'>

export function selectCockpitTaskHistoryMerged(
  state: CockpitTaskHistoryState,
  agentId: string,
): CockpitTaskHistoryRow[] {
  const agent = state.agents[agentId]
  if (!agent) return []

  const fromStore = [...agent.taskHistory]
    .sort((x, y) => new Date(y.completedAt).getTime() - new Date(x.completedAt).getTime())
    .map((t) => ({
      key: t.id,
      name: t.description,
      duration: formatDurationBetween(t.startedAt, t.completedAt),
      outcome: t.outcome,
      filesChanged: /\d+\s*files?/i.test(t.filesChanged) ? t.filesChanged : `${t.filesChanged} files`,
    }))

  const completionMsg = [...state.messages]
    .filter((m) => m.authorId === agentId && m.completionCard?.state === 'completed')
    .sort(
      (a, b) =>
        new Date(b.timestampDateTime).getTime() - new Date(a.timestampDateTime).getTime(),
    )[0]

  if (!completionMsg?.completionCard) return fromStore

  const c = completionMsg.completionCard
  const durationFromCard = c.stats.durationLabel.replace(/^\s*Completed\s*·\s*/i, '').trim()
  const feedRow: CockpitTaskHistoryRow = {
    key: `feed-${completionMsg.id}`,
    name: c.taskName,
    duration: durationFromCard || c.stats.durationLabel,
    outcome: 'completed',
    filesChanged: `${c.stats.files} files`,
  }

  if (
    fromStore[0] &&
    fromStore[0].name.trim().toLowerCase() === feedRow.name.trim().toLowerCase()
  ) {
    return [feedRow, ...fromStore.slice(1)]
  }

  return [feedRow, ...fromStore]
}

export type CockpitMemoryView = {
  recentDecisions: string[]
  openThreads: string[]
  constraints: string[]
}

export type CockpitMemoryState = Pick<NaveStore, 'messages' | 'agents' | 'permissionCardStates'>

export function selectCockpitMemoryMerged(state: CockpitMemoryState, agentId: string): CockpitMemoryView {
  const agent = state.agents[agentId]
  if (!agent) return { recentDecisions: [], openThreads: [], constraints: [] }

  const policyConstraints = state.messages
    .filter(
      (m) =>
        m.permissionCard &&
        state.permissionCardStates[m.id] === 'always-allowed-resolved',
    )
    .map(
      (m) =>
        `Always allow ${m.permissionCard!.policyPathGlob}: ${m.permissionCard!.actionTitle}`,
    )

  return {
    recentDecisions: agent.memory.recentDecisions,
    openThreads: agent.memory.openThreads,
    constraints: [...agent.memory.constraints, ...policyConstraints],
  }
}

function missionTs(iso: string): number {
  const n = new Date(iso).getTime()
  return Number.isNaN(n) ? 0 : n
}

function humanMessageBody(m: FeedMessage): string {
  return (m.text ?? '').trim()
}

export function messageMentionsAgent(text: string, agent: StoreAgent): boolean {
  const t = text.toLowerCase()
  const name = agent.name.toLowerCase()
  const id = agent.id.toLowerCase()
  if (t.includes(`@${name}`) || t.includes(`@${id}`)) return true
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text)
}

function selectLatestHumanMentionMessage(
  state: Pick<NaveStore, 'messages' | 'agents'>,
  agentId: string,
): FeedMessage | null {
  const agent = state.agents[agentId]
  if (!agent) return null
  const hits = state.messages
    .filter(
      (m) =>
        m.type === 'human' &&
        humanMessageBody(m).length > 0 &&
        messageMentionsAgent(humanMessageBody(m), agent),
    )
    .sort((a, b) => missionTs(b.timestampDateTime) - missionTs(a.timestampDateTime))
  return hits[0] ?? null
}

/** Removes a leading @mention of this agent so card copy focuses on what they said. */
function stripLeadingSelfMention(body: string, agent: StoreAgent): string {
  const name = agent.name.trim()
  const id = agent.id.trim()
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`^@${escapedName}\\b\\s*`, 'i'),
    new RegExp(`^@${escapedId}\\b\\s*`, 'i'),
  ]
  let s = body.trimStart()
  for (const p of patterns) {
    if (p.test(s)) {
      s = s.replace(p, '').trimStart()
      break
    }
  }
  return s
}

export type LastHumanTouchDetail = {
  authorName: string
  timeLabel: string
  snippet: string
}

const LAST_HUMAN_SNIPPET_MAX = 240

/**
 * Latest human @mention of this agent: who, when, and message (mention stripped for readability).
 */
export function selectLastHumanTouchDetail(
  state: Pick<NaveStore, 'messages' | 'agents'>,
  agentId: string,
): LastHumanTouchDetail | null {
  const agent = state.agents[agentId]
  if (!agent) return null
  const top = selectLatestHumanMentionMessage(state, agentId)
  if (!top) return null
  const body = humanMessageBody(top)
  const cleaned = stripLeadingSelfMention(body, agent)
  const base = cleaned.length > 0 ? cleaned : body.trim()
  const snippet =
    base.length > LAST_HUMAN_SNIPPET_MAX
      ? `${base.slice(0, LAST_HUMAN_SNIPPET_MAX - 1)}…`
      : base
  return {
    authorName: top.authorName,
    timeLabel: top.timestamp,
    snippet,
  }
}

/** Compact one-line summary: wall time + author. */
export function selectLastHumanInteractionLabel(
  state: Pick<NaveStore, 'messages' | 'agents'>,
  agentId: string,
): string | null {
  const d = selectLastHumanTouchDetail(state, agentId)
  if (!d) return null
  return `${d.timeLabel} · ${d.authorName}`
}

export type MissionPendingRow = {
  messageId: string
  channelId: string
  agentName: string
  actionTitle: string
  resource: string
  timestampDateTime: string
  displayTime: string
}

export function selectMissionControlPendingRows(
  state: Pick<NaveStore, 'messages' | 'permissionCardStates'>,
): MissionPendingRow[] {
  const rows: MissionPendingRow[] = []
  for (const m of state.messages) {
    if (!m.permissionCard) continue
    if (state.permissionCardStates[m.id] !== 'pending') continue
    rows.push({
      messageId: m.id,
      channelId: m.channelId,
      agentName: m.authorName,
      actionTitle: m.permissionCard.actionTitle,
      resource: m.permissionCard.resource,
      timestampDateTime: m.timestampDateTime,
      displayTime: m.timestamp,
    })
  }
  return rows.sort((a, b) => missionTs(b.timestampDateTime) - missionTs(a.timestampDateTime))
}

export function permissionCardStateMissionLabel(state: PermissionCardState): string {
  switch (state) {
    case 'pending':
      return 'pending'
    case 'reviewing':
      return 'reviewing'
    case 'approved':
      return 'approved'
    case 'denied':
      return 'denied'
    case 'always-allowed-confirming':
      return 'always allow (confirming)'
    case 'always-allowed-resolved':
      return 'always allow resolved'
    case 'cancelled':
      return 'cancelled'
    default:
      return String(state)
  }
}

export type MissionFeedEvent =
  | {
      kind: 'completion'
      id: string
      sortTime: number
      displayTime: string
      channelId: string
      messageId: string
      agentName: string
      taskName: string
      outcome: string
      filesChanged: string
    }
  | {
      kind: 'permission'
      id: string
      sortTime: number
      displayTime: string
      channelId: string
      messageId: string
      agentName: string
      action: string
      cardStateLabel: string
      isPending: boolean
    }
  | {
      kind: 'agent-blocked'
      id: string
      sortTime: number
      displayTime: string
      channelId: string
      agentId: string
      agentName: string
      /** Pending permission message explaining the block, when one exists in the store. */
      messageId?: string
    }
  | {
      kind: 'permission-denied-running'
      id: string
      sortTime: number
      displayTime: string
      channelId: string
      messageId: string
      agentName: string
    }
  | {
      kind: 'task-assigned'
      id: string
      sortTime: number
      displayTime: string
      channelId: string
      messageId: string
      assignerName: string
      agentName: string
      taskPreview: string
    }

export type MissionActivityFeedState = Pick<NaveStore, 'messages' | 'agents' | 'permissionCardStates'>

export function selectMissionControlActivityFeed(state: MissionActivityFeedState): MissionFeedEvent[] {
  const events: MissionFeedEvent[] = []
  const { messages, agents, permissionCardStates } = state

  for (const m of messages) {
    if (m.completionCard) {
      events.push({
        kind: 'completion',
        id: `ev-completion-${m.id}`,
        sortTime: missionTs(m.timestampDateTime),
        displayTime: m.timestamp,
        channelId: m.channelId,
        messageId: m.id,
        agentName: m.authorName,
        taskName: m.completionCard.taskName,
        outcome: m.completionCard.state,
        filesChanged: m.completionCard.stats.files,
      })
    }
    if (m.permissionCard) {
      const ps = permissionCardStates[m.id] ?? 'pending'
      events.push({
        kind: 'permission',
        id: `ev-perm-${m.id}`,
        sortTime: missionTs(m.timestampDateTime),
        displayTime: m.timestamp,
        channelId: m.channelId,
        messageId: m.id,
        agentName: m.authorName,
        action: m.permissionCard.actionTitle,
        cardStateLabel: permissionCardStateMissionLabel(ps),
        isPending: ps === 'pending',
      })
      if (ps === 'denied') {
        events.push({
          kind: 'permission-denied-running',
          id: `ev-denied-${m.id}`,
          sortTime: missionTs(m.timestampDateTime) + 1,
          displayTime: m.timestamp,
          channelId: m.channelId,
          messageId: m.id,
          agentName: m.authorName,
        })
      }
    }
  }

  for (const agent of Object.values(agents)) {
    if (agent.status !== 'blocked') continue
    const pendingMsg = messages.find(
      (m) =>
        m.permissionCard &&
        m.authorId === agent.id &&
        (permissionCardStates[m.id] ?? 'pending') === 'pending',
    )
    const sortTime = pendingMsg
      ? missionTs(pendingMsg.timestampDateTime)
      : missionTs(agent.currentTask.startedAt)
    const displayTime = pendingMsg
      ? pendingMsg.timestamp
      : new Date(agent.currentTask.startedAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
    events.push({
      kind: 'agent-blocked',
      id: `ev-blocked-${agent.id}`,
      sortTime,
      displayTime,
      channelId: agent.channel,
      agentId: agent.id,
      agentName: agent.name,
      messageId: pendingMsg?.id,
    })
  }

  const channels = new Set(messages.map((m) => m.channelId))
  for (const channelId of channels) {
    const humans = messages
      .filter((m) => m.channelId === channelId && m.type === 'human')
      .sort((a, b) => missionTs(a.timestampDateTime) - missionTs(b.timestampDateTime))
    const assignedAgents = new Set<string>()
    for (const m of humans) {
      const body = humanMessageBody(m)
      if (!body) continue
      for (const agent of Object.values(agents)) {
        if (assignedAgents.has(agent.id)) continue
        if (!messageMentionsAgent(body, agent)) continue
        assignedAgents.add(agent.id)
        const preview = body.length > 100 ? `${body.slice(0, 97)}…` : body
        events.push({
          kind: 'task-assigned',
          id: `ev-assign-${channelId}-${agent.id}-${m.id}`,
          sortTime: missionTs(m.timestampDateTime),
          displayTime: m.timestamp,
          channelId,
          messageId: m.id,
          assignerName: m.authorName,
          agentName: agent.name,
          taskPreview: preview,
        })
      }
    }
  }

  events.sort((a, b) => b.sortTime - a.sortTime)
  return events
}

export const MISSION_AGENT_CARD_ORDER = ['frontend', 'backend', 'data'] as const

const PATCH_SHARED_TASK_HISTORY: StoreCompletedTask[] = [
  {
    id: 'hist-fe-1',
    description: 'Route leader approvals back to worker mailbox',
    startedAt: '2026-04-02T08:12:00',
    completedAt: '2026-04-02T08:15:12',
    outcome: 'completed',
    filesChanged: '4',
    subProcessCount: 0,
    approvalsNeeded: 0,
  },
  {
    id: 'hist-fe-2',
    description: 'Extract partial result from killed async run',
    startedAt: '2026-04-02T07:20:00',
    completedAt: '2026-04-02T07:27:41',
    outcome: 'killed',
    filesChanged: '2',
    subProcessCount: 1,
    approvalsNeeded: 0,
  },
  {
    id: 'hist-fe-3',
    description: 'Normalize stale session registry records',
    startedAt: '2026-04-02T06:50:00',
    completedAt: '2026-04-02T06:52:08',
    outcome: 'failed',
    filesChanged: '1',
    subProcessCount: 0,
    approvalsNeeded: 0,
  },
]

function logTimesFromT0(t0: string, minuteOffsets: number[]): string[] {
  return minuteOffsets.map((off) => formatFeedClockFromIso(isoPlusMs(t0, off * 60_000)))
}

function buildPatchSubProcesses(t0: string, runStartedWallMs: number): StoreSubProcess[] {
  const c = logTimesFromT0(t0, [0, 1, 1, 2])
  const p = logTimesFromT0(t0, [0, 0, 0, 1, 1, 1])
  return [
    {
      id: 'proc-1',
      name: 'Find what still loads Settings on the main path',
      type: 'import trace',
      status: 'running',
      startedAt: t0,
      elapsedMs: 6 * 60 * 1000 + 11 * 1000,
      progress: 0,
      demoPlanStep: -1,
      demoLastAdvanceWallMs: runStartedWallMs,
      parentAgentId: 'frontend',
      log: [
        {
          type: 'read',
          description: 'Walked bootstrap → router chain for anything that pulls Settings in early.',
          timestamp: c[0]!,
        },
        {
          type: 'analyze',
          description: '`SettingsHost` still static-imports `./settings-root` — keeps Settings on the main chunk.',
          timestamp: c[1]!,
        },
        {
          type: 'read',
          description: 'Opened `SettingsHost` to confirm the import line.',
          timestamp: c[2]!,
        },
        {
          type: 'spawn',
          description: 'Checked graph against `settings.lazy_bundle` rollout rules.',
          timestamp: c[3]!,
        },
      ],
    },
    {
      id: 'proc-paper-mcp',
      name: `Paper frame · ${PAPER_FRAME_SETTINGS_DEFERRED}`,
      type: PAPER_MCP_SERVER_LABEL,
      status: 'running',
      startedAt: t0,
      elapsedMs: 5 * 60 * 1000 + 3 * 1000,
      progress: 0,
      demoPlanStep: -1,
      demoLastAdvanceWallMs: runStartedWallMs,
      parentAgentId: 'frontend',
      integration: 'paper-mcp',
      log: [
        {
          type: 'mcp',
          description: `Initialized ${PAPER_MCP_SERVER_LABEL} session · workspace token scoped.`,
          timestamp: p[0]!,
        },
        {
          type: 'mcp',
          description: `tools/list → ${paperMcpTools.listFrames}, ${paperMcpTools.getFrame}, ${paperMcpTools.fetchComments}`,
          timestamp: p[1]!,
        },
        {
          type: 'mcp',
          description: `tools/call ${paperMcpTools.listFrames} · project nave-app`,
          timestamp: p[2]!,
        },
        {
          type: 'mcp',
          description: `tools/call ${paperMcpTools.getFrame} · frame ${PAPER_FRAME_SETTINGS_DEFERRED}`,
          timestamp: p[3]!,
        },
        {
          type: 'analyze',
          description:
            'Compared Paper frame to Nave shell density; noted one tight breakpoint on the settings shell hero.',
          timestamp: p[4]!,
        },
        {
          type: 'mcp',
          description: `tools/call ${paperMcpTools.fetchComments} · latest thread on the frame`,
          timestamp: p[5]!,
        },
      ],
    },
  ]
}

function buildPatchDiscussionAgent(): StoreAgent {
  const tIdle = '2026-04-02T09:40:00'
  return {
    id: 'frontend',
    name: 'Patch',
    role: 'repo worker',
    channel: 'frontend',
    status: 'idle',
    currentTask: {
      description:
        'Idle in #frontend until a human @mentions Patch with scope for the Settings lazy-load work.',
      startedAt: tIdle,
      subProcessCount: 0,
    },
    taskSummary:
      'Humans are aligning on the flag (`settings.lazy_bundle`) and the Paper settings shell before anyone tags Patch.',
    identitySummary:
      'Executes scoped file and queue work, inherits team policy, and surfaces approvals back to the lead thread.',
    avatarClassName: 'bg-[#2a2a2a] text-[#f5f4f0]',
    subProcesses: [],
    taskHistory: PATCH_SHARED_TASK_HISTORY,
    memory: {
      recentDecisions: [
        'Holding automation until a human tags Patch — keeps the pre-alignment thread human-led.',
      ],
      openThreads: [
        'Import list must land in-channel before bootstrap edits.',
        'Paper frame `settings-deferred-shell` is the layout source of truth.',
      ],
      constraints: [
        'Never store tokens in localStorage.',
        'Map Settings importers before changing `SettingsHost` or bootstrap.',
        'Post the importer list in-thread before gated writes.',
      ],
    },
  }
}

function buildPatchActiveAgent(t0: string, runStartedWallMs: number): StoreAgent {
  const idle = buildPatchDiscussionAgent()
  return {
    ...idle,
    status: 'blocked',
    currentTask: {
      description:
        'Defer Settings until open: trace eager imports, pull latest Paper notes on `settings-deferred-shell`, then ask before editing `SettingsHost`.',
      startedAt: t0,
      subProcessCount: 2,
    },
    taskSummary:
      'Import-trace sub-process plus Paper MCP pass so code matches the agreed shell before any approval.',
    subProcesses: buildPatchSubProcesses(t0, runStartedWallMs),
    memory: {
      ...idle.memory,
      recentDecisions: [
        'Keeping `AppRoot.tsx` quiet until the import list is posted, per thread.',
        'Paper MCP sub-process runs beside the trace so layout notes stay in one run.',
      ],
      openThreads: [
        'Double-check narrow-width behavior on the settings shell before ship.',
        'Session refresh edge cases stay out of this cut.',
      ],
    },
  }
}

function patchActivationAckMessage(iso: string): FeedMessage {
  return {
    id: FRONTEND_AGENT_ACK_MESSAGE_ID,
    channelId: 'frontend',
    type: 'agent',
    authorId: 'frontend',
    authorName: 'Patch',
    timestamp: formatFeedClockFromIso(iso),
    timestampDateTime: iso,
    paragraphs: [
      'On it. Two sub-processes: trace what still loads Settings eagerly, and Paper MCP for the `settings-deferred-shell` frame. I will post findings here.',
    ],
    continuingLine: true,
    subprocesses: [
      {
        routeId: 'proc-1',
        name: 'Find what still loads Settings on the main path',
        subtitle: 'coding · import trace',
        progressPct: 0,
      },
      {
        routeId: 'proc-paper-mcp',
        name: `Paper frame · ${PAPER_FRAME_SETTINGS_DEFERRED}`,
        subtitle: `design · ${PAPER_MCP_SERVER_LABEL}`,
        progressPct: 0,
        integration: 'paper-mcp',
      },
    ],
  }
}

function patchActivationPermissionMessage(iso: string): FeedMessage {
  return {
    id: FRONTEND_PERMISSION_MESSAGE_ID,
    channelId: 'frontend',
    type: 'agent',
    authorId: 'frontend',
    authorName: 'Patch',
    timestamp: formatFeedClockFromIso(iso),
    timestampDateTime: iso,
    paragraphs: [
      'Trace is clear: `SettingsHost` still static-imports `./settings-root`, so Settings ships with the first chunk. Paper matches the shell we want. I need approval to add `src/features/settings/lazy-registry.ts` and switch `SettingsHost` to a dynamic import behind `settings.lazy_bundle`.',
    ],
    continuingLine: true,
    permissionCard: {
      actionTitle:
        'Add `lazy-registry.ts` and lazy-load Settings from `SettingsHost` (flagged)',
      resource: 'src/features/settings/lazy-registry.ts',
      description:
        'Adds the registry file and updates `SettingsHost` to replace the static `./settings-root` import with a dynamic `import()` behind `settings.lazy_bundle`. Chunk boundaries only—no secrets or env.',
      policyAgentName: 'Patch',
      policyPathGlob: 'src/features/settings/**',
    },
  }
}

function buildPatchActivationFeedMessages(ackIso: string, permIso: string): FeedMessage[] {
  return [patchActivationAckMessage(ackIso), patchActivationPermissionMessage(permIso)]
}

function seedAgents(): Record<string, StoreAgent> {
  return {
    frontend: buildPatchDiscussionAgent(),
    backend: {
      id: 'backend',
      name: 'Scout',
      role: 'queue analyst',
      channel: 'infra',
      status: 'blocked',
      currentTask: {
        description:
          'Blocked on approval to tighten `src/queue/permission-sync.ts` handoff rules before the next inspection run.',
        startedAt: '2026-04-02T09:05:00',
        subProcessCount: 0,
      },
      taskSummary:
        'Waiting on a human to approve the write; queue diff is staged and idle until the permission clears.',
      identitySummary:
        'Summarizes queue pressure, spots ordering regressions, and documents the difference between urgent and background work.',
      avatarClassName: 'bg-[#002FA7] text-white',
      subProcesses: [],
      taskHistory: [
        {
          id: 'hist-be-1',
          description: 'Consolidate permission patterns for inbox routing',
          startedAt: '2026-04-02T08:55:00',
          completedAt: '2026-04-02T09:00:04',
          outcome: 'completed',
          filesChanged: '3',
          subProcessCount: 0,
          approvalsNeeded: 0,
        },
        {
          id: 'hist-be-2',
          description: 'Diff queue priorities against release-train backlog',
          startedAt: '2026-04-02T08:10:00',
          completedAt: '2026-04-02T08:18:22',
          outcome: 'completed',
          filesChanged: '2',
          subProcessCount: 1,
          approvalsNeeded: 1,
        },
      ],
      memory: {
        recentDecisions: [
          'Kept denied handoffs as soft-block with a single retriable ticket instead of fan-out spam.',
        ],
        openThreads: [
          'Decide whether mission control should surface hidden meta messages.',
          'Confirm default priority bump when permission cards sit >15m.',
        ],
        constraints: ['Never let subagent-only queue items starve the main thread.'],
      },
    },
    data: {
      id: 'data',
      name: 'Mux',
      role: 'bridge operator',
      channel: 'release-train',
      status: 'idle',
      currentTask: {
        description: 'Waiting for the next bridge or release-train assignment.',
        startedAt: '2026-04-02T09:30:00',
        subProcessCount: 0,
      },
      taskSummary: 'Idle and synced to the latest approval policy; last bridge poll is parked.',
      identitySummary:
        'Owns bridge connectivity, reconnect backoff, and remote session registration for delegated environments.',
      avatarClassName: 'bg-[#c8b89a] text-[#0f0f0f]',
      subProcesses: [],
      taskHistory: [
        {
          id: 'hist-da-1',
          description: 'Restore background run after client attach',
          startedAt: '2026-04-02T08:40:00',
          completedAt: '2026-04-02T08:49:17',
          outcome: 'completed',
          filesChanged: '5',
          subProcessCount: 2,
          approvalsNeeded: 0,
        },
        {
          id: 'hist-da-2',
          description: 'Reconcile remote session registry export',
          startedAt: '2026-04-02T07:05:00',
          completedAt: '2026-04-02T07:22:33',
          outcome: 'completed',
          filesChanged: '8',
          subProcessCount: 1,
          approvalsNeeded: 1,
        },
        {
          id: 'hist-da-3',
          description: 'Dry-run bridge credential rotation',
          startedAt: '2026-04-02T06:10:00',
          completedAt: '2026-04-02T06:14:02',
          outcome: 'killed',
          filesChanged: '1',
          subProcessCount: 0,
          approvalsNeeded: 0,
        },
      ],
      memory: {
        recentDecisions: ['Persist reconnect handles alongside worker identity.'],
        openThreads: [
          'Retry bridge loop without duplicating spawned sessions when the registry lags.',
        ],
        constraints: ['Exponential backoff only. No silent session resurrection.'],
      },
    },
  }
}

/** Human-only preamble: no @Patch — the demo waits for the viewer to tag Patch from the composer. */
function seedFrontendMessages(): FeedMessage[] {
  return [
    {
      id: 'msg-f-d1',
      channelId: 'frontend',
      type: 'human',
      authorId: 'maya',
      authorName: 'Maya Lin',
      timestamp: '09:32',
      timestampDateTime: '2026-04-02T09:32:00',
      text: "Settings is still in the initial bundle, which is rough for first paint if a lot of people never open it. Can we lazy-load behind `settings.lazy_bundle`, or is there a constraint I'm missing?",
    },
    {
      id: 'msg-f-d2',
      channelId: 'frontend',
      type: 'human',
      authorId: 'jon',
      authorName: 'Jon Park',
      timestamp: '09:33',
      timestampDateTime: '2026-04-02T09:33:00',
      text: "Let's align to the Paper frame (`settings-deferred-shell`). Last time we improvised in code and design ended up with a mismatch.",
    },
    {
      id: 'msg-f-d3',
      channelId: 'frontend',
      type: 'human',
      authorId: 'maya',
      authorName: 'Maya Lin',
      timestamp: '09:34',
      timestampDateTime: '2026-04-02T09:34:00',
      text: "Works for me. Let's hold off on SettingsHost until we post who still imports settings in this thread.",
    },
    {
      id: 'msg-f-d4',
      channelId: 'frontend',
      type: 'human',
      authorId: 'jon',
      authorName: 'Jon Park',
      timestamp: '09:35',
      timestampDateTime: '2026-04-02T09:35:00',
      text: "Once that list is here, whoever is driving can pull the repo worker in from this channel. I'd rather keep the trace, Paper pass, and approvals in one place.",
    },
  ]
}

function seedInfraMessages(): FeedMessage[] {
  return [
    {
      id: 'msg-i-001',
      channelId: 'infra',
      type: 'human',
      authorId: 'jon',
      authorName: 'Jon Park',
      timestamp: '08:41',
      timestampDateTime: '2026-04-02T08:41:00',
      text: '@Scout could you tighten the permission-sync handoff before the inspection run today? Staging the queue diff is fine—please do not land the file until a human signs off.',
    },
    {
      id: 'msg-i-002',
      channelId: 'infra',
      type: 'agent',
      authorId: 'backend',
      authorName: 'Scout',
      timestamp: '08:42',
      timestampDateTime: '2026-04-02T08:42:00',
      paragraphs: [
        'Acknowledged. I have the routing diff staged and paused at the filesystem boundary. I need explicit approval to rewrite the handoff predicates in `permission-sync.ts`; without it the inspection run would touch production queue semantics.',
      ],
      continuingLine: true,
    },
    {
      id: BACKEND_PERMISSION_MESSAGE_ID,
      channelId: 'infra',
      type: 'agent',
      authorId: 'backend',
      authorName: 'Scout',
      timestamp: '09:05',
      timestampDateTime: '2026-04-02T09:05:00',
      paragraphs: [
        'The staged patch narrows worker inbox promotion when a permission ticket is still `reviewing`. I need approval to apply the `permission-sync.ts` update and run the inspection against the new rules.',
      ],
      continuingLine: true,
      permissionCard: {
        actionTitle: 'Update permission-sync.ts queue handoff predicates',
        resource: 'src/queue/permission-sync.ts',
        description:
          'Edits guarded handoff branches so queue workers do not promote inbox items while a permission card is still in `reviewing`. Staged diff only; no secret or env changes.',
        policyAgentName: 'Scout',
        policyPathGlob: 'src/queue/**',
      },
    },
  ]
}

function seedReleaseTrainMessages(): FeedMessage[] {
  return [
    {
      id: 'msg-rt-001',
      channelId: 'release-train',
      type: 'human',
      authorId: 'elise',
      authorName: 'Elise Tran',
      timestamp: '09:02',
      timestampDateTime: '2026-04-02T09:02:00',
      text: '@Mux could you poll the bridge again after the credential rotation dry-run? Please hold new sessions until the registry export lands.',
    },
  ]
}

function seedAllMessages(): FeedMessage[] {
  return [...seedFrontendMessages(), ...seedInfraMessages(), ...seedReleaseTrainMessages()]
}

function completionMessage(): FeedMessage {
  return {
    id: FRONTEND_COMPLETION_MESSAGE_ID,
    channelId: 'frontend',
    type: 'agent',
    authorId: 'frontend',
    authorName: 'Patch',
    timestamp: '09:48',
    timestampDateTime: '2026-04-02T09:48:00',
    paragraphs: [
      'Approval received. `lazy-registry.ts` is in, `SettingsHost` loads Settings behind `settings.lazy_bundle`, and the trace is clean. Paper notes for `settings-deferred-shell` are reflected in the PR. Ready for CI.',
    ],
    completionCard: {
      state: 'completed',
      taskName: 'Load Settings on demand (flagged)',
      stats: {
        durationLabel: 'Completed · 4m 06s',
        files: '3',
        subprocesses: '2',
        errors: '0',
        approvals: '1',
      },
    },
  }
}

function denialFollowUpMessage(): FeedMessage {
  return {
    id: `msg-f-denial-${Date.now()}`,
    channelId: 'frontend',
    type: 'agent',
    authorId: 'frontend',
    authorName: 'Patch',
    timestamp: '09:49',
    timestampDateTime: '2026-04-02T09:49:00',
    paragraphs: [
      'Understood—no `lazy-registry.ts` this pass.',
      'I will try an inline `import()` on `./settings-root` behind `settings.lazy_bundle`, leave `AppRoot.tsx` alone, re-run the trace, and post results before the next write.',
    ],
  }
}

export type NaveStore = {
  messages: FeedMessage[]
  permissionCardStates: Record<string, PermissionCardState>
  agents: Record<string, StoreAgent>
  lastViewedProcessId: string | null
  activeChannel: string
  /**
   * When true, #frontend waits for the viewer to send a message that @mentions Patch before
   * agent sub-processes and the permission card appear.
   */
  frontendDemoAwaitingAssignment: boolean
  /**
   * True from Patch activation until the delayed ack message is appended — drives a feed skeleton
   * so the channel does not feel idle during PATCH_ACK_DELAY_MS.
   */
  frontendPatchAckPending: boolean
  setActiveChannel: (channelId: string) => void
  setLastViewedProcessId: (processId: string | null) => void
  /** Append a human line; may activate Patch on #frontend when awaiting assignment and text mentions Patch. */
  sendChannelMessage: (channelId: string, text: string) => void
  permissionApprove: (messageId: string) => void
  permissionDeny: (messageId: string) => void
  permissionAlwaysAllow: (messageId: string) => void
  permissionAlwaysAllowConfirm: (messageId: string) => void
  permissionAlwaysAllowCancel: (messageId: string) => void
  /** Restore seeded demo state for repeat recording takes. */
  demoReset: () => void
  /**
   * Demo tick: advance running Patch sub-process progress toward completion so feed and cockpit
   * bars move without a live backend. No-op when nothing is running.
   */
  advanceDemoSubprocessProgress: () => void
}

function appendCompletionIfMissing(list: FeedMessage[]): FeedMessage[] {
  if (list.some((m) => m.id === FRONTEND_COMPLETION_MESSAGE_ID)) return list
  return [...list, completionMessage()]
}

export type WorkspaceCompletionBanner = {
  taskName: string
  filesLabel: string
  durationSnippet: string
}

/** Latest Patch completion in #frontend — drives the IKB workspace banner (third completion signal). */
export function selectLatestFrontendCompletionBanner(
  state: Pick<NaveStore, 'messages'>,
): WorkspaceCompletionBanner | null {
  const hits = state.messages.filter(
    (m) =>
      m.channelId === 'frontend' &&
      m.authorId === 'frontend' &&
      m.completionCard?.state === 'completed',
  )
  const top = hits.sort((a, b) => missionTs(b.timestampDateTime) - missionTs(a.timestampDateTime))[0]
  if (!top?.completionCard) return null
  const c = top.completionCard
  const durationSnippet =
    c.stats.durationLabel.replace(/^\s*Completed\s*·\s*/i, '').trim() || c.stats.durationLabel
  return {
    taskName: c.taskName,
    filesLabel: `${c.stats.files} files`,
    durationSnippet,
  }
}

export function selectWorkspaceHeaderMetrics(
  state: Pick<NaveStore, 'agents' | 'messages' | 'permissionCardStates'>,
): { subProcesses: string; pendingApprovals: string; queuePriority: string } {
  const subTotal = Object.values(state.agents).reduce(
    (acc, a) => acc + a.currentTask.subProcessCount,
    0,
  )
  const pending = selectMissionControlPendingRows(state).length
  return {
    subProcesses: String(subTotal).padStart(2, '0'),
    pendingApprovals: String(pending).padStart(2, '0'),
    queuePriority: 'Now',
  }
}

function initialDataSlice(): Pick<
  NaveStore,
  | 'messages'
  | 'permissionCardStates'
  | 'agents'
  | 'lastViewedProcessId'
  | 'activeChannel'
  | 'frontendDemoAwaitingAssignment'
  | 'frontendPatchAckPending'
> {
  return {
    messages: seedAllMessages(),
    permissionCardStates: {
      [BACKEND_PERMISSION_MESSAGE_ID]: 'pending',
    },
    agents: seedAgents(),
    lastViewedProcessId: null,
    activeChannel: 'frontend',
    frontendDemoAwaitingAssignment: true,
    frontendPatchAckPending: false,
  }
}

function applyFrontendPostApproval(get: () => NaveStore) {
  const { agents, messages } = get()
  const fe = agents.frontend
  if (!fe) return { agents, messages: appendCompletionIfMissing(messages) }

  const nextSub = fe.subProcesses.map((s) =>
    s.status === 'running'
      ? {
          ...s,
          status: 'completed' as const,
          progress: 100,
          demoPlanStep: Math.max(0, (s.log?.length ?? 1) - 1),
          elapsedMs: s.elapsedMs,
        }
      : s,
  )

  const nextFrontend: StoreAgent = {
    ...fe,
    status: 'idle',
    currentTask: {
      ...fe.currentTask,
      subProcessCount: 0,
    },
    subProcesses: nextSub,
  }

  return {
    messages: appendCompletionIfMissing(messages),
    agents: { ...agents, frontend: nextFrontend },
  }
}

function applyFrontendPostDeny(get: () => NaveStore) {
  const { agents, messages } = get()
  const fe = agents.frontend
  if (!fe) return { agents, messages: [...messages, denialFollowUpMessage()] }

  const nextFrontend: StoreAgent = {
    ...fe,
    status: 'running',
  }

  return {
    messages: [...messages, denialFollowUpMessage()],
    agents: { ...agents, frontend: nextFrontend },
  }
}

function applyBackendPostApproval(get: () => NaveStore) {
  const { agents } = get()
  const be = agents.backend
  if (!be) return {}
  const nextBackend: StoreAgent = {
    ...be,
    status: 'running',
    currentTask: {
      ...be.currentTask,
      description:
        'Apply approved updates to `src/queue/permission-sync.ts` handoff rules and resume the inspection run.',
    },
    taskSummary:
      'Write approved; continuing queue handoff tightening and inspection against the new predicates.',
  }
  return { agents: { ...agents, backend: nextBackend } }
}

function applyBackendPostDeny(get: () => NaveStore) {
  const { agents } = get()
  const be = agents.backend
  if (!be) return {}
  const nextBackend: StoreAgent = {
    ...be,
    status: 'running',
    currentTask: {
      ...be.currentTask,
      description:
        'Re-scope `permission-sync.ts` changes after denial — queue-only simulation until humans restate the write boundary.',
    },
    taskSummary: 'Waiting on revised scope for the handoff rule change; no filesystem writes until then.',
  }
  return { agents: { ...agents, backend: nextBackend } }
}

function permissionOutcomePatch(
  messageId: string,
  outcome: 'approved' | 'denied',
  get: () => NaveStore,
): Partial<NaveStore> {
  if (messageId === FRONTEND_PERMISSION_MESSAGE_ID) {
    return outcome === 'approved' ? applyFrontendPostApproval(get) : applyFrontendPostDeny(get)
  }
  if (messageId === BACKEND_PERMISSION_MESSAGE_ID) {
    return outcome === 'approved' ? applyBackendPostApproval(get) : applyBackendPostDeny(get)
  }
  return {}
}

/**
 * Poll interval for demo sub-process checks. Each milestone uses a variable wall-clock gap
 * (`demoStepGapMs`) so runs feel uneven, not metronomic.
 */
export const DEMO_SUBPROCESS_POLL_MS = 175

const PATCH_ACK_DELAY_MS = 1_050
const PATCH_PERMISSION_DELAY_MS = 2_900

function demoStepGapMs(s: StoreSubProcess): number {
  const stepIdxForGap = Math.max(0, (s.demoPlanStep ?? -1) + 1)
  const lane = s.id === 'proc-paper-mcp' ? 1 : 0
  const tail = s.id.charCodeAt(s.id.length - 1) | 0
  const jitter = (stepIdxForGap * 113 + lane * 79 + tail) % 520
  return 380 + jitter
}

/**
 * Advance one milestone when wall-clock gap since `demoLastAdvanceWallMs` has elapsed.
 */
function maybeAdvanceDemoSubProcess(s: StoreSubProcess, now: number): StoreSubProcess {
  if (s.status !== 'running') return s
  const planLen = Math.max(1, s.log?.length ?? 1)
  const last = s.demoLastAdvanceWallMs ?? now
  const gap = demoStepGapMs(s)
  if (now - last < gap) {
    return s
  }
  const elapsedDelta = Math.min(Math.max(0, now - last), 45_000)
  const cur = s.demoPlanStep ?? -1
  const next = cur + 1
  if (next >= planLen) {
    return {
      ...s,
      demoPlanStep: Math.max(0, planLen - 1),
      progress: 100,
      status: 'completed',
      elapsedMs: s.elapsedMs + elapsedDelta,
      demoLastAdvanceWallMs: now,
    }
  }
  const progress = Math.round((100 * (next + 1)) / planLen)
  const done = progress >= 100
  return {
    ...s,
    demoPlanStep: next,
    progress: done ? 100 : progress,
    status: done ? ('completed' as const) : ('running' as const),
    elapsedMs: s.elapsedMs + elapsedDelta,
    demoLastAdvanceWallMs: now,
  }
}

export const useNaveStore = create<NaveStore>((set, get) => {
  let patchActivationTimelineSeq = 0

  const queueReviewFinish = (messageId: string, outcome: 'approved' | 'denied') => {
    window.setTimeout(() => {
      const { permissionCardStates } = get()
      if (permissionCardStates[messageId] !== 'reviewing') return

      set({
        permissionCardStates: {
          ...permissionCardStates,
          [messageId]: outcome === 'approved' ? 'approved' : 'denied',
        },
        ...permissionOutcomePatch(messageId, outcome, get),
      })
    }, REVIEW_DELAY_MS)
  }

  return {
    ...initialDataSlice(),

    setActiveChannel: (channelId) => set({ activeChannel: channelId }),

    setLastViewedProcessId: (processId) => set({ lastViewedProcessId: processId }),

    sendChannelMessage: (channelId, text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      const state = get()
      const now = new Date()
      const iso = now.toISOString()
      const display = formatFeedClockFromIso(iso)
      const userMsgId = `msg-human-${channelId}-${now.getTime()}`
      const humanMsg: FeedMessage = {
        id: userMsgId,
        channelId,
        type: 'human',
        authorId: DEMO_HUMAN_AUTHOR.id,
        authorName: DEMO_HUMAN_AUTHOR.name,
        timestamp: display,
        timestampDateTime: iso,
        text: trimmed,
      }
      const nextMessages = [...state.messages, humanMsg]
      const feAgent = state.agents.frontend

      if (
        channelId === 'frontend' &&
        state.frontendDemoAwaitingAssignment &&
        feAgent &&
        messageMentionsAgent(trimmed, feAgent)
      ) {
        const taskStartIso = iso
        patchActivationTimelineSeq++
        const timelineSeq = patchActivationTimelineSeq

        set({
          messages: nextMessages,
          frontendDemoAwaitingAssignment: false,
          frontendPatchAckPending: true,
        })

        window.setTimeout(() => {
          if (timelineSeq !== patchActivationTimelineSeq) return
          const wall = Date.now()
          const ackIso = new Date().toISOString()
          set((s) => {
            if (timelineSeq !== patchActivationTimelineSeq) return {}
            return {
              messages: [...s.messages, patchActivationAckMessage(ackIso)],
              agents: {
                ...s.agents,
                frontend: buildPatchActiveAgent(taskStartIso, wall),
              },
              frontendPatchAckPending: false,
            }
          })
        }, PATCH_ACK_DELAY_MS)

        window.setTimeout(() => {
          if (timelineSeq !== patchActivationTimelineSeq) return
          const permIso = new Date().toISOString()
          set((s) => {
            if (timelineSeq !== patchActivationTimelineSeq) return {}
            return {
              messages: [...s.messages, patchActivationPermissionMessage(permIso)],
              permissionCardStates: {
                ...s.permissionCardStates,
                [FRONTEND_PERMISSION_MESSAGE_ID]: 'pending',
              },
            }
          })
        }, PATCH_ACK_DELAY_MS + PATCH_PERMISSION_DELAY_MS)
        return
      }

      set({ messages: nextMessages })
    },

    permissionApprove: (messageId) => {
      const { permissionCardStates } = get()
      if (permissionCardStates[messageId] !== 'pending') return
      set({
        permissionCardStates: { ...permissionCardStates, [messageId]: 'reviewing' },
      })
      queueReviewFinish(messageId, 'approved')
    },

    permissionDeny: (messageId) => {
      const { permissionCardStates } = get()
      if (permissionCardStates[messageId] !== 'pending') return
      set({
        permissionCardStates: { ...permissionCardStates, [messageId]: 'reviewing' },
      })
      queueReviewFinish(messageId, 'denied')
    },

    permissionAlwaysAllow: (messageId) => {
      const { permissionCardStates } = get()
      if (permissionCardStates[messageId] !== 'pending') return
      set({
        permissionCardStates: {
          ...permissionCardStates,
          [messageId]: 'always-allowed-confirming',
        },
      })
    },

    permissionAlwaysAllowConfirm: (messageId) => {
      const { permissionCardStates } = get()
      if (permissionCardStates[messageId] !== 'always-allowed-confirming') return
      const post =
        messageId === FRONTEND_PERMISSION_MESSAGE_ID
          ? applyFrontendPostApproval(get)
          : messageId === BACKEND_PERMISSION_MESSAGE_ID
            ? applyBackendPostApproval(get)
            : {}
      set({
        permissionCardStates: {
          ...permissionCardStates,
          [messageId]: 'always-allowed-resolved',
        },
        ...post,
      })
    },

    permissionAlwaysAllowCancel: (messageId) => {
      const { permissionCardStates } = get()
      if (permissionCardStates[messageId] !== 'always-allowed-confirming') return
      set({
        permissionCardStates: { ...permissionCardStates, [messageId]: 'pending' },
      })
    },

    demoReset: () => {
      patchActivationTimelineSeq++
      set(initialDataSlice())
    },

    advanceDemoSubprocessProgress: () => {
      const now = Date.now()
      set((state) => {
        const fe = state.agents.frontend
        if (!fe) return {}
        let changed = false
        const nextSubs = fe.subProcesses.map((s) => {
          const next = maybeAdvanceDemoSubProcess(s, now)
          if (
            next.progress !== s.progress ||
            next.status !== s.status ||
            next.demoPlanStep !== s.demoPlanStep ||
            next.demoLastAdvanceWallMs !== s.demoLastAdvanceWallMs ||
            next.elapsedMs !== s.elapsedMs
          ) {
            changed = true
          }
          return next
        })
        if (!changed) return {}
        return {
          agents: {
            ...state.agents,
            frontend: {
              ...fe,
              subProcesses: nextSubs,
            },
          },
        }
      })
    },
  }
})
