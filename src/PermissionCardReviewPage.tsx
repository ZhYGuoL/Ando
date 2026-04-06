import { MockFeedMessage } from './components/permission/MockFeedMessage'
import { PermissionCard, type PermissionCardState } from './components/permission/PermissionCard'

const C = {
  primary: '#0f0f0f',
  background: '#f5f4f0',
  muted: '#9a9a9a',
} as const

const PLACEHOLDER_MSG = (
  <>
    I need to update session validation in{' '}
    <code className="font-mono text-[13px]" style={{ color: C.primary }}>
      src/auth/session.ts
    </code>{' '}
    before I can finish the sign-in fix. Approve if this scope looks right.
  </>
)

function StateLabel({ state }: { state: PermissionCardState }) {
  return (
    <p
      className="m-0 mb-2 text-[11px] font-normal uppercase tracking-[0.08em] leading-none"
      style={{ color: C.muted }}
    >
      {state}
    </p>
  )
}

export default function PermissionCardReviewPage() {
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
        Permission card — dev review
      </h1>

      <div className="max-w-[42rem]">
        <StateLabel state="pending" />
        <MockFeedMessage agentMessage={PLACEHOLDER_MSG} continuingLine>
          <PermissionCard state="pending" />
        </MockFeedMessage>

        <StateLabel state="reviewing" />
        <MockFeedMessage agentMessage={PLACEHOLDER_MSG} continuingLine>
          <PermissionCard state="reviewing" />
        </MockFeedMessage>

        <StateLabel state="approved" />
        <MockFeedMessage agentMessage={PLACEHOLDER_MSG}>
          <PermissionCard state="approved" />
        </MockFeedMessage>

        <StateLabel state="denied" />
        <MockFeedMessage agentMessage={PLACEHOLDER_MSG}>
          <PermissionCard state="denied" />
        </MockFeedMessage>

        <StateLabel state="always-allowed-confirming" />
        <MockFeedMessage agentMessage={PLACEHOLDER_MSG} continuingLine>
          <PermissionCard state="always-allowed-confirming" />
        </MockFeedMessage>

        <StateLabel state="always-allowed-resolved" />
        <MockFeedMessage agentMessage={PLACEHOLDER_MSG}>
          <PermissionCard state="always-allowed-resolved" />
        </MockFeedMessage>

        <StateLabel state="cancelled" />
        <MockFeedMessage agentMessage={PLACEHOLDER_MSG}>
          <PermissionCard state="cancelled" />
        </MockFeedMessage>
      </div>
    </main>
  )
}
