import { useRef } from 'react'

export type PermissionCardState =
  | 'pending'
  | 'reviewing'
  | 'approved'
  | 'denied'
  | 'always-allowed-confirming'
  | 'always-allowed-resolved'
  | 'cancelled'

export type PermissionCardCompactState = Extract<
  PermissionCardState,
  'approved' | 'denied' | 'always-allowed-resolved' | 'cancelled'
>

type PermissionCardExpandedState = Extract<
  PermissionCardState,
  'pending' | 'reviewing' | 'always-allowed-confirming'
>

export type PermissionCardInteractionHandlers = {
  onApprove: () => void
  onDeny: () => void
  onAlwaysAllow: () => void
  onAlwaysAllowConfirm: () => void
  onAlwaysAllowCancel: () => void
}

export type PermissionCardProps = {
  state: PermissionCardState
  /** Overrides default demo copy when embedding in a real feed narrative */
  actionTitle?: string
  resource?: string
  description?: string
  policyAgentName?: string
  policyPathGlob?: string
  /** When set, primary actions dispatch into the app store (feed). */
  actions?: PermissionCardInteractionHandlers
}

/** Brand tokens — `--color-surface` lifts cards off `--color-background` paper */
const C = {
  primary: '#0f0f0f',
  cardSurface: '#ebebeb',
  border: '#d4d0c8',
  borderEmphasis: '#9a9a9a',
  muted: '#9a9a9a',
  ikb: '#002FA7',
  onIkb: '#ffffff',
} as const

const ACTION_TITLE = 'Write to protected path'
const RESOURCE = 'src/auth/session.ts'
const DESCRIPTION =
  'This change updates how sessions are validated. It can affect sign-in for everyone using the app.'


function Divider({ compact }: { compact?: boolean }) {
  return (
    <div
      className={compact ? 'my-3' : 'my-6'}
      role="presentation"
      style={{
        height: 0.5,
        backgroundColor: C.border,
        border: 'none',
        width: '100%',
      }}
    />
  )
}

export function PermissionCard({
  state,
  actionTitle,
  resource,
  description,
  policyAgentName,
  policyPathGlob,
  actions,
}: PermissionCardProps) {
  const copy = {
    actionTitle: actionTitle ?? ACTION_TITLE,
    resource: resource ?? RESOURCE,
    description: description ?? DESCRIPTION,
    policyAgent: policyAgentName ?? 'Frontend Agent',
    policyGlob: policyPathGlob ?? 'src/auth/**',
  }

  const isCompact =
    state === 'approved' ||
    state === 'denied' ||
    state === 'always-allowed-resolved' ||
    state === 'cancelled'

  const lastExpandedStateRef = useRef<PermissionCardExpandedState>(
    !isCompact ? (state as PermissionCardExpandedState) : 'pending',
  )
  if (!isCompact) {
    lastExpandedStateRef.current = state as PermissionCardExpandedState
  }

  return (
    <div
      className="nave-surface rounded-[6px] border max-w-full mt-0 nave-float overflow-hidden"
      style={{
        borderWidth: 0.5,
        borderColor: C.border,
        backgroundColor: C.cardSurface,
        padding: isCompact ? '12px 16px' : '24px',
        transition:
          'padding var(--nave-structure-duration) var(--nave-structure-ease), border-color var(--nave-float-duration-short) ease-out, background-color var(--nave-float-duration-short) ease-out',
      }}
    >
      <div className="nave-collapse-section" data-collapsed={isCompact || undefined}>
        <div className="nave-collapse-inner">
          <ExpandedBody
            state={lastExpandedStateRef.current}
            copy={copy}
            actions={isCompact ? undefined : actions}
          />
        </div>
      </div>

      <div className="nave-collapse-section" data-collapsed={!isCompact || undefined}>
        <div className="nave-collapse-inner">
          <CompactBody
            state={isCompact ? (state as PermissionCardCompactState) : 'approved'}
            policyAgent={copy.policyAgent}
            policyGlob={copy.policyGlob}
          />
        </div>
      </div>
    </div>
  )
}

