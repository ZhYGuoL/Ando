import type { ReactNode } from 'react'

type MockFeedMessageProps = {
  /** Agent message shown above the card; flush with card (no extra gap). */
  agentMessage: ReactNode
  /** Feed card or inline block directly under the message text. */
  children: ReactNode
  /**
   * Line below the card, still inside the message body — only for in-flight requests.
   * Omit for resolved or cancelled states.
   */
  continuingLine?: boolean
  /**
   * `agent` — IKB avatar and name styling (agent messages).
   * `human` — neutral avatar (default).
   */
  variant?: 'human' | 'agent'
  /** Overrides default initials in the avatar square. */
  avatarInitials?: string
  /** Overrides default display name in the header. */
  senderName?: string
  /** Overrides the small tag beside the name (e.g. `repo worker`, `agent`, role). */
  senderTag?: string
  /** When set, replaces the default initials avatar (e.g. pass `Avatar` with status dot). */
  avatar?: ReactNode
  /** Visible timestamp; defaults to review-page placeholder when omitted. */
  timestamp?: string
  /** `dateTime` for the `<time>` element. */
  timestampDateTime?: string
  /** When set, the sender name navigates (same visual weight as plain text). */
  onSenderNameClick?: () => void
}

const FEED_BG = '#f5f4f0'
const AVATAR_BG = '#ebebeb'
const BORDER = '#d4d0c8'
const MUTED = '#9a9a9a'
const PRIMARY = '#0f0f0f'
const IKB = '#002FA7'
/** Matches --nave-float-ease in index.css */
const FLOAT_EASE = 'cubic-bezier(0.16, 1, 0.35, 1)'

export function MockFeedMessage({
  agentMessage,
  children,
  continuingLine = false,
  variant = 'human',
  avatarInitials,
  senderName,
  senderTag,
  avatar,
  timestamp,
  timestampDateTime,
  onSenderNameClick,
}: MockFeedMessageProps) {
  const isAgent = variant === 'agent'
  const initials = avatarInitials ?? (isAgent ? 'SC' : 'FA')
  const name = senderName ?? (isAgent ? 'Scout' : 'Frontend Agent')
  const tag = senderTag ?? (isAgent ? 'agent' : 'repo worker')
  const timeLabel = timestamp ?? 'Apr 2 · 14:32'
  const timeAttr = timestampDateTime ?? '2026-04-02T14:32:00'
  const cockpitLabel = `View ${name} — open agent cockpit`
  const defaultAvatar = (
    <div
      className="flex h-10 w-10 items-center justify-center rounded-[4px] text-[12px] font-medium"
      style={{
        backgroundColor: isAgent ? IKB : AVATAR_BG,
        color: isAgent ? '#ffffff' : PRIMARY,
        fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
      }}
      aria-hidden
    >
      {initials}
    </div>
  )

  const avatarColumn = onSenderNameClick ? (
    <button
      type="button"
      onClick={onSenderNameClick}
      aria-label={cockpitLabel}
      style={{ transitionTimingFunction: FLOAT_EASE }}
      className="shrink-0 self-start cursor-pointer rounded-[4px] border-0 bg-transparent p-0 ring-1 ring-inset ring-[#002FA7]/35 transition-[transform,ring-color] duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.03] hover:ring-[#001254]/90 active:translate-y-0 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002FA7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0]"
    >
      {avatar ?? defaultAvatar}
    </button>
  ) : avatar ? (
    <div className="shrink-0">{avatar}</div>
  ) : (
    <div className="shrink-0">{defaultAvatar}</div>
  )

  return (
    <article
      className="flex w-full items-start gap-4 py-6 border-b"
      style={{
        borderBottomWidth: 0.5,
        borderBottomColor: BORDER,
        backgroundColor: FEED_BG,
        color: PRIMARY,
      }}
    >
      {avatarColumn}
      <div className="min-w-0 flex-1 flex flex-col">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-2">
          {onSenderNameClick ? (
            <button
              type="button"
              onClick={onSenderNameClick}
              aria-label={cockpitLabel}
              style={{ transitionTimingFunction: FLOAT_EASE, fontFamily: 'inherit' }}
              className={`text-[14px] font-medium tracking-[-0.01em] leading-[1.3] border-0 bg-transparent p-0 text-left cursor-pointer underline decoration-2 underline-offset-[0.2em] transition-[color,transform,text-decoration-color,text-underline-offset] duration-200 ease-out hover:-translate-y-px hover:underline-offset-[0.28em] active:translate-y-0 motion-reduce:transition-[color,text-decoration-color] motion-reduce:duration-150 motion-reduce:hover:translate-y-0 motion-reduce:hover:underline-offset-[0.2em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002FA7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0] ${
                isAgent
                  ? 'text-[#002FA7] decoration-[#002FA7]/55 hover:text-[#001254] hover:decoration-[#001254] focus-visible:text-[#001254] focus-visible:decoration-[#001254]'
                  : 'text-[#0f0f0f] decoration-[#0f0f0f]/45 hover:text-[#000000] hover:decoration-[#0f0f0f] focus-visible:decoration-[#0f0f0f]'
              }`}
            >
              {name}
            </button>
          ) : (
            <span
              className="text-[14px] font-medium tracking-[-0.01em] leading-[1.3]"
              style={{ color: isAgent ? IKB : PRIMARY }}
            >
              {name}
            </span>
          )}
          <span
            className="inline-flex items-center rounded-[3px] border px-2.5 py-0.5 text-[11px] tracking-[0.04em] uppercase"
            style={{
              borderWidth: 0.5,
              borderColor: isAgent ? IKB : BORDER,
              color: isAgent ? IKB : MUTED,
              backgroundColor: 'transparent',
            }}
          >
            {tag}
          </span>
          <time
            className="text-[11px] tracking-[0.08em] uppercase leading-none ml-auto sm:ml-0"
            style={{ color: MUTED }}
            dateTime={timeAttr}
          >
            {timeLabel}
          </time>
        </header>
        <div
          className="text-[14px] leading-[1.6] mb-0"
          style={{ color: PRIMARY }}
        >
          {agentMessage}
        </div>
        <div className="mt-0">{children}</div>
        {continuingLine ? (
          <p
            className="mt-3 text-[12px] leading-[1.5] m-0"
            style={{ color: MUTED }}
          >
            Agent is continuing other work while waiting.
          </p>
        ) : null}
      </div>
    </article>
  )
}
