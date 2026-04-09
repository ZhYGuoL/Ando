import { create } from 'zustand'
import type { PermissionCardState } from '../components/permission/PermissionCard'
import type { CompletionCardState } from '../components/completion/CompletionCard'

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
  continuingLine?: boolean
}

export type SidebarAgentStatus = 'running' | 'idle' | 'blocked'

export type StoreSubprocessStatus = 'running' | 'completed' | 'killed' | 'failed'

export type StoreSubprocessLogStep = {
  type: 'read' | 'write' | 'analyze' | 'spawn'
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
  partialResult?: string
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

const REVIEW_DELAY_MS = 800

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

function seedAgents(): Record<string, StoreAgent> {
  const t0 = '2026-04-02T09:44:00'
  return {
    frontend: {
      id: 'frontend',
      name: 'Patch',
      role: 'repo worker',
      channel: 'frontend',
      status: 'blocked',
      currentTask: {
        description:
          'Lazy-load the settings client chunk behind `settings.lazy_bundle` and remove synchronous settings imports from the bootstrap path.',
        startedAt: t0,
        subProcessCount: 1,
      },
      taskSummary:
        'Tracing static imports from `main.tsx` through `SettingsHost`, posting graph updates in #frontend, and gating new file writes behind approval.',
      identitySummary:
        'Executes scoped file and queue work, inherits team policy, and surfaces approvals back to the lead thread.',
      avatarClassName: 'bg-[#2a2a2a] text-[#f5f4f0]',
      subProcesses: [
        {
          id: 'proc-1',
          name: 'Trace static imports for settings on critical path',
          type: 'import graph',
          status: 'running',
          startedAt: t0,
          elapsedMs: 6 * 60 * 1000 + 11 * 1000,
          progress: 62,
          parentAgentId: 'frontend',
          log: [
            {
              type: 'read',
              description: 'Walked `main.tsx` → `router.tsx` → `app/providers.tsx` for static importers.',
              timestamp: '09:44',
            },
            {
              type: 'analyze',
              description:
                'Flagged `app/bootstrap/SettingsHost.tsx` as pinning `features/settings` synchronously.',
              timestamp: '09:45',
            },
            {
              type: 'read',
              description: 'Read `SettingsHost` source to confirm `./settings-root` static import.',
              timestamp: '09:45',
            },
            {
              type: 'spawn',
              description: 'Spawned checker to validate chunk graph against `settings.lazy_bundle`.',
              timestamp: '09:46',
            },
          ],
        },
      ],
      taskHistory: [
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
      ],
      memory: {
        recentDecisions: [
          'Switched to the flagged dynamic-import path after Maya’s thread emphasized keeping `AppRoot.tsx` untouched until the graph is posted.',
          'Spawned the static import graph sub-process before proposing `lazy-registry.ts` writes.',
        ],
        openThreads: [
          'Mobile breakpoint testing not yet verified for the deferred settings chunk.',
          'Token refresh on expired sessions still flagged for follow-up — out of scope for this bundle cut.',
        ],
        constraints: [
          'Never store tokens in localStorage.',
          'Always map `features/settings` importers before mutating `SettingsHost` or bootstrap.',
          'Post the full importer list in-thread before gated writes.',
        ],
      },
    },
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

function seedFrontendMessages(): FeedMessage[] {
  return [
    {
      id: 'msg-f-001',
      channelId: 'frontend',
      type: 'human',
      authorId: 'maya',
      authorName: 'Maya Lin',
      timestamp: '09:41',
      timestampDateTime: '2026-04-02T09:41:00',
      text: '@Patch we need the settings surface lazy-loaded from `src/features/settings/lazy-registry.ts` behind `settings.lazy_bundle` before Thursday’s cut. Trace every static import that still pulls `features/settings` into the critical path of `main.tsx` and report before you touch files.',
    },
    {
      id: 'msg-f-002',
      channelId: 'frontend',
      type: 'human',
      authorId: 'jon',
      authorName: 'Jon Park',
      timestamp: '09:43',
      timestampDateTime: '2026-04-02T09:43:00',
      text: 'Flag already exists in GrowthBook. If you have to touch `AppRoot.tsx`, keep the diff under ~35 lines and post the import list first.',
    },
    {
      id: 'msg-f-003',
      channelId: 'frontend',
      type: 'agent',
      authorId: 'frontend',
      authorName: 'Patch',
      timestamp: '09:44',
      timestampDateTime: '2026-04-02T09:44:00',
      paragraphs: [
        'Acknowledged. I spawned a sub-process that walks `main.tsx` → `router.tsx` → `app/providers.tsx` and records every importer that resolves `features/settings` synchronously. I will keep graph updates in this thread so the feed stays readable.',
      ],
      continuingLine: true,
      subprocess: {
        routeId: 'proc-1',
        name: 'Trace static imports for settings on critical path',
        subtitle: 'running · opens detail view',
        progressPct: 62,
      },
    },
    {
      id: FRONTEND_PERMISSION_MESSAGE_ID,
      channelId: 'frontend',
      type: 'agent',
      authorId: 'frontend',
      authorName: 'Patch',
      timestamp: '09:47',
      timestampDateTime: '2026-04-02T09:47:00',
      paragraphs: [
        'The graph shows `app/bootstrap/SettingsHost.tsx` still synchronously imports `./settings-root`, which pins the bundle. I need approval to add `src/features/settings/lazy-registry.ts` and switch `SettingsHost` to load it through the flagged dynamic import path described in the team doc.',
      ],
      continuingLine: true,
      permissionCard: {
        actionTitle:
          'Add `lazy-registry.ts` and change SettingsHost to use a flagged dynamic import',
        resource: 'src/features/settings/lazy-registry.ts',
        description:
          'Creates the registry module and updates `src/app/bootstrap/SettingsHost.tsx` to replace the static import of `./settings-root` with `import(settingsPath)` guarded by `settings.lazy_bundle`. No secrets or env values are touched; this only affects client chunk boundaries.',
        policyAgentName: 'Patch',
        policyPathGlob: 'src/features/settings/**',
      },
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
      text: '@Scout tighten `src/queue/permission-sync.ts` handoff rules before today’s inspection run — stage the queue diff only until a human approves the on-disk write.',
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
      text: '@Mux poll the bridge again after the credential rotation dry-run; hold new sessions until the registry export lands.',
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
      'Approval received. `lazy-registry.ts` is in place, `SettingsHost` now gates the client chunk behind `settings.lazy_bundle`, and the sub-process run shows no remaining synchronous importers on the hot path. Ready for review in CI.',
    ],
    completionCard: {
      state: 'completed',
      taskName: 'Lazy-load settings bundle behind feature flag',
      stats: {
        durationLabel: 'Completed · 4m 06s',
        files: '3',
        subprocesses: '1',
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
      'Understood. I will not add `lazy-registry.ts` in this pass.',
      'I will instead refactor `SettingsHost` to use an inline `import()` of the existing `./settings-root` path behind `settings.lazy_bundle`, keep `AppRoot.tsx` untouched, and re-run the import graph. I will post the updated trace before the next write.',
    ],
  }
}

export type NaveStore = {
  messages: FeedMessage[]
  permissionCardStates: Record<string, PermissionCardState>
  agents: Record<string, StoreAgent>
  lastViewedProcessId: string | null
  activeChannel: string
  setActiveChannel: (channelId: string) => void
  setLastViewedProcessId: (processId: string | null) => void
  permissionApprove: (messageId: string) => void
  permissionDeny: (messageId: string) => void
  permissionAlwaysAllow: (messageId: string) => void
  permissionAlwaysAllowConfirm: (messageId: string) => void
  permissionAlwaysAllowCancel: (messageId: string) => void
  /** Restore seeded demo state for repeat recording takes. */
  demoReset: () => void
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
  'messages' | 'permissionCardStates' | 'agents' | 'lastViewedProcessId' | 'activeChannel'
> {
  return {
    messages: seedAllMessages(),
    permissionCardStates: {
      [FRONTEND_PERMISSION_MESSAGE_ID]: 'pending',
      [BACKEND_PERMISSION_MESSAGE_ID]: 'pending',
    },
    agents: seedAgents(),
    lastViewedProcessId: null,
    activeChannel: 'frontend',
  }
}

function applyFrontendPostApproval(get: () => NaveStore) {
  const { agents, messages } = get()
  const fe = agents.frontend
  if (!fe) return { agents, messages: appendCompletionIfMissing(messages) }

  const nextSub = fe.subProcesses.map((s) =>
    s.id === 'proc-1'
      ? { ...s, status: 'completed' as const, progress: 100, elapsedMs: s.elapsedMs }
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

export const useNaveStore = create<NaveStore>((set, get) => {
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

    demoReset: () => set(initialDataSlice()),
  }
})
