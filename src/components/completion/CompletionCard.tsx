export type CompletionCardState = 'running' | 'completed' | 'killed' | 'failed'

/** Completion card tokens / semantic hues */
const C = {
  primary: '#0f0f0f',
  /** `--color-surface` — cards off feed paper (`#f5f4f0`) */
  cardSurface: '#ebebeb',
  border: '#d4d0c8',
  muted: '#9a9a9a',
  ikb: '#002FA7',
  onIkb: '#ffffff',
  /** Product: green completion signal — not decorative; encodes success */
  complete: '#1e5a40',
  /** Stopped / partial — warm amber aligned with permission emphasis family */
  killed: '#7a5e1a',
  killedSurface: '#fdf8ed',
  /** Failure — semantic; never IKB */
  failed: '#8f2e2e',
  failedSurface: '#fbf0f0',
} as const

const TASK_NAME = 'Consolidate permission sync for queue handoff'

const STATS = {
  running: {
    durationLabel: 'Elapsed · 12m 05s',
    hint: 'Finishing validation and writes.',
    files: '7',
    filesNote: '' as string,
    subprocesses: '3',
    errors: '0',
    approvals: '1',
  },
  completed: {
    durationLabel: 'Completed · 18m 42s',
    hint: '' as string,
    files: '7',
    filesNote: '',
    subprocesses: '3',
    errors: '0',
    approvals: '1',
  },
  killed: {
    durationLabel: 'Stopped · 11m 20s',
    hint: 'Stopped before completion. Partial output is available.',
    files: '4',
    filesNote: 'partial',
    subprocesses: '3',
    errors: '0',
    approvals: '1',
  },
  failed: {
    durationLabel: 'Failed · 6m 02s',
    hint: 'Run failed during test pass. No files were merged.',
    files: '0',
    filesNote: '',
    subprocesses: '2',
    errors: '2',
    approvals: '1',
  },
} satisfies Record<CompletionCardState, Record<string, string>>

type CompletionStatFields = (typeof STATS)[CompletionCardState]

export type CompletionCardProps = {
  state: CompletionCardState
  taskName?: string
  stats?: Partial<CompletionStatFields>
}

