# Long-running agents, background sessions, and observability (from `src/`)

**Audience:** Your product centers on **agents that keep working** across **hours or days**, while **teams** drop in and out like Slack. This document pulls **lifecycle, persistence, and ops** patterns from the leaked `src/`: **daemons**, **background sessions**, **async agent runs**, **isolated transcripts**, **remote polling**, and **session registry**.

**Provenance:** Unverified leak; see repo `README.md`.

**Note:** This snapshot references `../daemon/main.js` from `entrypoints/cli.tsx`, but a **`daemon/`** tree may be **absent or incomplete** in your copy of the leak—treat daemon behavior as **described by call sites**, not guaranteed source.

---

## Why this matters for your app

Long-running agents require:

- **Survival across UI disconnect** (refresh, laptop sleep, handoff to teammate).
- **Clear observability**: what’s running, where logs go, how to **cancel** or **attach**.
- **Isolation** so background work doesn’t **corrupt** the main conversation or **leak** across agents.
- **Honest completion semantics** (killed vs failed vs completed) and **partial results**.

---

## 1. CLI entry routing: daemon and background (`entrypoints/cli.tsx`)

### What appears in the leak

- **`claude daemon [subcommand]`** (feature **`DAEMON`**): early dispatch to **`daemonMain`** — described in comments as a **long-running supervisor**.

- **`claude ps | logs | attach | kill`** and **`--bg` / `--background`** (feature **`BG_SESSIONS`**): session management against **`~/.claude/sessions/`** registry; dynamic import of **`cli/bg.js`** so unused code stays out of hot path.

### Apply to your product

- Separate **control plane** (list/status/attach/kill) from **data plane** (agent execution)—even if both are microservices internally.
- Expose **first-class APIs**: `GET /agents`, `GET /agents/:id/logs`, `POST /agents/:id/cancel`, `POST /sessions/:id/attach`.

---

## 2. Session registry and concurrent sessions (`concurrentSessions.ts`)

### What appears in the leak

- **`registerSession`:** writes a **PID JSON** per session under **`getSessionsDir()`**, chmod **`0o700`**.

- **Who registers:** interactive CLI, SDK entrypoints, **background/daemon spawns**—**not** teammates/subagents (would **pollute** `claude ps` and conflate swarm concurrency).

- **Recorded fields:** `pid`, `sessionId`, `cwd`, `startedAt`, `kind` (from env), `entrypoint`, optional **`messagingSocketPath`** (`UDS_INBOX`), optional **`name`**, **`logPath`**, **`agent`** (`BG_SESSIONS`).

- **Session switch:** on **`/resume`**, PID file’s **`sessionId`** is updated so **sparkline/transcript** metadata stays correct.

- **Name updates:** helpers to **rename** session in registry for **ListPeers**-style UIs.

### Apply to your product

- Maintain a **durable run record**: **process id or task ARN**, **logical session id**, **CWD/workspace**, **startedAt**, **kind** (interactive vs worker vs scheduled).
- **Exclude ephemeral sub-workers** from the **human-facing “what’s running”** list—or tag them **child_of** so the UI stays legible.
- When **session id changes** (fork, resume, branch), **update the registry** so **metrics and logs** stay joined.

---

## 3. Background main session task (`LocalMainSessionTask.ts`)

### What appears in the leak

- When the user **backgrounds** the current query, register a **main session task** with:
  - **Isolated transcript path** via **`initTaskOutputAsSymlink`** → **`getAgentTranscriptPath(asAgentId(taskId))`** — explicitly **not** `getTranscriptPath()` of main session.

- **Reason:** avoids **corrupting** main transcript if a background query runs after **`/clear`**; isolated path **survives** session id changes via symlink handling in **`clearConversation`**.

- Reuses **`AbortController`** when backgrounding an **active** query so **stop** actually stops the in-flight work.

### Apply to your product

- **Never append worker transcripts into the main channel transcript** without an **explicit link**—use **thread id** or **child transcript id**.
- **Clear channel** / **reset context** must not **orphan or splice** background jobs incorrectly—persist **job ↔ storage location** mapping.

---

## 4. Async agent lifecycle (`tools/AgentTool/agentToolUtils.ts` — `runAsyncAgentLifecycle`)

### What appears in the leak

Drives **background agent** from spawn to terminal notification:

- **Streaming:** `makeStream` yields messages; each append updates **task state** when task has **`retain`** (UI holds task).
- **Disk vs memory:** comment notes **disk-write-before-yield** so **bootstrap** can merge **disk prefix** with **live suffix** correctly.

- **Progress:** trackers update from **tool use** names; **`emitTaskProgress`** for parent tool UX.

- **Summarization:** optional **`startAgentSummarization`** when **`enableSummarization`** and cache-safe params arrive.