function ExpandedBody({
  state,
  copy,
  actions,
}: {
  state: PermissionCardExpandedState
  copy: {
    actionTitle: string
    resource: string
    description: string
    policyAgent: string
    policyGlob: string
  }
  actions?: PermissionCardInteractionHandlers
}) {
  const showDetailBlock =
    state === 'pending' ||
    state === 'reviewing' ||
    state === 'always-allowed-confirming'

  return (
    <>
      {showDetailBlock ? (
        <>
          <h3
            className="m-0 text-[13px] font-medium tracking-[-0.01em] leading-[1.3]"
            style={{ color: C.primary }}
          >
            {copy.actionTitle}
          </h3>
          <code
            className="mt-2 block font-mono text-[13px] leading-[1.6] break-all"
            style={{ color: C.primary }}
          >
            {copy.resource}
          </code>
          <p
            className="mt-3 mb-0 text-[13px] leading-[1.6]"
            style={{ color: C.primary }}
          >
            {copy.description}
          </p>
        </>
      ) : null}

      {state === 'pending' ? (
        <>
          <Divider />
          <ActionsPending actions={actions} />
        </>
      ) : null}

      {state === 'reviewing' ? (
        <>
          <Divider />
          <p
            className="m-0 text-[13px] leading-[1.6]"
            style={{ color: C.primary }}
          >
            Maya is reviewing this request.
          </p>
        </>
      ) : null}

      {state === 'always-allowed-confirming' ? (
        <>
          <Divider />
          <p
            className="m-0 text-[13px] leading-[1.6]"
            style={{ color: C.primary }}
          >
            This will allow {copy.policyAgent} to write to{' '}
            <code className="font-mono text-[13px]">{copy.policyGlob}</code>{' '}
            without asking.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={actions?.onAlwaysAllowConfirm}
              className={`nave-float rounded-[4px] border-0 px-0 py-0 text-[13px] font-normal underline decoration-from-font underline-offset-2 ${actions ? 'nave-rise cursor-pointer' : 'cursor-default'}`}
              style={{
                backgroundColor: 'transparent',
                color: C.ikb,
              }}
            >
              Set rule
            </button>
            <button
              type="button"
              onClick={actions?.onAlwaysAllowCancel}
              className={`nave-float rounded-[4px] border-0 px-0 py-0 text-[13px] font-normal underline decoration-from-font underline-offset-2 ${actions ? 'nave-rise cursor-pointer' : 'cursor-default'}`}
              style={{
                backgroundColor: 'transparent',
                color: C.primary,
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : null}
    </>
  )
}

function ActionsPending({ actions }: { actions?: PermissionCardInteractionHandlers }) {
  const interactive = Boolean(actions)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={actions?.onApprove}
          className={`nave-float nave-rise rounded-[4px] border-0 px-4 py-2 text-[13px] font-normal ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          style={{
            backgroundColor: C.ikb,
            color: C.onIkb,
          }}
        >
          Approve
        </button>
        <button
          type="button"
          onClick={actions?.onDeny}
          className={`nave-float nave-rise rounded-[4px] bg-transparent px-4 py-2 text-[13px] font-normal hover:bg-[#f5f4f0] ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
          style={{
            color: C.primary,
            borderWidth: 0.5,
            borderStyle: 'solid',
            borderColor: C.border,
          }}
        >
          Deny
        </button>
      </div>
      <button
        type="button"
        onClick={actions?.onAlwaysAllow}
        className={`nave-float self-start rounded-[4px] border-0 bg-transparent px-0 py-0 text-left text-[13px] font-normal underline decoration-from-font underline-offset-[0.2em] ${interactive ? 'nave-rise cursor-pointer' : 'cursor-default'}`}
        style={{
          color: C.ikb,
        }}
      >
        Always allow this pattern
      </button>
    </div>
  )
}

function CompactBody({
  state,
  policyAgent,
  policyGlob,
}: {
  state: PermissionCardCompactState
  policyAgent: string
  policyGlob: string
}) {
  if (state === 'approved') {
    return (
      <p className="m-0 text-[13px] leading-[1.5]" style={{ color: C.muted }}>
        Maya approved · Apr 2, 2026 · 14:34
      </p>
    )
  }
  if (state === 'denied') {
    return (
      <p className="m-0 text-[13px] leading-[1.5]" style={{ color: C.muted }}>
        Maya denied · Apr 2, 2026 · 14:35
      </p>
    )
  }
  if (state === 'cancelled') {
    return (
      <p className="m-0 text-[13px] leading-[1.5]" style={{ color: C.muted }}>
        This request is no longer active because the agent was stopped. No approval
        or denial was recorded.
      </p>
    )
  }
  if (state === 'always-allowed-resolved') {
    return (
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[13px] leading-[1.5]" style={{ color: C.muted }}>
          Maya approved · Apr 2, 2026 · 14:36
        </p>
        <p className="m-0 text-[13px] leading-[1.5]" style={{ color: C.muted }}>
          Standing rule created for this agent. Future writes matching the pattern
          skip approval until revoked.
        </p>
        <span
          className="inline-flex w-fit items-center rounded-[3px] border px-2.5 py-0.5 text-[13px] tracking-[0.04em] uppercase"
          style={{
            borderWidth: 0.5,
            borderColor: C.ikb,
            color: C.ikb,
            backgroundColor: 'transparent',
          }}
        >
          {policyAgent} · write · {policyGlob}
        </span>
      </div>
    )
  }
}