function Divider() {
  return (
    <div
      className="my-6 w-full border-0 p-0 m-0"
      role="presentation"
      style={{ height: 0.5, backgroundColor: C.border }}
    />
  )
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

function StatCell({
  label,
  value,
  note,
  accent = 'none',
}: {
  label: string
  value: string
  note?: string
  accent?: 'none' | 'ikb' | 'negative'
}) {
  const valueColor =
    accent === 'ikb' ? C.ikb : accent === 'negative' ? C.failed : C.primary
  return (
    <div>
      <p
        className="m-0 text-[11px] font-normal uppercase tracking-[0.08em] leading-none"
        style={{ color: C.muted }}
      >
        {label}
      </p>
      <p
        className="mt-2 m-0 text-[24px] font-medium tracking-[-0.01em] leading-none"
        style={{ color: valueColor }}
      >
        {value}
        {note ? (
          <span
            className="ml-1.5 text-[12px] font-normal normal-case tracking-normal"
            style={{ color: C.muted }}
          >
            ({note})
          </span>
        ) : null}
      </p>
    </div>
  )
}

export function CompletionCard({ state, taskName, stats }: CompletionCardProps) {
  const s = { ...STATS[state], ...stats }
  const title = taskName ?? TASK_NAME
  const dotColor =
    state === 'running'
      ? C.ikb
      : state === 'completed'
        ? C.complete
        : state === 'killed'
          ? C.killed
          : C.failed

  const surfaceTint =
    state === 'killed' ? C.killedSurface : state === 'failed' ? C.failedSurface : C.cardSurface

  const borderTint =
    state === 'killed'
      ? '#e8dcc4'
      : state === 'failed'
        ? '#e8cfcf'
        : C.border

  const statusVerb =
    state === 'running'
      ? 'Running'
      : state === 'completed'
        ? 'Completed'
        : state === 'killed'
          ? 'Stopped'
          : 'Failed'

  const isSuccessOutcome = state === 'completed' || state === 'killed'
  const primaryIsRunLog = state === 'failed' || state === 'running'
  const dimDiff = !isSuccessOutcome
  const dimFollowUp = state === 'running'

  return (
    <div
      className="nave-surface mt-0 max-w-full rounded-[6px] border p-6 nave-float"
      style={{
        borderWidth: 0.5,
        borderColor: borderTint,
        backgroundColor: surfaceTint,
        transitionProperty: 'border-color, background-color, opacity',
      }}
    >
      <div className="flex gap-3">
        <StatusDot color={dotColor} />
        <div className="min-w-0 flex-1">
          <h3
            className="m-0 text-[18px] font-medium tracking-[-0.01em] leading-[1.3]"
            style={{ color: C.primary }}
          >
            {title}
          </h3>
          <p
            className="mt-1 m-0 text-[12px] font-normal leading-[1.5]"
            style={{ color: C.muted }}
          >
            {s.durationLabel}
            <span style={{ color: C.border }} className="mx-2">
              ·
            </span>
            <span style={{ color: state === 'failed' ? C.failed : C.muted }}>{statusVerb}</span>
          </p>
        </div>
      </div>

      {s.hint ? (
        <p
          className="mt-4 mb-0 text-[14px] leading-[1.6]"
          style={{ color: state === 'failed' ? C.failed : C.primary }}
        >
          {s.hint}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        <StatCell
          label="Files changed"
          value={s.files}
          note={s.filesNote || undefined}
          accent={state === 'completed' ? 'ikb' : 'none'}
        />
        <StatCell label="Sub-processes" value={s.subprocesses} />
        <StatCell
          label="Errors"
          value={s.errors}
          accent={state === 'failed' ? 'negative' : 'none'}
        />
        <StatCell label="Approvals" value={s.approvals} />
      </div>

      <Divider />

      <div className="flex flex-wrap gap-2">
        {dimDiff ? (
          <button
            type="button"
            className="nave-float nave-rise cursor-default rounded-[4px] border bg-transparent px-4 py-2 text-[13px] font-normal opacity-50"
            style={{
              color: C.primary,
              borderWidth: 0.5,
              borderStyle: 'solid',
              borderColor: C.border,
            }}
          >
            View diff
          </button>
        ) : (
          <button
            type="button"
            className="nave-float nave-rise cursor-default rounded-[4px] border-0 px-4 py-2 text-[13px] font-normal hover:bg-[#001254]"
            style={{
              backgroundColor: C.ikb,
              color: C.onIkb,
            }}
          >
            View diff
          </button>
        )}
        {primaryIsRunLog ? (
          <button
            type="button"
            className="nave-float nave-rise cursor-default rounded-[4px] border-0 px-4 py-2 text-[13px] font-normal hover:bg-[#001254]"
            style={{
              backgroundColor: C.ikb,
              color: C.onIkb,
            }}
          >
            View run log
          </button>
        ) : (
          <button
            type="button"
            className="nave-float nave-rise cursor-default rounded-[4px] bg-transparent px-4 py-2 text-[13px] font-normal hover:bg-[#f5f4f0]"
            style={{
              color: C.primary,
              borderWidth: 0.5,
              borderStyle: 'solid',
              borderColor: C.border,
            }}
          >
            View run log
          </button>
        )}
        <button
          type="button"
          className={`nave-float nave-rise cursor-default rounded-[4px] bg-transparent px-4 py-2 text-[13px] font-normal hover:bg-[#f5f4f0] ${dimFollowUp ? 'opacity-50' : ''}`}
          style={{
            color: C.primary,
            borderWidth: 0.5,
            borderStyle: 'solid',
            borderColor: C.border,
          }}
        >
          Assign follow-up
        </button>
      </div>
    </div>
  )
}