- **Completion ordering:** mark task **completed first** so blocking **`TaskOutput`** unblocks **before** slow embellishments (**`classifyHandoffIfNeeded`**, **`getWorktreeResult`**)—avoids hangs gating status (issue **gh-20236** pattern).

- **Kill path (`AbortError`):** **`killAsyncAgent`**, log analytics, **`extractPartialResult`** for **`finalMessage`**, enqueue **killed** notification—partial work preserved.

- **Failure path:** **`failAsyncAgent`**, enqueue **failed** with error string.

- **Cleanup:** **`finally`** clears invoked skills and dump state for **`agentIdForCleanup`**.

### Apply to your product

- **Status transitions** must be **immediate**; **analytics and git metadata** are **best-effort async**.
- **User-visible “stopped”** should still ship **partial output** when killed.
- **Long jobs** need **progress events** derived from **tool boundaries**, not only final answer.

---

## 5. Remote agent tasks and resume (`RemoteAgentTask.tsx`)

### What appears in the leak

- **`isLongRunning`:** remote agent **does not complete** on first **`result`**—matches **continuous or multi-phase** remote work.

- **`pollStartedAt`:** **review timeout** accounts for **restore time** so an old task isn’t instantly timed out on resume.

- **Types:** `remote-agent`, `ultraplan`, `ultrareview`, `autofix-pr`, `background-pr` — different **poll/completion** strategies.

- **Metadata persistence:** **`writeRemoteAgentMetadata`** per `taskId`; **delete** on completion/kill so restored sessions don’t **resurrect** finished jobs.

- **Output:** **`initTaskOutput`**, **`appendTaskOutput`** — file-backed stream for readers.

- **Integration:** teleport/CCR polling, **`enqueuePendingNotification`** for user-visible outcomes.

### Apply to your product

- Store **`{ jobId, externalSessionId, taskType, startedAt, isLongRunning }`** in your DB for **every** delegated run.
- **Polling clocks** should use **“time since attach”** or **“time since last heartbeat”**, not only **“time since spawn”**, after reconnect.
- **Typed handlers** (`registerCompletionChecker`) mirror **per-integration completion rules** (PR merged, plan approved, etc.).

---

## 6. Background housekeeping (`backgroundHousekeeping.ts` — referenced in search)

Periodic maintenance for idle resources—pattern applies to **sweeping stale locks**, **old PID files**, **expired webhooks**.

### Apply to your product

Scheduled **janitor** for: stuck **permission tickets**, **orphaned workspaces**, **expired OAuth**, **queue dead letters**.

---

## 7. Bridge loop (remote control / environments) (`bridge/bridgeMain.ts`)

### What appears in the leak

- Large **`runBridgeLoop`** with backoff, session spawner, API client—pattern of **long-lived client** maintaining **connection** to **control plane** and **spawning** sessions on demand.

### Apply to your product

If agents run in **customer VPCs** or **local desktops**, you still need a **reconnecting bridge** with **exponential backoff** and **idempotent session create**.

---

## 8. Telemetry and tracing (throughout `utils/telemetry/`)

### What appears in the leak

- Session tracing, Perfetto, BigQuery export, **beta** session tracing, **skill loaded** events, attribute helpers.

### Apply to your product

- Correlate **Slack message id** ↔ **agent run id** ↔ **tool call id** in one trace.
- **Skill/plugin load** events matter when debugging **“why did production agent behave differently?”**

---

## Summary: long-running agent checklist

| Concern | Pattern in leak | Your implementation hint |
|---------|-------------------|---------------------------|
| Supervisor | `daemon` fast-path | Separate worker supervisor service |
| Registry | PID JSON files | DB table + heartbeat |
| Child transcripts | Isolated paths per task | Per-thread or per-run storage |
| Async lifecycle | Status before slow hooks | Commit state early |
| Kill | Partial result extraction | Save last good assistant text |
| Remote resume | Sidecar metadata | Job row + reconcile on login |
| Long-running flag | No complete on first result | State machine per job type |
| IPC | BG flags, optional UDS | WebSocket + session token |
| Noise control | Don’t register subagents in `ps` | Filter child processes in UI |

---

## Files referenced (under `src/`)

- `entrypoints/cli.tsx` (daemon, bg fast paths)
- `utils/concurrentSessions.ts`
- `tasks/LocalMainSessionTask.ts`
- `tools/AgentTool/agentToolUtils.ts`
- `tasks/RemoteAgentTask/RemoteAgentTask.tsx`
- `utils/sessionStorage.ts` (remote agent metadata helpers)
- `utils/messageQueueManager.ts` (agent notifications)
- `utils/backgroundHousekeeping.ts`
- `bridge/bridgeMain.ts`
- `utils/telemetry/*`
- `daemon/main` (referenced; may be missing from tree)
