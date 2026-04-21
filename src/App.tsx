import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CompletionCard } from './components/completion/CompletionCard'
import { MockFeedMessage } from './components/permission/MockFeedMessage'
import {
  PermissionCard,
  type PermissionCardInteractionHandlers,
  type PermissionCardState,
} from './components/permission/PermissionCard'
import { DemoControls } from './components/demo/DemoControls'
import {
  type FeedMessage,
  type FeedSubprocessPayload,
  feedMessageSubprocesses,
  type MissionFeedEvent,
  type StoreAgent,
  type StoreSubProcess,
  formatRunningLabel,
  formatStoreElapsedMs,
  MISSION_AGENT_CARD_ORDER,
  type LastHumanTouchDetail,
  selectCockpitMemoryMerged,
  selectCockpitTaskHistoryMerged,
  selectLastHumanTouchDetail,
  selectLatestFrontendCompletionBanner,
  selectMissionControlActivityFeed,
  selectMissionControlPendingRows,
  selectWorkspaceHeaderMetrics,
  useNaveStore,
  DEMO_HUMAN_AUTHOR,
  DEMO_SUBPROCESS_POLL_MS,
  type StoreSubprocessStatus,
} from './store'
import {
  MemoryRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { NavStackProvider, useNavStack } from './nav/NavStackContext'

type AgentStatus = 'running' | 'blocked' | 'idle'
type ProcessStatus = 'running' | 'completed' | 'killed' | 'failed' | 'blocked' | 'idle'
type SubprocessStepType = 'read' | 'write' | 'analyze' | 'spawn' | 'mcp'
type ActivityKind = 'completion' | 'permission' | 'state' | 'task'

type Channel = {
  name: string
  unread: boolean
}

type Agent = {
  routeId: string
  initials: string
  name: string
  role: string
  status: AgentStatus
  avatarClassName: string
  channel: string
  identitySummary: string
  currentTask: string
  taskSummary: string
  runningFor: string
  subProcessCount: number
  memorySummary: {
    decisions: string[]
    openThreads: string[]
    constraints: string[]
  }
  subprocesses: {
    id: string
    routeId: string
    name: string
    type: string
    status: ProcessStatus
    elapsed: string
    progress: number
    partialResult?: string
    log: {
      type: SubprocessStepType
      description: string
      timestamp: string
    }[]
    integration?: 'paper-mcp'
  }[]
  taskHistory: {
    name: string
    duration: string
    outcome: 'completed' | 'killed' | 'failed'
    filesChanged: string
  }[]
}

const channels: Channel[] = [
  { name: 'general', unread: false },
  { name: 'frontend', unread: true },
  { name: 'infra', unread: false },
  { name: 'release-train', unread: false },
  { name: 'memory-lab', unread: false },
]

const channelSummaries: Record<string, string> = {
  general: 'General coordination across humans and agents.',
  frontend:
    'Client bootstrap, bundle boundaries, and guarded refactors that affect what ships in the browser.',
  infra: 'Permission routing, worker handoff, and queue discipline for long-running agent work.',
  'release-train': 'Deployment readiness, remote bridge checks, and state changes across release workflows.',
  'memory-lab': 'Memory scope, persistence rules, and reusable workspace knowledge patterns.',
}

function resolveProcessFromStore(
  processId: string | undefined,
  storeAgents: Record<string, StoreAgent>,
): { agent: StoreAgent; sub: StoreSubProcess } | null {
  if (!processId) return null
  for (const agent of Object.values(storeAgents)) {
    const sub = agent.subProcesses.find((p) => p.id === processId)
    if (sub) return { agent, sub }
  }
  return null
}

function cockpitInitials(agentKey: string, name: string): string {
  const fixed: Record<string, string> = { frontend: 'PT', backend: 'SC', data: 'MX' }
  return fixed[agentKey] ?? humanInitials(name)
}

function buildLegacyAgentShell(a: StoreAgent): Agent {
  const runningFor =
    a.status === 'idle'
      ? 'Idle'
      : a.status === 'blocked'
        ? 'Blocked'
        : formatRunningLabel(a.currentTask.startedAt)
  return {
    routeId: a.id,
    initials: cockpitInitials(a.id, a.name),
    name: a.name,
    role: a.role,
    status: a.status,
    avatarClassName: a.avatarClassName,
    channel: `#${a.channel}`,
    identitySummary: a.identitySummary,
    currentTask: a.currentTask.description,
    taskSummary: a.taskSummary,
    runningFor,
    subProcessCount: a.currentTask.subProcessCount,
    memorySummary: { decisions: [], openThreads: [], constraints: [] },
    subprocesses: [],
    taskHistory: [],
  }
}

function pickChannelFocusAgent(
  channelName: string,
  storeAgents: Record<string, StoreAgent>,
): Agent | null {
  const list = Object.values(storeAgents)
    .filter((a) => a.channel === channelName)
    .map(buildLegacyAgentShell)
  if (list.length === 0) return null
  const priority: AgentStatus[] = ['running', 'blocked', 'idle']
  for (const status of priority) {
    const hit = list.find((agent) => agent.status === status)
    if (hit) return hit
  }
  return list[0] ?? null
}

function storeSubToLegacy(sub: StoreSubProcess): Agent['subprocesses'][number] {
  return {
    id: `${sub.id}-legacy-row`,
    routeId: sub.id,
    name: sub.name,
    type: sub.type,
    status: sub.status,
    elapsed: formatStoreElapsedMs(sub.elapsedMs),
    progress: sub.progress,
    partialResult: sub.partialResult,
    integration: sub.integration,
    log: (sub.log ?? []).map((l) => ({ ...l })),
  }
}

/** Router + nav stack — mount from main.tsx */
export function AppShell() {
  return (
    <MemoryRouter initialEntries={['/?channel=frontend']}>
      <NavStackProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<WorkspaceRoute />} />
            <Route path="/home" element={<HomeRoute />} />
            <Route path="/agent/:agentId" element={<AgentRoute />} />
            <Route path="/process/:processId" element={<ProcessRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </NavStackProvider>
    </MemoryRouter>
  )
}

function feedSubprocessLiveView(
  sub: FeedSubprocessPayload,
  agent: StoreAgent | undefined,
): {
  pct: number
  status: StoreSubprocessStatus
  phaseLabel: string | null
  planMeta: string | null
  milestoneCount: number | null
} {
  const live = agent?.subProcesses.find((p) => p.id === sub.routeId)
  const pct = live != null ? Math.min(100, live.progress) : sub.progressPct
  const status: StoreSubprocessStatus =
    live != null ? live.status : pct >= 100 ? 'completed' : 'running'
  const phaseLabel = live ? subprocessPhaseLabelFromPlan(live) : null
  const planMeta = live ? subprocessPlanMetaLine(live, status) : null
  const milestoneCount = live?.log?.length ? live.log.length : null
  return { pct, status, phaseLabel, planMeta, milestoneCount }
}

/** Active milestone copy — always matches `demoPlanStep` while running (hidden once terminal). */
function subprocessPhaseLabelFromPlan(proc: StoreSubProcess): string | null {
  const steps = proc.log
  if (!steps?.length) return null
  if (proc.status !== 'running') return null
  const idx = proc.demoPlanStep ?? -1
  if (idx < 0) return `Next · ${steps[0]!.description}`
  return steps[idx]!.description
}

function subprocessPlanMetaLine(proc: StoreSubProcess, status: StoreSubprocessStatus): string | null {
  const n = proc.log?.length ?? 0
  if (!n || status !== 'running') return null
  const idx = proc.demoPlanStep ?? -1
  if (idx < 0) return `Run log · ${n} milestones`
  return `Milestone ${idx + 1} of ${n}`
}

function truncateFeedPhase(s: string, max = 100): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { clearStack } = useNavStack()
  const setActiveChannel = useNaveStore((s) => s.setActiveChannel)
  const storeAgents = useNaveStore((s) => s.agents)

  useEffect(() => {
    const id = window.setInterval(() => {
      useNaveStore.getState().advanceDemoSubprocessProgress()
    }, DEMO_SUBPROCESS_POLL_MS)
    return () => clearInterval(id)
  }, [])

  const channelFromSearch = new URLSearchParams(location.search).get('channel') ?? 'frontend'
  const processCtx =
    location.pathname.startsWith('/process/') && location.pathname.split('/')[2]
      ? resolveProcessFromStore(location.pathname.split('/')[2], storeAgents)
      : null
  const agentIdFromPath = location.pathname.startsWith('/agent/')
    ? location.pathname.split('/')[2]
    : null

  const activeAgentRouteId =
    location.pathname === '/home'
      ? null
      : agentIdFromPath
        ? agentIdFromPath
        : processCtx
          ? processCtx.agent.id
          : null

  const activeChannelName = location.pathname === '/' ? channelFromSearch : null

  const goWorkspace = (channelName: string) => {
    clearStack()
    setActiveChannel(channelName)
    navigate(`/?channel=${encodeURIComponent(channelName)}`)
  }

  const goHome = () => {
    clearStack()
    navigate('/home')
  }

  const goAgentFromSidebar = (agentRouteId: string) => {
    clearStack()
    navigate(`/agent/${agentRouteId}`)
  }

  const [channelsCollapsed, setChannelsCollapsed] = useState(false)
  const [agentsCollapsed, setAgentsCollapsed] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="h-screen overflow-hidden bg-[#f5f4f0] text-[13px] text-[#0f0f0f] antialiased">
      <div className="flex h-full min-h-0 overflow-hidden">
        <Sidebar
          channels={channels}
          activeChannelName={activeChannelName}
          activeAgentRouteId={activeAgentRouteId}
          homeActive={location.pathname === '/home'}
          channelsCollapsed={channelsCollapsed}
          agentsCollapsed={agentsCollapsed}
          sidebarCollapsed={sidebarCollapsed}
          onToggleChannels={() => setChannelsCollapsed((current) => !current)}
          onToggleAgents={() => setAgentsCollapsed((current) => !current)}
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          onOpenHome={goHome}
          onSelectChannel={goWorkspace}
          onSelectAgent={goAgentFromSidebar}
        />
        <Outlet />
        <DemoControls />
      </div>
    </div>
  )
}

function BackBar({
  stackLabel,
  onStackBack,
  fallbackLabel,
  onFallback,
}: {
  stackLabel: string | null
  onStackBack: () => void
  fallbackLabel: string
  onFallback: () => void
}) {
  const useStack = stackLabel != null
  return (
    <div className="shrink-0 bg-[#f5f4f0] px-8 pt-4">
      <button
        type="button"
        onClick={useStack ? onStackBack : onFallback}
        className="nave-float nave-rise text-[13px] text-[#0f0f0f]"
      >
        ← {useStack ? stackLabel : fallbackLabel}
      </button>
    </div>
  )
}

