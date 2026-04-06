import { MockFeedMessage } from './components/permission/MockFeedMessage'
import { CompletionCard, type CompletionCardState } from './components/completion/CompletionCard'

const C = {
  primary: '#0f0f0f',
  background: '#f5f4f0',
  muted: '#9a9a9a',
} as const

const AGENT_COPY = (
  <>
    Queue handoff is stable. I am ready to land the permission sync changes once this run finishes.
  </>
)

function StateLabel({ state }: { state: CompletionCardState }) {
  return (
    <p
      className="m-0 mb-2 text-[11px] font-normal uppercase tracking-[0.08em] leading-none"
      style={{ color: C.muted }}
    >
      {state}
    </p>
  )
}

export default function CompletionCardReviewPage() {
  return (
    <main
      className="min-h-full antialiased"
      style={{
        backgroundColor: C.background,
        padding: 48,
        color: C.primary,
      }}
    >
      <h1
        className="m-0 mb-8 text-[28px] font-medium tracking-[-0.02em] leading-[1.1]"
        style={{ color: C.primary }}
      >
        Completion card — dev review
      </h1>
      <p className="m-0 mb-10 max-w-[42rem] text-[14px] leading-[1.6]" style={{ color: C.primary }}>
        Feed-embedded task outcome. States follow the agent lifecycle (running through honest
        completions). Same shell as the permission card; agent row styling per product spec.
      </p>

      <div className="max-w-[42rem]">
        <StateLabel state="running" />
        <MockFeedMessage variant="agent" agentMessage={AGENT_COPY}>
          <CompletionCard state="running" />
        </MockFeedMessage>

        <StateLabel state="completed" />
        <MockFeedMessage variant="agent" agentMessage={AGENT_COPY}>
          <CompletionCard state="completed" />
        </MockFeedMessage>

        <StateLabel state="killed" />
        <MockFeedMessage variant="agent" agentMessage={AGENT_COPY}>
          <CompletionCard state="killed" />
        </MockFeedMessage>

        <StateLabel state="failed" />
        <MockFeedMessage variant="agent" agentMessage={AGENT_COPY}>
          <CompletionCard state="failed" />
        </MockFeedMessage>
      </div>
    </main>
  )
}