function WorkspaceRoute() {
  const [searchParams, setSearchParams] = useSearchParams()
  const channelName = searchParams.get('channel') ?? 'frontend'
  const focusMessageId = searchParams.get('focusMessage')
  const navigate = useNavigate()
  const { pushBackAnchor } = useNavStack()
  const [workspaceHeaderCollapsed, setWorkspaceHeaderCollapsed] = useState(true)
  const storeAgents = useNaveStore((s) => s.agents)
  const allMessages = useNaveStore((s) => s.messages)
  const channelFocusAgent = useMemo(
    () => pickChannelFocusAgent(channelName, storeAgents),
    [channelName, storeAgents],
  )
  const setActiveChannel = useNaveStore((s) => s.setActiveChannel)

  useEffect(() => {
    setActiveChannel(channelName)
  }, [channelName, setActiveChannel])

  useEffect(() => {
    if (!focusMessageId) return
    const t = window.setTimeout(() => {
      document.getElementById(`feed-${focusMessageId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('focusMessage')
          return next
        },
        { replace: true },
      )
    }, 120)
    return () => window.clearTimeout(t)
  }, [focusMessageId, channelName, allMessages.length, setSearchParams])

  const openChannelAgent = (routeId: string) => {
    pushBackAnchor(`#${channelName}`)
    navigate(`/agent/${routeId}`)
  }

  const openChannelProcess = (processRouteId: string) => {
    pushBackAnchor(`#${channelName}`)
    navigate(`/process/${processRouteId}`)
  }

  const openRunLogFromFeed = () => {
    pushBackAnchor(`#${channelName}`)
    navigate('/process/proc-1')
  }

  return (
    <WorkspaceScreen
      channelFocusAgent={channelFocusAgent}
      selectedChannelName={channelName}
      headerCollapsed={workspaceHeaderCollapsed}
      onToggleHeader={() => setWorkspaceHeaderCollapsed((c) => !c)}
      onOpenAgent={() => {
        if (channelFocusAgent) openChannelAgent(channelFocusAgent.routeId)
      }}
      onOpenSubprocess={openChannelProcess}
      onSenderAgentNavigate={openChannelAgent}
      onCompletionViewRunLog={openRunLogFromFeed}
    />
  )
}

function HomeRoute() {
  const navigate = useNavigate()
  const activeChannel = useNaveStore((s) => s.activeChannel)
  const { pushBackAnchor, peekBackLabel, goBack, clearStack } = useNavStack()
  const backLabel = peekBackLabel()
  const fallbackChannelLabel = `#${activeChannel}`

  const goAgent = (routeId: string) => {
    pushBackAnchor('Home')
    navigate(`/agent/${routeId}`)
  }

  const goWorkspaceChannel = (channelKey: string, focusMessageId?: string) => {
    pushBackAnchor('Home')
    const params = new URLSearchParams()
    params.set('channel', channelKey)
    if (focusMessageId) params.set('focusMessage', focusMessageId)
    navigate(`/?${params.toString()}`)
  }

  const goFallbackWorkspace = () => {
    clearStack()
    navigate(`/?channel=${encodeURIComponent(activeChannel)}`)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <BackBar
        stackLabel={backLabel}
        onStackBack={goBack}
        fallbackLabel={fallbackChannelLabel}
        onFallback={goFallbackWorkspace}
      />
      <HomeScreen onOpenAgent={goAgent} onNavigateToChannel={goWorkspaceChannel} />
    </div>
  )
}

function AgentRoute() {
  const { agentId } = useParams<{ agentId: string }>()
  const storeAgent = useNaveStore((s) => (agentId ? s.agents[agentId] : undefined))
  const activeChannel = useNaveStore((s) => s.activeChannel)
  const { pushBackAnchor, peekBackLabel, goBack, clearStack } = useNavStack()
  const navigate = useNavigate()
  const backLabel = peekBackLabel()
  const fallbackChannelLabel = `#${activeChannel}`

  if (!storeAgent) return <Navigate to="/" replace />

  const goFallbackWorkspace = () => {
    clearStack()
    navigate(`/?channel=${encodeURIComponent(activeChannel)}`)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <BackBar
        stackLabel={backLabel}
        onStackBack={goBack}
        fallbackLabel={fallbackChannelLabel}
        onFallback={goFallbackWorkspace}
      />
      <AgentCockpitScreen
        key={storeAgent.id}
        agentId={storeAgent.id}
        onOpenSubprocess={(processRouteId) => {
          pushBackAnchor(storeAgent.name)
          navigate(`/process/${processRouteId}`)
        }}
      />
    </div>
  )
}

function ProcessRoute() {
  const { processId } = useParams<{ processId: string }>()
  const storeAgents = useNaveStore((s) => s.agents)
  const activeChannel = useNaveStore((s) => s.activeChannel)
  const setLastViewedProcessId = useNaveStore((s) => s.setLastViewedProcessId)
  const { peekBackLabel, goBack, pushBackAnchor, clearStack } = useNavStack()
  const navigate = useNavigate()
  const backLabel = peekBackLabel()
  const fallbackChannelLabel = `#${activeChannel}`

  const goFallbackWorkspace = () => {
    clearStack()
    navigate(`/?channel=${encodeURIComponent(activeChannel)}`)
  }

  const ctx = useMemo(
    () => resolveProcessFromStore(processId, storeAgents),
    [processId, storeAgents],
  )

  useEffect(() => {
    if (processId) setLastViewedProcessId(processId)
  }, [processId, setLastViewedProcessId])

  if (!ctx) return <Navigate to="/" replace />

  const { agent, sub } = ctx
  const legacyAgent = buildLegacyAgentShell(agent)
  const legacySub = storeSubToLegacy(sub)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <BackBar
        stackLabel={backLabel}
        onStackBack={goBack}
        fallbackLabel={fallbackChannelLabel}
        onFallback={goFallbackWorkspace}
      />
      <SubprocessDetailScreen
        key={`${agent.id}:${sub.id}`}
        agent={legacyAgent}
        subprocess={legacySub}
        onOpenAgentCockpit={() => {
          pushBackAnchor(sub.name)
          navigate(`/agent/${agent.id}`)
        }}
      />
    </div>
  )
}

function App() {
  return <AppShell />
}

function humanInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

/** Speaker cue: avatar + name hue only — no blocks (feeds stay flat on channel paper). */
function humanLaneForAuthor(authorId: string): {
  avatarBg: string
  avatarText: string
  name: string
} {
  switch (authorId) {
    case 'maya':
      return {
        avatarBg: 'bg-[#ede4d8]',
        avatarText: 'text-[#4a3428]',
        name: 'text-[#5c3d2e]',
      }
    case 'jon':
      return {
        avatarBg: 'bg-[#dfe7ee]',
        avatarText: 'text-[#2a3a48]',
        name: 'text-[#2f3d4c]',
      }
    case 'elise':
      return {
        avatarBg: 'bg-[#dde8e1]',
        avatarText: 'text-[#1e3d30]',
        name: 'text-[#254033]',
      }
    default:
      return {
        avatarBg: 'bg-[#e8e8e8]',
        avatarText: 'text-[#2a2a2a]',
        name: 'text-[#0f0f0f]',
      }
  }
}

function HumanFeedRow({ msg }: { msg: FeedMessage }) {
  const inits = humanInitials(msg.authorName)
  if (msg.authorId === DEMO_HUMAN_AUTHOR.id) {
    return (
      <article
        className="nave-enter flex w-full justify-end"
        aria-label={`Your message at ${msg.timestamp}`}
      >
        <div className="flex max-w-[min(92%,30rem)] flex-row-reverse items-start gap-3">
          <div className="shrink-0 self-start" aria-hidden>
            <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#002FA7] text-[13px] font-medium leading-none text-white">
              {inits}
            </div>
          </div>
          <div className="min-w-0 rounded-[12px] rounded-br-[4px] border border-[#9eb6d9] bg-[#d4e1f4] px-3.5 py-2.5">
            <div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0">
              <p className="m-0 text-[13px] font-medium text-[#002FA7]">{msg.authorName}</p>
              <p className="m-0 text-[13px] uppercase tracking-[0.08em] text-[#5a7194]">
                {msg.timestamp}
              </p>
            </div>
            <p className="m-0 mt-1 text-[14px] leading-[1.65] text-[#1a2332]">{msg.text}</p>
          </div>
        </div>
      </article>
    )
  }

  const lane = humanLaneForAuthor(msg.authorId)
  return (
    <article
      className="nave-float flex gap-3"
      aria-label={`Message from ${msg.authorName} at ${msg.timestamp}`}
    >
      <div className="shrink-0">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-[4px] text-[13px] font-medium leading-none ${lane.avatarBg} ${lane.avatarText}`}
          aria-hidden
        >
          {inits}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <p className={`m-0 text-[13px] font-medium ${lane.name}`}>{msg.authorName}</p>
          <p className="m-0 text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">{msg.timestamp}</p>
        </div>
        <p className="m-0 mt-0.5 max-w-3xl text-[14px] leading-[1.65] text-[#303030]">{msg.text}</p>
      </div>
    </article>
  )
}

const CHANNEL_FEED_BOTTOM_THRESHOLD_PX = 48
/** Scroll-height growth past this uses smooth pin when stuck to bottom (e.g. new agent message). */
const CHANNEL_FEED_SMOOTH_PIN_GROW_PX = 72

function useChannelFeedAutoScroll(channelId: string) {
  const feedScrollRef = useRef<HTMLElement | null>(null)
  const feedContentRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const prevScrollHeightRef = useRef(0)

  const onFeedScroll = useCallback(() => {
    const el = feedScrollRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = dist <= CHANNEL_FEED_BOTTOM_THRESHOLD_PX
  }, [])

  useLayoutEffect(() => {
    stickToBottomRef.current = true
    prevScrollHeightRef.current = 0
  }, [channelId])

  useEffect(() => {
    const scrollEl = feedScrollRef.current
    const contentEl = feedContentRef.current
    if (!scrollEl || !contentEl) return

    const pinIfStuck = () => {
      if (!stickToBottomRef.current) return
      const sh = scrollEl.scrollHeight
      const ch = scrollEl.clientHeight
      const targetTop = Math.max(0, sh - ch)
      const prev = prevScrollHeightRef.current
      const delta = prev === 0 ? 0 : sh - prev
      prevScrollHeightRef.current = sh

      const reduceMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (reduceMotion || prev === 0 || delta <= CHANNEL_FEED_SMOOTH_PIN_GROW_PX) {
        scrollEl.scrollTop = targetTop
        return
      }

      scrollEl.scrollTo({ top: targetTop, behavior: 'smooth' })
    }

    const ro = new ResizeObserver(pinIfStuck)
    ro.observe(contentEl)
    pinIfStuck()

    return () => ro.disconnect()
  }, [channelId])

  const scrollFeedToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    stickToBottomRef.current = true
    requestAnimationFrame(() => {
      const el = feedScrollRef.current
      if (!el) return
      const top = Math.max(0, el.scrollHeight - el.clientHeight)
      prevScrollHeightRef.current = el.scrollHeight
      el.scrollTo({ top, behavior })
    })
  }, [])

  return { feedScrollRef, feedContentRef, onFeedScroll, scrollFeedToBottom }
}

function PatchAckSkeletonRow() {
  return (
    <article
      className="nave-enter flex w-full items-start gap-3"
      aria-busy="true"
      aria-label="Patch is preparing a reply"
    >
      <div
        className="h-9 w-9 shrink-0 rounded-[4px] bg-[#d9d6cf] motion-safe:animate-pulse motion-reduce:animate-none"
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span
            className="h-3.5 w-[4.5rem] rounded bg-[#d9d6cf] motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
          <span
            className="h-3 w-10 rounded bg-[#e3e0d8] motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
          <span
            className="h-3 w-12 rounded bg-[#e3e0d8] motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
        </header>
        <div className="space-y-2">
          <div
            className="h-3.5 w-full max-w-xl rounded bg-[#e8e5de] motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
          <div
            className="h-3.5 w-[92%] max-w-lg rounded bg-[#e8e5de] motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
        </div>
        <p className="m-0 mt-2 text-[13px] text-[#9a9a9a]">Patch is replying…</p>
      </div>
    </article>
  )
}

function WorkspaceFeedList({
  channelId,
  onOpenSubprocess,
  onSenderNavigate,
  onCompletionViewRunLog,
}: {
  channelId: string
  onOpenSubprocess: (processRouteId: string) => void
  onSenderNavigate: (agentRouteId: string) => void
  onCompletionViewRunLog: () => void
}) {
  const allMessages = useNaveStore((s) => s.messages)
  const messages = useMemo(
    () => allMessages.filter((m) => m.channelId === channelId),
    [allMessages, channelId],
  )
  const permissionCardStates = useNaveStore((s) => s.permissionCardStates)
  const storeAgents = useNaveStore((s) => s.agents)
  const permissionApprove = useNaveStore((s) => s.permissionApprove)
  const permissionDeny = useNaveStore((s) => s.permissionDeny)
  const permissionAlwaysAllow = useNaveStore((s) => s.permissionAlwaysAllow)
  const permissionAlwaysAllowConfirm = useNaveStore((s) => s.permissionAlwaysAllowConfirm)
  const permissionAlwaysAllowCancel = useNaveStore((s) => s.permissionAlwaysAllowCancel)

  if (messages.length === 0) {
    return (
      <p className="text-[13px] text-[#5f5f5f]">No messages in this channel yet.</p>
    )
  }

  return (
    <>
      {messages.map((msg) => (
        <div key={msg.id} id={`feed-${msg.id}`}>
          <FeedMessageItem
            msg={msg}
            cardState={msg.permissionCard ? (permissionCardStates[msg.id] ?? 'pending') : undefined}
            liveAgentStatus={
              msg.type === 'agent' ? (storeAgents[msg.authorId]?.status ?? 'idle') : undefined
            }
            permissionActions={
              msg.permissionCard
                ? {
                    onApprove: () => permissionApprove(msg.id),
                    onDeny: () => permissionDeny(msg.id),
                    onAlwaysAllow: () => permissionAlwaysAllow(msg.id),
                    onAlwaysAllowConfirm: () => permissionAlwaysAllowConfirm(msg.id),
                    onAlwaysAllowCancel: () => permissionAlwaysAllowCancel(msg.id),
                  }
                : undefined
            }
            onOpenSubprocess={onOpenSubprocess}
            onSenderNavigate={onSenderNavigate}
            onCompletionViewRunLog={onCompletionViewRunLog}
          />
        </div>
      ))}
    </>
  )
}

function FeedMessageItem({
  msg,
  cardState,
  liveAgentStatus,
  permissionActions,
  onOpenSubprocess,
  onSenderNavigate,
  onCompletionViewRunLog,
}: {
  msg: FeedMessage
  cardState?: PermissionCardState
  liveAgentStatus?: AgentStatus
  permissionActions?: PermissionCardInteractionHandlers
  onOpenSubprocess: (processRouteId: string) => void
  onSenderNavigate: (agentRouteId: string) => void
  onCompletionViewRunLog: () => void
}) {
  const storeAgentRow = useNaveStore((s) => s.agents[msg.authorId])

  if (msg.type === 'human') {
    return <HumanFeedRow msg={msg} />
  }

  if (msg.type === 'agent') {
    const initials = storeAgentRow
      ? cockpitInitials(storeAgentRow.id, storeAgentRow.name)
      : 'AG'
    const status = liveAgentStatus ?? storeAgentRow?.status ?? 'idle'

    const body =
      msg.paragraphs && msg.paragraphs.length > 0 ? (
        <>
          {msg.paragraphs.map((para, i) => (
            <p key={`${msg.id}-p-${i}`} className={`m-0 ${i > 0 ? 'mt-1' : ''}`}>
              {para}
            </p>
          ))}
        </>
      ) : (
        <p className="m-0">{msg.text}</p>
      )

    const subprocessList = feedMessageSubprocesses(msg)
    const subprocessBlock =
      subprocessList.length > 0 ? (
        <div className="mt-2 space-y-2">
          {subprocessList.map((sub: FeedSubprocessPayload) => {
            const live = feedSubprocessLiveView(sub, storeAgentRow)
            const isRunning = live.status === 'running'
            const paper = sub.integration === 'paper-mcp'
            const surfaceRunning = paper
              ? 'border-[#d8cfc0] bg-[#f2ede4] hover:bg-[#e8e1d6]'
              : 'border-[#c5cee0] bg-[#e8ecf6] hover:bg-[#dde4f2]'
            const surfaceTerminal =
              live.status === 'completed'
                ? 'border-[#aec9a8] bg-[#e8f1e6] hover:bg-[#dde9da]'
                : live.status === 'failed'
                  ? 'border-[#e0b4b4] bg-[#fbecec] hover:bg-[#f5dede]'
                  : 'border-[#ddcfb8] bg-[#f3ebdd] hover:bg-[#ebe2d2]'

            const ariaLabel = isRunning
              ? `${sub.name}, running, ${live.pct}%`
              : `${sub.name}, ${live.status}, open run log`

            return (
              <button
                key={`${msg.id}-${sub.routeId}`}
                type="button"
                onClick={() => onOpenSubprocess(sub.routeId)}
                aria-label={ariaLabel}
                className={`nave-float block w-full rounded-[6px] border px-4 text-left transition-colors motion-reduce:transition-none ${
                  isRunning ? `${surfaceRunning} py-2.5` : `${surfaceTerminal} py-2.5`
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium uppercase leading-none tracking-[0.1em] text-[#7a756c]">
                      Sub-process
                      {paper ? (
                        <span className="ml-1.5 font-mono normal-case tracking-normal text-[#5c4f38]">
                          · Paper MCP
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-[13px] font-semibold leading-snug tracking-[-0.01em] text-[#141414]">
                      {sub.name}
                    </p>
                  </div>
                  {isRunning ? (
                    <p className="max-w-[11rem] shrink-0 text-right text-[13px] leading-snug text-[#5a5a5a]">
                      {sub.subtitle}
                    </p>
                  ) : (
                    <StatusPillDarkText status={live.status} />
                  )}
                </div>
                {isRunning && live.planMeta ? (
                  <p className="mt-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-[#5f6880]">
                    {live.planMeta}
                  </p>
                ) : null}
                {isRunning && live.phaseLabel ? (
                  <p className="mt-0.5 text-[13px] leading-[1.45] text-[#3a3a3a]">
                    {truncateFeedPhase(live.phaseLabel)}
                  </p>
                ) : null}
                {isRunning ? (
                  <>
                    <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[13px] font-medium uppercase tracking-[0.06em] text-[#6f6f6f]">
                      <span>Running</span>
                      <span className="tabular-nums tracking-tight text-[#1f1f1f]">{live.pct}%</span>
                    </div>
                    <div
                      className="mt-1 h-1 overflow-hidden rounded-[2px] bg-[#d4d2cc]/90"
                      role="progressbar"
                      aria-valuenow={live.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${sub.name} progress`}
                    >
                      <div
                        className={`h-full rounded-[2px] transition-[width] duration-300 ease-out motion-reduce:transition-none ${
                          paper ? 'bg-[#6b5e48]' : 'bg-[#002FA7]'
                        }`}
                        style={{ width: `${live.pct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="mt-1.5 text-[13px] leading-snug text-[#5c5c5c]">
                    {live.milestoneCount
                      ? `${live.milestoneCount} milestone${live.milestoneCount === 1 ? '' : 's'} · `
                      : ''}
                    Open for full run log
                  </p>
                )}
              </button>
            )
          })}
        </div>
      ) : null

    const permissionBlock =
      msg.permissionCard && cardState ? (
        <div className="mt-3">
          <PermissionCard
            state={cardState}
            actionTitle={msg.permissionCard.actionTitle}
            resource={msg.permissionCard.resource}
            description={msg.permissionCard.description}
            policyAgentName={msg.permissionCard.policyAgentName}
            policyPathGlob={msg.permissionCard.policyPathGlob}
            actions={permissionActions}
          />
        </div>
      ) : null

    const completionBlock = msg.completionCard ? (
      <div
        className="mt-3"
        onClickCapture={(e) => {
          const btn = (e.target as HTMLElement).closest('button')
          if (btn && btn.textContent?.includes('View run log')) {
            e.preventDefault()
            e.stopPropagation()
            onCompletionViewRunLog()
          }
        }}
      >
        <CompletionCard
          state={msg.completionCard.state}
          taskName={msg.completionCard.taskName}
          stats={msg.completionCard.stats}
        />
      </div>
    ) : null

    return (
      <div className="nave-enter w-full">
        <MockFeedMessage
          variant="agent"
          density="feed"
          avatar={
            <Avatar
              size="sm"
              initials={initials}
              status={status}
              className={storeAgentRow?.avatarClassName ?? 'bg-[#002FA7] text-white'}
            />
          }
          senderName={msg.authorName}
          senderTag="agent"
          timestamp={msg.timestamp}
          timestampDateTime={msg.timestampDateTime}
          onSenderNameClick={() => onSenderNavigate(msg.authorId)}
          agentMessage={
            <>
              {body}
              {subprocessBlock}
            </>
          }
          continuingLine={msg.continuingLine}
        >
          {permissionBlock}
          {completionBlock}
        </MockFeedMessage>
      </div>
    )
  }

  return null
}

function Sidebar({
  channels,
  activeChannelName,
  activeAgentRouteId,
  homeActive,
  channelsCollapsed,
  agentsCollapsed,
  sidebarCollapsed,
  onToggleChannels,
  onToggleAgents,
  onToggleSidebar,
  onOpenHome,
  onSelectChannel,
  onSelectAgent,
}: {
  channels: Channel[]
  activeChannelName: string | null
  activeAgentRouteId: string | null
  /** Mission control — warm row highlight, not IKB (distinct from channel focus). */
  homeActive: boolean
  channelsCollapsed: boolean
  agentsCollapsed: boolean
  sidebarCollapsed: boolean
  onToggleChannels: () => void
  onToggleAgents: () => void
  onToggleSidebar: () => void
  onOpenHome: () => void
  onSelectChannel: (name: string) => void
  onSelectAgent: (agentRouteId: string) => void
}) {
  const storeAgents = useNaveStore((s) => s.agents)

  if (sidebarCollapsed) {
    return (
      <aside className="flex h-full min-h-0 w-[48px] shrink-0 flex-col items-center border-r border-[var(--nave-sidebar-border)] bg-[var(--nave-sidebar-bg)]">
        {/* Monogram */}
        <div className="flex h-[73px] shrink-0 items-center justify-center">
          <span className="select-none text-[13px] font-semibold tracking-[-0.02em] text-[#f5f4f0]">N</span>
        </div>
        <div className="w-6 border-t border-[var(--nave-sidebar-border)]" />
        {/* Expand button */}
        <div className="mt-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Expand sidebar"
            className="nave-float nave-rise-dark group flex h-8 w-8 items-center justify-center rounded-[5px] border border-[var(--nave-sidebar-border)] bg-[var(--nave-sidebar-hover)] text-[var(--nave-sidebar-text-muted)] transition-colors hover:border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#f5f4f0]"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.75" y="1.75" width="11.5" height="11.5" rx="1.75" />
              <line x1="5.25" y1="1.75" x2="5.25" y2="13.25" />
              <path d="M7 5.5L9 7.5L7 9.5" />
            </svg>
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 w-[260px] shrink-0 flex-col border-r border-[var(--nave-sidebar-border)] bg-[var(--nave-sidebar-bg)] text-[#f5f4f0]">
      <div className="border-b border-[var(--nave-sidebar-border)] px-6 py-6">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] uppercase tracking-[0.08em] text-[var(--nave-sidebar-text-muted)]">
              Workspace
            </p>
            <h1 className="mt-3 text-[13px] font-medium tracking-[-0.02em]">Nave</h1>
            <p className="mt-2 text-[13px] text-[var(--nave-sidebar-subtle)]">
              16 members. 3 active agents.
            </p>
            <p className="mt-3 max-w-[14rem] text-[12px] leading-[1.45] text-[var(--nave-sidebar-text-muted)]">
              Surfaces ease into place—cards and drawers settle, they don&apos;t snap.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleSidebar}
            title="Collapse sidebar"
            className="nave-float nave-rise-dark mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border border-transparent text-[var(--nave-sidebar-text-muted)] transition-colors hover:border-[var(--nave-sidebar-border)] hover:bg-[var(--nave-sidebar-hover)] hover:text-[#f5f4f0]"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.75" y="1.75" width="11.5" height="11.5" rx="1.75" />
              <line x1="5.25" y1="1.75" x2="5.25" y2="13.25" />
              <path d="M8 5.5L6 7.5L8 9.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <section>
          <button
            type="button"
            onClick={onOpenHome}
            aria-current={homeActive ? 'page' : undefined}
            className={`nave-float nave-rise-dark flex w-full items-center justify-between rounded-[4px] border px-3 py-2 text-left ${
              homeActive
                ? 'border-[var(--nave-sidebar-row-active-border)] bg-[var(--nave-sidebar-row-active)] text-[#f5f4f0]'
                : 'border-transparent text-[var(--nave-sidebar-text-secondary)] hover:border-[var(--nave-sidebar-border)] hover:bg-[var(--nave-sidebar-hover)]'
            }`}
          >
            <span className="font-medium">Home</span>
            <span
              className={`text-[13px] uppercase tracking-[0.08em] ${
                homeActive ? 'text-[var(--nave-sidebar-subtle)]' : 'text-[var(--nave-sidebar-text-muted)]'
              }`}
            >
              All
            </span>
          </button>
        </section>

        <div className="my-6 h-px bg-[var(--nave-sidebar-border)]" />

        <section>
          <button
            type="button"
            onClick={onToggleChannels}
            className="nave-float nave-rise-dark flex w-full items-center justify-between px-2 text-left text-[13px] uppercase tracking-[0.08em] text-[var(--nave-sidebar-text-muted)] hover:text-[var(--nave-sidebar-text-secondary)]"
          >
            <span>Channels</span>
            <span>{channelsCollapsed ? '+' : '-'}</span>
          </button>
          {!channelsCollapsed ? (
            <div className="mt-3 space-y-1">
              {channels.map((channel) => {
                const active = activeChannelName !== null && channel.name === activeChannelName

                return (
                  <button
                    key={channel.name}
                    className={`nave-float nave-rise-dark flex w-full items-center justify-between rounded-[4px] border px-3 py-2 text-left ${
                      active
                        ? 'border-[#002FA7] bg-[#161b2b] text-[#f5f4f0]'
                        : 'border-transparent text-[var(--nave-sidebar-text-secondary)] hover:border-[var(--nave-sidebar-border)] hover:bg-[var(--nave-sidebar-hover)]'
                    }`}
                    onClick={() => onSelectChannel(channel.name)}
                    type="button"
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-[var(--nave-sidebar-subtle)]">#</span>
                      <span>{channel.name}</span>
                    </span>
                    {channel.unread ? (
                      <span className="h-2 w-2 rounded-full bg-[#002FA7]" aria-hidden="true" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </section>

        <div className="my-6 h-px bg-[var(--nave-sidebar-border)]" />

        <section>
          <button
            type="button"
            onClick={onToggleAgents}
            className="nave-float nave-rise-dark flex w-full items-center justify-between px-2 text-left text-[13px] uppercase tracking-[0.08em] text-[var(--nave-sidebar-text-muted)] hover:text-[var(--nave-sidebar-text-secondary)]"
          >
            <span>Agents</span>
            <span>{agentsCollapsed ? '+' : '-'}</span>
          </button>
          {!agentsCollapsed ? (
            <div className="mt-3 space-y-2">
              {MISSION_AGENT_CARD_ORDER.map((routeId) => {
                const agent = storeAgents[routeId]
                if (!agent) return null
                const active = activeAgentRouteId !== null && routeId === activeAgentRouteId
                const initials = cockpitInitials(agent.id, agent.name)

                return (
                  <button
                    key={routeId}
                    className={`nave-float nave-rise-dark flex w-full items-start gap-3 rounded-[6px] border px-3 py-3 text-left ${
                      active
                        ? 'border-[var(--nave-sidebar-row-active-border)] bg-[var(--nave-sidebar-row-active)]'
                        : 'border-transparent hover:border-[var(--nave-sidebar-border)] hover:bg-[var(--nave-sidebar-hover)]'
                    }`}
                    onClick={() => onSelectAgent(routeId)}
                    type="button"
                  >
                    <Avatar
                      initials={initials}
                      status={agent.status}
                      className={agent.avatarClassName}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium">{agent.name}</p>
                        <StatusPill status={agent.status} />
                      </div>
                      <p className="mt-1 text-[13px] text-[var(--nave-sidebar-subtle)]">{agent.role}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}
        </section>
      </div>

      <div className="border-t border-[var(--nave-sidebar-border)] px-4 py-4">
        <button
          type="button"
          className="nave-float nave-rise-dark flex w-full items-center gap-3 rounded-[6px] border border-transparent px-2 py-2 text-left hover:border-[var(--nave-sidebar-border)] hover:bg-[var(--nave-sidebar-hover)]"
        >
          <div className="relative h-9 w-9 shrink-0 rounded-[4px] bg-[var(--nave-sidebar-user-avatar)] text-center text-[13px] leading-9 text-[#f5f4f0]">
            ZG
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[var(--nave-sidebar-bg)] bg-[#4f8f42]" />
          </div>
          <div>
            <p className="font-medium">Zhiyuan</p>
            <p className="text-[13px] text-[var(--nave-sidebar-subtle)]">online</p>
          </div>
        </button>
      </div>
    </aside>
  )
}

function WorkspaceScreen({
  channelFocusAgent,
  selectedChannelName,
  headerCollapsed,
  onToggleHeader,
  onOpenAgent,
  onOpenSubprocess,
  onSenderAgentNavigate,
  onCompletionViewRunLog,
}: {
  channelFocusAgent: Agent | null
  selectedChannelName: string
  headerCollapsed: boolean
  onToggleHeader: () => void
  onOpenAgent: () => void
  onOpenSubprocess: (processRouteId: string) => void
  onSenderAgentNavigate: (agentRouteId: string) => void
  onCompletionViewRunLog: () => void
}) {
  const [completionNoticeOpen, setCompletionNoticeOpen] = useState(false)
  const messages = useNaveStore((s) => s.messages)
  const agents = useNaveStore((s) => s.agents)
  const permissionCardStates = useNaveStore((s) => s.permissionCardStates)
  const headerMetrics = useMemo(
    () => selectWorkspaceHeaderMetrics({ messages, agents, permissionCardStates }),
    [messages, agents, permissionCardStates],
  )
  const workspaceMetrics = useMemo(
    () => [
      { label: 'Sub-processes', value: headerMetrics.subProcesses },
      { label: 'Pending approvals', value: headerMetrics.pendingApprovals },
      { label: 'Queue priority', value: headerMetrics.queuePriority },
    ],
    [headerMetrics],
  )
  const completionBanner = useMemo(
    () => selectLatestFrontendCompletionBanner({ messages }),
    [messages],
  )
  const bannerExpanded = Boolean(completionBanner) && completionNoticeOpen
  const [composerDraft, setComposerDraft] = useState('')
  const sendChannelMessage = useNaveStore((s) => s.sendChannelMessage)
  const frontendDemoAwaitingAssignment = useNaveStore((s) => s.frontendDemoAwaitingAssignment)
  const frontendPatchAckPending = useNaveStore((s) => s.frontendPatchAckPending)
  const { feedScrollRef, feedContentRef, onFeedScroll, scrollFeedToBottom } =
    useChannelFeedAutoScroll(selectedChannelName)

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-b border-[#d4d0c8] bg-[#f5f4f0] px-8 py-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[13px] font-medium tracking-[-0.02em]">#{selectedChannelName}</h2>
              {channelFocusAgent ? (
                <>
                  <span className="rounded-[3px] border border-[#d4d0c8] px-2 py-1 text-[13px] text-[#5f5f5f]">
                    Focus: `{channelFocusAgent.name}`
                  </span>
                  <span className="text-[13px] text-[#5f5f5f]">
                    {channelFocusAgent.subProcessCount} tracked sub-processes
                  </span>
                </>
              ) : (
                <span className="rounded-[3px] border border-[#d4d0c8] px-2 py-1 text-[13px] text-[#5f5f5f]">
                  No agent stationed in this channel
                </span>
              )}
            </div>

            <div
              className={`workspace-header-drawer ${headerCollapsed ? 'is-closed' : `is-open mt-3`}`}
            >
              <div className="workspace-header-drawer-inner">
                <div className="workspace-header-drawer-content">
                  <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                    About this channel
                  </p>
                  <p className="mt-2 max-w-2xl text-[13px] text-[#5f5f5f]">
                    {channelSummaries[selectedChannelName] ?? channelSummaries.general}
                  </p>
                  {channelFocusAgent ? (
                    <>
                      <p className="mt-4 text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                        Current task · {channelFocusAgent.name}
                      </p>
                      <p className="mt-2 max-w-2xl text-[13px] text-[#5f5f5f]">
                        {channelFocusAgent.currentTask}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            {channelFocusAgent ? (
              <div
                className={`workspace-header-drawer ${headerCollapsed ? 'is-open' : 'is-closed'} ${headerCollapsed ? 'mt-3' : ''}`}
              >
                <div className="workspace-header-drawer-inner">
                  <div className="workspace-header-drawer-content min-w-0">
                    <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                      Current task · {channelFocusAgent.name}
                    </p>
                    <p className="mt-1 truncate text-[13px] leading-5 text-[#5f5f5f]">
                      {channelFocusAgent.currentTask}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-start gap-3">
            <button
              type="button"
              onClick={onToggleHeader}
              className="nave-float nave-rise rounded-[4px] border border-[#d4d0c8] px-3 py-2 text-[13px] text-[#0f0f0f] hover:bg-[#ebebeb]"
            >
              {headerCollapsed ? 'Expand header' : 'Collapse header'}
            </button>
            <button
              type="button"
              onClick={onOpenAgent}
              disabled={!channelFocusAgent}
              className="nave-float nave-rise rounded-[4px] border border-[#d4d0c8] px-4 py-2 text-[13px] text-[#0f0f0f] enabled:hover:bg-[#ebebeb] disabled:cursor-not-allowed disabled:opacity-40"
            >
              View agent
            </button>
            <button
              type="button"
              className="nave-float nave-rise rounded-[4px] bg-[#002FA7] px-4 py-2 text-[13px] text-white hover:bg-[#001254]"
            >
              + Assign task
            </button>
          </div>
        </div>

        <div
          className={`workspace-header-drawer ${headerCollapsed ? 'is-closed' : `is-open mt-6`}`}
        >
          <div className="workspace-header-drawer-inner">
            <div className="workspace-header-drawer-content grid grid-cols-3 gap-3">
              {workspaceMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="nave-surface rounded-[6px] border border-[#d4d0c8] hover:border-[#bfbab0] px-4 py-3"
                >
                  <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">{metric.label}</p>
                  <p className="mt-2 text-[13px] font-medium tracking-[-0.01em] text-[#0f0f0f]">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

        <div
          key={selectedChannelName}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
        >
        {completionBanner && selectedChannelName === 'frontend' ? (
          <div className="nave-enter nave-float border-b border-[#cfd7eb] bg-[#eef3ff] px-8 py-2.5 transition-colors">
            <div className="flex flex-wrap items-center justify-between gap-3">
            {bannerExpanded ? (
              <>
                <p className="text-[13px] text-[#303030]">
                  <span className="font-medium text-[#0f0f0f]">Patch</span> completed{' '}
                  {completionBanner.taskName}. {completionBanner.filesLabel} in{' '}
                  {completionBanner.durationSnippet}.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="nave-float nave-rise text-[13px] text-[#002FA7] underline underline-offset-4"
                  >
                    View diff -&gt;
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompletionNoticeOpen(false)}
                    className="nave-float nave-rise text-[13px] text-[#5f5f5f] underline underline-offset-4"
                  >
                    Hide
                  </button>
                </div>
              </>
            ) : (
                <>
                  <p className="text-[13px] text-[#5f5f5f]">
                    <span className="font-medium text-[#0f0f0f]">Completion</span>
                    {' · '}
                    Patch · {completionBanner.taskName}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCompletionNoticeOpen(true)}
                    className="nave-float nave-rise text-[13px] text-[#002FA7] underline underline-offset-4"
                  >
                    Show details
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        <section
          ref={feedScrollRef}
          onScroll={onFeedScroll}
          className="min-h-0 flex-1 scroll-pb-8 overflow-y-auto overflow-x-hidden px-6 py-5"
        >
          <div ref={feedContentRef} className="mx-auto flex max-w-4xl flex-col gap-3">
            <WorkspaceFeedList
              channelId={selectedChannelName}
              onOpenSubprocess={onOpenSubprocess}
              onSenderNavigate={onSenderAgentNavigate}
              onCompletionViewRunLog={onCompletionViewRunLog}
            />
            {selectedChannelName === 'frontend' && frontendPatchAckPending ? (
              <PatchAckSkeletonRow />
            ) : null}
          </div>
        </section>

        <footer className="bg-[#f5f4f0] px-8 py-5">
          <div className="mx-auto max-w-4xl">
            
            <form
              className="nave-enter nave-float flex items-center gap-3 rounded-[6px] border border-[#d4d0c8] bg-white px-4 py-3 transition-colors"
              onSubmit={(e) => {
                e.preventDefault()
                sendChannelMessage(selectedChannelName, composerDraft)
                setComposerDraft('')
                scrollFeedToBottom('auto')
              }}
            >
              <input
                aria-label="Message channel or agent"
                className="w-full bg-transparent outline-none placeholder:text-[#9a9a9a]"
                placeholder="Message #channel or @agent..."
                type="text"
                value={composerDraft}
                onChange={(e) => setComposerDraft(e.target.value)}
              />
              <button
                type="submit"
                className="nave-float nave-rise rounded-[4px] border border-[#d4d0c8] px-4 py-2 text-[13px] text-[#0f0f0f] hover:bg-[#ebebeb]"
              >
                Send
              </button>
            </form>
          </div>
        </footer>
      </div>
    </main>
  )
}

function missionFeedEventBadgeKind(ev: MissionFeedEvent): ActivityKind {
  switch (ev.kind) {
    case 'completion':
      return 'completion'
    case 'permission':
      return 'permission'
    case 'agent-blocked':
    case 'permission-denied-running':
      return 'state'
    case 'task-assigned':
      return 'task'
  }
}

function missionFeedEventTitle(ev: MissionFeedEvent): string {
  switch (ev.kind) {
    case 'completion':
      return `${ev.agentName} · ${ev.taskName}`
    case 'permission':
      return `${ev.agentName} · permission (${ev.cardStateLabel})`
    case 'agent-blocked':
      return `${ev.agentName} is waiting for approval`
    case 'permission-denied-running':
      return `${ev.agentName} resumed after permission denial`
    case 'task-assigned':
      return `${ev.assignerName} → ${ev.agentName}`
  }
}

function missionFeedEventDetail(ev: MissionFeedEvent): string {
  switch (ev.kind) {
    case 'completion':
      return `Outcome ${ev.outcome} · ${ev.filesChanged} files changed`
    case 'permission':
      return ev.action
    case 'agent-blocked':
      return `Channel #${ev.channelId}`
    case 'permission-denied-running':
      return 'Agent returned to running.'
    case 'task-assigned':
      return ev.taskPreview
  }
}

function missionFeedNavigateTarget(ev: MissionFeedEvent): { channelId: string; messageId?: string } {
  switch (ev.kind) {
    case 'completion':
    case 'permission':
    case 'permission-denied-running':
      return { channelId: ev.channelId, messageId: ev.messageId }
    case 'agent-blocked':
      return { channelId: ev.channelId, messageId: ev.messageId }
    case 'task-assigned':
      return { channelId: ev.channelId, messageId: ev.messageId }
  }
}

function HomeScreen({
  onOpenAgent,
  onNavigateToChannel,
}: {
  onOpenAgent: (agentRouteId: string) => void
  onNavigateToChannel: (channelKey: string, focusMessageId?: string) => void
}) {
  const [activityFeedOpen, setActivityFeedOpen] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const messages = useNaveStore((s) => s.messages)
  const permissionCardStates = useNaveStore((s) => s.permissionCardStates)
  const storeAgents = useNaveStore((s) => s.agents)

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const pendingRows = useMemo(
    () => selectMissionControlPendingRows({ messages, permissionCardStates }),
    [messages, permissionCardStates],
  )
  const activityEvents = useMemo(
    () => selectMissionControlActivityFeed({ messages, agents: storeAgents, permissionCardStates }),
    [messages, storeAgents, permissionCardStates],
  )
  const latestEvent = activityEvents[0]

  const visibleAgentCount = MISSION_AGENT_CARD_ORDER.filter((id) => storeAgents[id] != null).length

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-b border-[#d4d0c8] bg-[#f5f4f0] px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Mission control</p>
            <h2 className="mt-3 text-[13px] font-medium tracking-[-0.02em]">Workspace overview</h2>
            <p className="mt-2 max-w-3xl text-[13px] text-[#5f5f5f]">
              A cross-workspace view of active agents, blocking approvals, and the events that need
              attention right now.
            </p>
          </div>
          <div className="nave-surface rounded-[4px] border border-[#d4d0c8] px-5 py-4 hover:border-[#bfbab0]">
            <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Open approvals</p>
            <p className="mt-2 text-[13px] font-medium tracking-[-0.01em] text-[#002FA7]">
              {String(pendingRows.length).padStart(2, '0')}
            </p>
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto grid max-w-[76rem] gap-8 xl:grid-cols-[1.42fr_minmax(17rem,0.66fr)] xl:gap-x-12">
          <div className="nave-stagger flex min-w-0 flex-col gap-10">
            <section className="min-w-0">
              <header className="border-b border-[#d4d0c8] pb-6">
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                      Active agents
                    </p>
                    <p className="mt-3 max-w-xl text-[13px] font-medium leading-snug tracking-[-0.02em]">
                      Who is working across the workspace.
                    </p>
                  </div>
                  <p className="text-[13px] text-[#5f5f5f]">{visibleAgentCount} agents visible</p>
                </div>
              </header>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                {MISSION_AGENT_CARD_ORDER.map((routeId) => {
                  const live = storeAgents[routeId]
                  if (!live) return null
                  const status = live.status
                  const lastHumanTouch = selectLastHumanTouchDetail(
                    { messages, agents: storeAgents },
                    routeId,
                  )
                  const runningFor = formatRunningLabel(live.currentTask.startedAt)
                  const initials = cockpitInitials(live.id, live.name)
                  return (
                    <button
                      key={live.id}
                      type="button"
                      onClick={() => onOpenAgent(live.id)}
                      className={`group nave-float nave-rise min-w-0 max-w-full rounded-[6px] border bg-white p-5 text-left ${
                        status === 'blocked'
                          ? 'border-[#d8b56a] hover:border-[#c4a85c]'
                          : 'border-[#d4d0c8] hover:border-[#8a8680]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                          {status === 'blocked' ? 'Needs attention' : 'Active'}
                        </p>
                        <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                          #{live.channel}
                        </p>
                      </div>
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <Avatar
                            initials={initials}
                            status={status}
                            className={live.avatarClassName}
                          />
                          <div className="min-w-0">
                            <p className="break-words font-medium text-[#0f0f0f] [overflow-wrap:anywhere]">
                              {live.name}
                            </p>
                            <p className="mt-1 break-words text-[13px] text-[#5f5f5f] [overflow-wrap:anywhere]">
                              {live.role}
                            </p>
                          </div>
                        </div>
                        <StatusPillDarkText status={status} />
                      </div>

                      <p className="mt-4 min-w-0 break-words text-[13px] leading-6 text-[#303030] [overflow-wrap:anywhere]">
                        {live.currentTask.description}
                      </p>

                      <div className="mt-5 min-w-0 border-t border-[#e8e6e1] pt-4">
                        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span className="shrink-0 text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                              Sub-processes
                            </span>
                            <span className="text-[13px] font-medium tabular-nums text-[#0f0f0f]">
                              {live.currentTask.subProcessCount}
                            </span>
                          </div>
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span className="shrink-0 text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                              Running
                            </span>
                            <span className="text-[13px] font-medium text-[#0f0f0f]">{runningFor}</span>
                          </div>
                        </div>

                        <div className="mt-4 min-w-0">
                          <HomeCardLastHumanTouch detail={lastHumanTouch} />
                        </div>

                        <p className="mt-3 text-[13px] font-medium text-[#5f5f5f] transition-colors group-hover:text-[#002FA7]">
                          Open cockpit →
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-8 xl:ml-1 xl:mt-14">
            <section className="nave-enter nave-surface rounded-[6px] border border-[#d8b56a] bg-[#fff8eb] p-6 xl:p-7 hover:border-[#c4a85c]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] uppercase tracking-[0.08em] text-[#8b6a28]">
                    Pending permission requests
                  </p>
                  <p className="mt-2 text-[13px] font-medium tracking-[-0.01em] text-[#0f0f0f]">
                    These need human attention now.
                  </p>
                </div>
                <p className="text-[13px] text-[#8b6a28]">{pendingRows.length} waiting</p>
              </div>

              <div className="mt-6 space-y-3">
                {pendingRows.length === 0 ? (
                  <p className="text-[13px] text-[#5f5f5f]">No pending permission requests.</p>
                ) : (
                  pendingRows.map((row) => {
                    const waitingMs = Math.max(0, nowMs - new Date(row.timestampDateTime).getTime())
                    return (
                      <button
                        key={row.messageId}
                        type="button"
                        onClick={() => onNavigateToChannel(row.channelId, row.messageId)}
                        className="nave-float nave-rise block w-full rounded-[6px] border border-[#ead8b0] bg-[#fdf4df] p-4 text-left hover:border-[#d4c49a]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="font-medium text-[#0f0f0f]">
                            {row.agentName} · #{row.channelId}
                          </p>
                          <p className="text-[13px] uppercase tracking-[0.08em] text-[#8b6a28]">
                            Waiting {formatStoreElapsedMs(waitingMs)}
                          </p>
                        </div>
                        <p className="mt-3 text-[13px] leading-6 text-[#5b4b2d]">{row.actionTitle}</p>
                        <div className="mt-3 rounded-[4px] border border-[#ead8b0] bg-[#fff8eb] px-3 py-2 font-mono text-[13px] text-[#6e5424]">
                          {row.resource}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            <section className="nave-enter nave-surface min-w-0 rounded-[4px] border border-[#d4d0c8] bg-[#f5f4f0] p-6 xl:p-7 hover:border-[#bfbab0]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                    Unified activity feed
                  </p>
                  <p className="mt-3 max-w-[18rem] text-[13px] font-medium leading-snug tracking-[-0.015em]">
                    Significant events across all channels.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActivityFeedOpen((open) => !open)}
                  className="nave-float nave-rise shrink-0 rounded-[4px] border border-[#d4d0c8] bg-white px-3 py-1.5 text-[13px] text-[#0f0f0f] hover:bg-[#ebebeb]"
                >
                  {activityFeedOpen ? 'Show less' : `Show full feed · ${activityEvents.length}`}
                </button>
              </div>

              {activityFeedOpen ? (
                <div className="mt-6 space-y-3">
                  {activityEvents.length === 0 ? (
                    <p className="text-[13px] text-[#5f5f5f]">No activity yet.</p>
                  ) : (
                    activityEvents.map((ev) => {
                      const target = missionFeedNavigateTarget(ev)
                      const isPendingPermission = ev.kind === 'permission' && ev.isPending
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onNavigateToChannel(target.channelId, target.messageId)}
                          className={`nave-surface nave-float nave-rise block w-full rounded-[6px] border bg-white p-4 text-left ${
                            ev.kind === 'completion'
                              ? 'border-[#bcd5c1] hover:border-[#9eb8a5]'
                              : isPendingPermission
                                ? 'border-[#d8b56a] hover:border-[#c4a85c]'
                                : ev.kind === 'permission'
                                  ? 'border-[#d4d0c8] hover:border-[#bfbab0]'
                                  : 'border-[#d4d0c8] hover:border-[#bfbab0]'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <ActivityBadge kind={missionFeedEventBadgeKind(ev)} />
                              <p className="font-medium text-[#0f0f0f]">{missionFeedEventTitle(ev)}</p>
                            </div>
                            <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                              {ev.displayTime}
                            </p>
                          </div>
                          <p className="mt-3 text-[13px] leading-6 text-[#303030]">
                            {missionFeedEventDetail(ev)}
                          </p>
                        </button>
                      )
                    })
                  )}
                </div>
              ) : (
                <div className="mt-5 border-t border-[#d4d0c8] pt-5">
                  <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Latest</p>
                  {latestEvent ? (
                    <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ActivityBadge kind={missionFeedEventBadgeKind(latestEvent)} />
                        <p className="min-w-0 text-[13px] leading-snug text-[#303030]">
                          {missionFeedEventTitle(latestEvent)}
                          <span className="whitespace-nowrap text-[#9a9a9a]">
                            {' '}
                            · {latestEvent.displayTime}
                          </span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[13px] text-[#5f5f5f]">No events yet.</p>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}

function AgentCockpitScreen({
  agentId,
  onOpenSubprocess,
}: {
  agentId: string
  onOpenSubprocess: (processRouteId: string) => void
}) {
  const messages = useNaveStore((s) => s.messages)
  const permissionCardStates = useNaveStore((s) => s.permissionCardStates)
  const agents = useNaveStore((s) => s.agents)
  const lastViewedProcessId = useNaveStore((s) => s.lastViewedProcessId)
  const storeAgent = agents[agentId]

  const taskHistoryRows = useMemo(
    () => selectCockpitTaskHistoryMerged({ messages, agents }, agentId),
    [messages, agents, agentId],
  )
  const memoryView = useMemo(
    () => selectCockpitMemoryMerged({ messages, agents, permissionCardStates }, agentId),
    [messages, agents, permissionCardStates, agentId],
  )

  const lastHumanTouch = useMemo(
    () => (agentId ? selectLastHumanTouchDetail({ messages, agents }, agentId) : null),
    [messages, agents, agentId],
  )

  if (!storeAgent) return null

  const initials = cockpitInitials(storeAgent.id, storeAgent.name)
  const runningFor =
    storeAgent.status === 'idle'
      ? 'Idle'
      : storeAgent.status === 'blocked'
        ? 'Blocked'
        : formatRunningLabel(storeAgent.currentTask.startedAt)
  const channelLabel = `#${storeAgent.channel}`
  const subProcesses = storeAgent.subProcesses

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="border-b border-[#d4d0c8] bg-[#f5f4f0] px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-start gap-4">
              <Avatar
                initials={initials}
                status={storeAgent.status}
                className={storeAgent.avatarClassName}
              />
              <div>
                <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">
                  Agent cockpit
                </p>
                <h2 className="mt-2 text-[13px] font-medium tracking-[-0.02em]">{storeAgent.name}</h2>
                <p className="mt-2 max-w-2xl text-[13px] text-[#5f5f5f]">{storeAgent.identitySummary}</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-3">
            <button
              type="button"
              className="nave-float nave-rise rounded-[4px] border border-[#d4d0c8] px-4 py-2 text-[13px] text-[#0f0f0f] hover:bg-[#ebebeb]"
            >
              View full run logs
            </button>
            <button
              type="button"
              className="nave-float nave-rise rounded-[4px] bg-[#002FA7] px-4 py-2 text-[13px] text-white hover:bg-[#001254]"
            >
              Assign new task
            </button>
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-8 py-8">
        <div className="nave-stagger mx-auto flex max-w-[72rem] flex-col gap-10 lg:gap-14">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(13.5rem,0.48fr)] lg:gap-10">
            <section className="nave-surface rounded-[6px] border border-[#d4d0c8] bg-[#f5f4f0] p-6 hover:border-[#bfbab0] lg:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Current task</p>
                  <p className="mt-3 max-w-3xl text-[13px] font-medium leading-snug tracking-[-0.02em]">
                    {storeAgent.currentTask.description}
                  </p>
                </div>
                <StatusPillDarkText status={storeAgent.status} />
              </div>
              <p className="mt-4 max-w-2xl text-[13px] leading-[1.65] text-[#5f5f5f]">{storeAgent.taskSummary}</p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Running" value={runningFor} />
                <MetricCard
                  label="Sub-processes"
                  value={String(storeAgent.currentTask.subProcessCount).padStart(2, '0')}
                />
                <MetricCard label="Channel" value={channelLabel} />
              </div>
            </section>

            <section className="nave-surface flex flex-col justify-between rounded-[4px] border border-[#d4d0c8] bg-[#f5f4f0] p-5 hover:border-[#bfbab0] lg:p-6">
              <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Identity</p>
              <dl className="mt-5 space-y-4">
                <IdentityRow label="Role" value={storeAgent.role} />
                <IdentityRow label="Lives in" value={channelLabel} />
                <IdentityRow label="Status" value={storeAgent.status} />
                <IdentityRow
                  label="Latest human message"
                  value={<LastHumanTouchIdentity value={lastHumanTouch} />}
                />
              </dl>
            </section>
          </div>

          <section className="border-t border-[#d4d0c8] pt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Sub-processes</p>
                <p className="mt-3 max-w-lg text-[13px] font-medium leading-snug tracking-[-0.01em]">
                  Ephemeral workers spawned from this run.
                </p>
              </div>
              <p className="text-[13px] text-[#5f5f5f]">{subProcesses.length} tracked in this run</p>
            </div>

            <div className="mt-7 space-y-3">
              {subProcesses.length > 0 ? (
                subProcesses.map((subprocess) => {
                  const subprocessStatus = subprocess.status
                  const recentlyViewed = lastViewedProcessId === subprocess.id
                  return (
                    <button
                      key={subprocess.id}
                      type="button"
                      onClick={() => onOpenSubprocess(subprocess.id)}
                      className={`nave-float nave-rise block w-full rounded-[6px] border border-[#d4d0c8] bg-white px-4 py-4 text-left hover:border-[#8a8680] ${
                        recentlyViewed ? 'border-l-[3px] border-l-[#b8b4ae] pl-[13px]' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-[#0f0f0f]">{subprocess.name}</p>
                          <p className="mt-1 text-[13px] text-[#5f5f5f]">
                            {subprocess.type}
                            {subprocess.integration === 'paper-mcp' ? (
                              <span className="ml-2 rounded-[3px] border border-[#c8b89a] px-1.5 py-0.5 font-mono text-[13px] text-[#5c4f38]">
                                Paper MCP
                              </span>
                            ) : null}
                            {' · '}
                            {formatStoreElapsedMs(subprocess.elapsedMs)}
                          </p>
                        </div>
                        <StatusPillDarkText status={subprocessStatus} />
                      </div>
                      <div className="mt-4 h-2 rounded-[3px] bg-[#ebebeb]">
                        <div
                          className={`h-full rounded-[3px] ${
                            subprocessStatus === 'completed'
                              ? 'bg-[#4f8f42]'
                              : subprocessStatus === 'killed'
                                ? 'bg-[#c18a26]'
                                : subprocessStatus === 'running'
                                  ? subprocess.integration === 'paper-mcp'
                                    ? 'bg-[#6b5e48]'
                                    : 'bg-[#002FA7]'
                                  : 'bg-[#9a9a9a]'
                          }`}
                          style={{ width: `${subprocess.progress}%` }}
                        />
                      </div>
                    </button>
                  )
                })
              ) : (
                <div className="nave-surface rounded-[6px] border border-[#d4d0c8] hover:border-[#bfbab0] bg-white px-4 py-4 text-[13px] text-[#5f5f5f]">
                  No active sub-processes.
                </div>
              )}
            </div>
          </section>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-12">
            <section className="nave-surface order-2 rounded-[6px] border border-[#d4d0c8] bg-[#f5f4f0] p-6 hover:border-[#bfbab0] lg:order-1">
              <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Task history</p>
              <div className="mt-6 space-y-2">
                {taskHistoryRows.map((task) => (
                  <div
                    key={task.key}
                    className="nave-surface grid gap-2 rounded-[4px] border border-[#d4d0c8] bg-white px-4 py-3.5 hover:border-[#bfbab0] sm:grid-cols-[1fr_auto_auto_auto]"
                  >
                    <p className="font-medium text-[#0f0f0f]">{task.name}</p>
                    <p className="text-[13px] text-[#5f5f5f]">{task.duration}</p>
                    <OutcomePill outcome={task.outcome} />
                    <p className="text-[13px] text-[#5f5f5f]">{task.filesChanged}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="nave-surface order-1 rounded-[4px] border border-[#d4d0c8] bg-[#f5f4f0] p-6 hover:border-[#bfbab0] lg:order-2 lg:pt-8">
              <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Memory summary</p>
              <div className="mt-5 space-y-5">
                <MemoryBlock title="Recent decisions" items={memoryView.recentDecisions} />
                <MemoryBlock title="Open threads" items={memoryView.openThreads} />
                <MemoryBlock title="Constraints" items={memoryView.constraints} />
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}

function SubprocessDetailScreen({
  agent,
  subprocess,
  onOpenAgentCockpit,
}: {
  agent: Agent
  subprocess: Agent['subprocesses'][number]
  onOpenAgentCockpit: () => void
}) {
  const footerTint =
    subprocess.status === 'running'
      ? 'border-[#cfd7eb] bg-[#eef3ff]'
      : subprocess.status === 'completed'
        ? 'border-[#bcd5c1] bg-[#f1f8f2]'
        : subprocess.status === 'killed'
          ? 'border-[#d8b56a] bg-[#fff8eb]'
          : subprocess.status === 'failed'
            ? 'border-[#d3b0b0] bg-[#f9efef]'
            : subprocess.status === 'blocked'
              ? 'border-[#d8b56a] bg-[#fff8eb]'
              : 'border-[#d4d0c8] bg-[#f0f0f0]'

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f5f4f0]">
      <header className="shrink-0 border-b border-[#d4d0c8] bg-[#f5f4f0] px-6 py-3 sm:px-8">
        <div className="mx-auto flex max-w-[40rem] flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenAgentCockpit}
            className="nave-float nave-rise group flex max-w-[min(100%,20rem)] items-center gap-2 border-0 bg-transparent p-0 text-left"
          >
            <Avatar size="sm" initials={agent.initials} status={agent.status} className={agent.avatarClassName} />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium uppercase tracking-[0.1em] text-[#9a9a9a]">
                Parent agent
              </span>
              <span className="mt-0.5 block truncate text-[13px] font-medium text-[#303030] group-hover:text-[#0f0f0f]">
                {agent.name}
              </span>
            </span>
          </button>
          <StatusPillDarkText status={subprocess.status} />
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-6 pb-10 pt-8 sm:px-8">
        <div className="mx-auto max-w-[40rem]">
          <header className="relative min-w-0 border-l-[4px] border-[#002FA7] pl-5 pr-2">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#002FA7]">
              Sub-process run
            </p>
            <h1 className="mt-2 text-[1.625rem] font-semibold leading-[1.2] tracking-[-0.035em] text-[#0f0f0f] sm:text-[1.875rem]">
              {subprocess.name}
            </h1>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-[#5f5f5f]">
              <span className="font-semibold tabular-nums text-[#0f0f0f]">{subprocess.log.length}</span>
              <span>steps recorded</span>
              <span className="hidden text-[#d4cfc6] sm:inline" aria-hidden>
                ·
              </span>
              <span className="tabular-nums">{subprocess.type}</span>
              <span className="text-[#d4cfc6]" aria-hidden>
                ·
              </span>
              <span className="tabular-nums">{subprocess.elapsed}</span>
            </p>
          </header>

          <section aria-label="Step timeline" className="mt-8 min-w-0">
            <div className="inline-flex flex-wrap items-center gap-1.5">
              <p className="m-0 text-[13px] font-medium uppercase tracking-[0.1em] text-[#7a756c]">
                What it did
              </p>
              <div className="group relative z-10 inline-flex">
                <span id={`subprocess-step-legend-${subprocess.id}`} className="sr-only">
                  Each row is one step. The tag and colored left edge match the kind: Read (sources or
                  files), Write (changes), Analyze (reasoning), Spawn (child work), MCP (tool or Paper
                  MCP calls).
                </span>
                <button
                  type="button"
                  aria-describedby={`subprocess-step-legend-${subprocess.id}`}
                  className="nave-float flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#c4bfb6] bg-[#f0eeea] text-[13px] font-semibold leading-none text-[#5c574f] outline-offset-2 hover:border-[#9a958c] hover:bg-[#e5e2dc] hover:text-[#2a2825] focus-visible:ring-2 focus-visible:ring-[#002FA7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0] motion-reduce:transition-none"
                >
                  <span aria-hidden>?</span>
                </button>
                <div
                  role="tooltip"
                  className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-1.5 -translate-x-1/2 rounded-[8px] border border-[#c8c4bc] bg-[#faf9f7] p-2.5 opacity-0 shadow-[0_4px_24px_-4px_rgba(15,15,15,0.18)] transition-[opacity,visibility] duration-150 ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 motion-reduce:transition-none"
                >
                  <ul className="m-0 list-none space-y-1 p-0">
                    {([
                      { type: 'read',    label: 'Read',    desc: 'Sources / files',  accent: '#5a7a9a', badge: 'border-[#8faabe] bg-[#f2f6fa] text-[#2a4560]' },
                      { type: 'write',   label: 'Write',   desc: 'Changes made',     accent: '#9a6230', badge: 'border-[#c9a077] bg-[#fdf8f0] text-[#5c3d16]' },
                      { type: 'analyze', label: 'Analyze', desc: 'Reasoning',        accent: '#3d6b52', badge: 'border-[#7d9d8a] bg-[#f2f7f3] text-[#254530]' },
                      { type: 'spawn',   label: 'Spawn',   desc: 'Child work',       accent: '#b8892d', badge: 'border-[#c4a060] bg-[#faf6eb] text-[#6b4a10]' },
                      { type: 'mcp',     label: 'MCP',     desc: 'Tool call',        accent: '#6b5e48', badge: 'border-[#c8b89a] bg-[#f8f5ef] text-[#4a3f2e]' },
                    ] as const).map(({ label, desc, accent, badge }) => (
                      <li key={label} className="flex items-center gap-2.5">
                        <span
                          className="h-6 w-[3px] shrink-0 rounded-full"
                          style={{ backgroundColor: accent }}
                        />
                        <span className={`flex h-[22px] min-w-[3.2rem] items-center justify-center rounded-[3px] border px-2 text-[11px] font-semibold uppercase tracking-[0.07em] ${badge}`}>
                          {label}
                        </span>
                        <span className="whitespace-nowrap text-[12px] text-[#6b6560]">{desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[8px] border-2 border-[#1a1a1a]/[0.08] bg-white p-2 shadow-[0_1px_0_0_rgba(0,47,167,0.06),0_12px_32px_-12px_rgba(15,15,15,0.12)] sm:p-2.5">
              <div className="divide-y divide-[#ebe8e2] overflow-hidden rounded-[6px]">
                {subprocess.log.map((step, index) => (
                  <div
                    key={`${step.timestamp}-${index}-${step.description}`}
                    className={`flex flex-col gap-2.5 border-l-[4px] py-3.5 pl-4 pr-4 sm:flex-row sm:items-start sm:gap-4 sm:py-4 sm:pl-5 sm:pr-5 ${subprocessStepAccent(
                      step.type,
                    )}`}
                  >
                    <StepTypeBadge type={step.type} compact />
                    <p className="m-0 min-w-0 flex-1 text-[13px] font-normal leading-[1.55] text-[#1a1a1a]">
                      {step.description}
                    </p>
                    <p className="m-0 shrink-0 text-left text-[13px] font-medium uppercase tracking-[0.08em] text-[#8a8580] tabular-nums sm:mt-0.5 sm:w-[5.75rem] sm:text-right">
                      {step.timestamp}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {subprocess.partialResult ? (
            <section className="mt-8 rounded-[6px] border border-[#e0c88a] bg-[#fffaf0] px-4 py-3.5">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#8b6a28]">
                Partial result
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#4a3d24]">{subprocess.partialResult}</p>
            </section>
          ) : null}
        </div>
      </section>

      <footer
        className={`nave-float shrink-0 border-t px-6 py-3.5 transition-colors sm:px-8 sm:py-4 ${footerTint}`}
      >
        <p className="mx-auto max-w-[40rem] text-center text-[13px] uppercase tracking-[0.08em] text-[#6b6b6b]">
          Run {subprocess.status}
        </p>
      </footer>
    </main>
  )
}

function Avatar({
  initials,
  status,
  className,
  size = 'md',
}: {
  initials: string
  status: AgentStatus
  className: string
  size?: 'sm' | 'md'
}) {
  const box = size === 'sm' ? 'h-9 w-9 text-[13px] leading-9' : 'h-10 w-10 text-[13px] leading-10'
  return (
    <div className={`relative rounded-[4px] text-center ${box} ${className}`}>
      {initials}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0f0f0f] ${
          status === 'running'
            ? 'bg-[#4f8f42]'
            : status === 'blocked'
              ? 'bg-[#c18a26]'
              : 'bg-[#7d7d7d]'
        }`}
      />
    </div>
  )
}

function StatusPill({ status }: { status: AgentStatus }) {
  const styles =
    status === 'running'
      ? 'border-[#5d8157] text-[#7db174]'
      : status === 'blocked'
        ? 'border-[#8f7444] text-[#d4a548]'
        : 'border-[#3a3a3a] text-[#8c8c8c]'

  return (
    <span
      className={`rounded-[3px] border px-2 py-0.5 text-[13px] uppercase tracking-[0.04em] ${styles}`}
    >
      {status}
    </span>
  )
}

function StatusPillDarkText({ status }: { status: AgentStatus | ProcessStatus }) {
  const styles =
    status === 'running'
      ? 'border-[#c5d0dd] text-[#3d4f68]'
      : status === 'completed'
        ? 'border-[#bcd5c1] text-[#51744d]'
        : status === 'killed'
          ? 'border-[#d8b56a] text-[#8b6a28]'
          : status === 'failed'
            ? 'border-[#d3b0b0] text-[#8b4b4b]'
      : status === 'blocked'
        ? 'border-[#d8b56a] text-[#8b6a28]'
        : 'border-[#d4d0c8] text-[#7d7d7d]'

  return (
    <span
      className={`inline-flex items-center rounded-[3px] border px-2 py-0.5 text-[13px] uppercase tracking-[0.04em] ${styles}`}
    >
      {status}
    </span>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="nave-surface rounded-[6px] border border-[#d4d0c8] hover:border-[#bfbab0] bg-white px-4 py-4">
      <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">{label}</p>
      <p className="mt-2 text-[13px] font-medium tracking-[-0.01em] text-[#0f0f0f]">{value}</p>
    </div>
  )
}

function HomeCardLastHumanTouch({ detail }: { detail: LastHumanTouchDetail | null }) {
  return (
    <div className="min-w-0 max-w-full">
      <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">Latest human message</p>
      {detail ? (
        <div className="mt-2 space-y-1.5">
          <p className="text-[13px] leading-snug text-[#5f5f5f]">
            <span className="font-medium text-[#0f0f0f]">{detail.authorName}</span>
            <span className="text-[#b5b5b5]"> · </span>
            <span className="tabular-nums tracking-tight text-[#6b6b6b]">{detail.timeLabel}</span>
          </p>
          <p className="line-clamp-3 min-w-0 break-words text-[13px] leading-relaxed text-[#303030] [overflow-wrap:anywhere]">
            {detail.snippet}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[13px] leading-snug text-[#7d7d7d]">
          No human messages to this agent in the feed yet.
        </p>
      )}
    </div>
  )
}

function LastHumanTouchIdentity({ value }: { value: LastHumanTouchDetail | null }) {
  if (!value) {
    return <span className="text-[#7d7d7d]">No human messages yet.</span>
  }
  return (
    <div className="space-y-2">
      <p className="text-[13px] leading-snug text-[#0f0f0f]">
        <span className="font-medium">{value.authorName}</span>
        <span className="text-[#9a9a9a]"> · </span>
        <span className="tabular-nums text-[13px] text-[#5f5f5f]">{value.timeLabel}</span>
      </p>
      <p className="line-clamp-3 min-w-0 break-words text-[13px] leading-snug text-[#5f5f5f] [overflow-wrap:anywhere]">
        {value.snippet}
      </p>
    </div>
  )
}

function DetailCard({
  label,
  value,
  highlight,
  dense,
}: {
  label: string
  value: string
  /** Single focal metric — IKB */
  highlight?: 'primary'
  dense?: boolean
}) {
  const isPrimary = highlight === 'primary'
  return (
    <div
      className={`nave-surface rounded-[6px] border ${
        dense ? 'px-3 py-2.5' : 'px-4 py-4'
      } ${
        isPrimary
          ? 'border-[#6685cc] bg-[#f7f9fd] hover:border-[#002FA7]'
          : 'border-[#d4d0c8] bg-white hover:border-[#bfbab0]'
      }`}
    >
      <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">{label}</p>
      <p
        className={`${dense ? 'mt-1 text-[13px] leading-snug' : 'mt-2 text-[13px] leading-6'} ${
          isPrimary ? 'font-medium text-[#002FA7]' : 'text-[#0f0f0f]'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function IdentityRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-[#d4d0c8] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">{label}</dt>
      <dd className="mt-2 text-[13px] text-[#0f0f0f]">{value}</dd>
    </div>
  )
}

function OutcomePill({ outcome }: { outcome: 'completed' | 'killed' | 'failed' }) {
  const styles =
    outcome === 'completed'
      ? 'border-[#bcd5c1] text-[#51744d]'
      : outcome === 'killed'
        ? 'border-[#d8b56a] text-[#8b6a28]'
        : 'border-[#d3b0b0] text-[#8b4b4b]'

  return (
    <span className={`w-fit rounded-[3px] border px-2 py-0.5 text-[13px] uppercase tracking-[0.04em] ${styles}`}>
      {outcome}
    </span>
  )
}

function subprocessStepAccent(type: SubprocessStepType): string {
  switch (type) {
    case 'read':
      return 'border-l-[#5a7a9a]'
    case 'write':
      return 'border-l-[#9a6230]'
    case 'analyze':
      return 'border-l-[#3d6b52]'
    case 'spawn':
      return 'border-l-[#b8892d]'
    case 'mcp':
      return 'border-l-[#6b5e48]'
  }
}

function StepTypeBadge({ type, compact }: { type: SubprocessStepType; compact?: boolean }) {
  const labelMap: Record<SubprocessStepType, string> = {
    read: 'Read',
    write: 'Write',
    analyze: 'Analyze',
    spawn: 'Spawn',
    mcp: 'MCP',
  }

  const styles: Record<SubprocessStepType, string> = {
    read: 'border-[#8faabe] bg-[#f2f6fa] text-[#2a4560]',
    write: 'border-[#c9a077] bg-[#fdf8f0] text-[#5c3d16]',
    analyze: 'border-[#7d9d8a] bg-[#f2f7f3] text-[#254530]',
    spawn: 'border-[#c4a060] bg-[#faf6eb] text-[#6b4a10]',
    mcp: 'border-[#c8b89a] bg-[#f8f5ef] text-[#4a3f2e]',
  }

  const box = compact
    ? 'h-7 min-w-[3rem] px-2 text-[13px] tracking-[0.07em]'
    : 'h-8 min-w-[2.5rem] px-2 text-[13px] tracking-[0.08em]'

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-[3px] border font-semibold uppercase ${box} ${styles[type]}`}
    >
      {labelMap[type]}
    </div>
  )
}

function ActivityBadge({ kind }: { kind: ActivityKind }) {
  const labelMap = {
    completion: 'Completed',
    permission: 'Approval',
    state: 'State',
    task: 'Assigned',
  } as const

  const styles =
    kind === 'permission'
      ? 'border-[#d8b56a] text-[#8b6a28]'
      : kind === 'completion'
        ? 'border-[#bcd5c1] text-[#51744d]'
        : kind === 'task'
          ? 'border-[#d4d0c8] text-[#5f5f5f]'
          : 'border-[#d4d0c8] text-[#5f5f5f]'

  return (
    <span className={`rounded-[3px] border px-2 py-0.5 text-[13px] uppercase tracking-[0.04em] ${styles}`}>
      {labelMap[kind]}
    </span>
  )
}

function MemoryBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[13px] uppercase tracking-[0.08em] text-[#9a9a9a]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="nave-surface rounded-[6px] border border-[#d4d0c8] hover:border-[#bfbab0] bg-white px-4 py-3 text-[13px] leading-6 text-[#303030]"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
