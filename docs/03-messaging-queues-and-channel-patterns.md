# Messaging, inboxes, queues, and channel-style ingress (from `src/`)

**Audience:** A **Slack-like agent hub** needs **reliable delivery** of user messages, **agent-to-agent** coordination, **permission escalations**, and **system notifications**—without starving humans or cross-contaminating workers. This document covers the leak’s **mailbox**, **permission sync**, **command queue**, **cross-session socket**, and **KAIROS/channel** settings.

**Provenance:** Unverified leak; see repo `README.md`.

---

## Why this matters for your app

Slack’s core is **many producers, ordered consumption, and clear addressing** (channel, DM, thread). Agent systems need the same:

- **Per-agent inbox** (like DMs or app mentions).
- **Priority** so **urgent user input** beats **background chatter**.
- **Routing** so **worker notifications** don’t hijack the **coordinator**’s thread.
- **Optional third-party ingress** (MCP “channels”) with **enterprise gates**.

The leak implements several of these in a **CLI/TUI** context; the **patterns** transfer directly to a web product.

---

## 1. Teammate mailbox: file-backed agent inboxes (`teammateMailbox.ts`)

### What appears in the leak

- **Layout:** `~/.claude/teams/{team_name}/inboxes/{agent_name}.json` (sanitized path components via `sanitizePathComponent` from `tasks.ts`).

- **Message shape (`TeammateMessage`):** `from`, `text`, `timestamp`, `read`, optional `color`, optional short **`summary`** (preview in UI).

- **Concurrency:** **Lockfile** with **retry/backoff** (`retries: 10`, `minTimeout: 5ms`, `maxTimeout: 100ms`) so **multiple Claudes** in a swarm don’t corrupt JSON.

- **Integration:** Unread mail can surface as **attachments** to the recipient; **`SEND_MESSAGE_TOOL_NAME`** constant ties to a dedicated send tool; XML tag `TEAMMATE_MESSAGE_TAG` for structured content.

- **Permission workflow reuse:** Same mailbox path used by **`permissionSync.ts`** (see below).

### Apply to your product

- Implement **per-bot or per-worker inboxes** in your database (or object store) with **optimistic locking** or **per-inbox serial queues**—the leak’s **file + lock** is the minimal teaching example.
- Require **short previews** (`summary`) for **Slack-style** notification cards without loading full payloads.
- **Read receipts** (`read`) map to **“delivered to agent context”** or **“shown in UI.”**

---

## 2. Permission sync across swarm (`permissionSync.ts`)

### What appears in the leak

- **Problem:** Worker needs approval for a tool; **user** is at the **leader** UI.

- **Flow (documented in file header):**
  1. Worker hits permission prompt → sends **`permission_request`** to **leader’s mailbox**.
  2. Leader polls mailbox, surfaces UI.
  3. User approves/denies on leader.
  4. Leader sends **`permission_response`** to **worker’s mailbox**.
  5. Worker polls and continues.

- **Structured payload (`SwarmPermissionRequestSchema`):** `id`, `workerId`, `workerName`, `toolName`, `toolUseId`, `description`, `input`, `permissionSuggestions`, `status`, optional `feedback`, `updatedInput`, `permissionUpdates`, timestamps.

- **Storage:** Team-scoped **`permissions/pending/`** (and related dirs) under team directory for durable pending state (see `getPermissionDir`).

### Apply to your product

This is your **“approval in #infra from @manager while worker runs in sandbox”** pattern:

- **Never block** the worker thread on a **modal in another client** without a **timeout** and **clear state machine**.
- Persist **permission tickets** with **idempotency** (`toolUseId` + `id`).
- Support **`updatedInput`** and **rule updates** (“always allow this pattern”) as first-class outcomes—teams will want **policy evolution** from approvals.

---

## 3. Unified command queue (`messageQueueManager.ts`, `queueProcessor.ts`)

### What appears in the leak

**Single module-level queue** for:

- User input  
- Task notifications  
- Orphaned permissions  
- Other **injected** work items  

**Subscribers:** React via **`useSyncExternalStore`**; non-React code reads **`getCommandQueue()`** / length.

### Priority model

- **`QueuePriority`:** `'now'` > `'next'` > `'later'` (numeric order 0, 1, 2).
- **`enqueue`:** default priority **`next`**.
- **`enqueuePendingNotification`:** default **`later`** so **system messages don’t starve user input**.

### Dequeue semantics

- **`dequeue` / `peek`:** choose **lowest priority number** among candidates; **FIFO within same priority**.
- Optional **filter** (e.g. only **`agentId === undefined`** for main thread)—critical for correctness.

### `queueProcessor.ts` main-thread isolation

- **`isMainThread`:** `cmd.agentId === undefined`.
- If **`peek`** returned a **subagent-only** item without filtering, the processor could **spin without draining** and **stall user prompts** (comment documents this explicitly—PR **#18453**).

### Batching vs single-shot

- **Slash commands** and **`bash` mode** run **one at a time** (error isolation, exit codes, UI).
- Other commands: **drain all with same `mode`** as the highest-priority item in **one** `executeInput` batch—each becomes its **own user message** with its **UUID**. **Different modes are never mixed** in one batch.

### Persistence

- **`logOperation`** → **`recordQueueOperation`** in session storage—**audit/replay** of queue operations.

### `QueuedCommand` fields relevant to remote/team products (`textInputTypes.ts`)

- **`skipSlashCommands`:** remote/bridge text must not accidentally run **`/dangerous`** as local slash.
- **`bridgeOrigin`:** only **bridge-safe** slash commands when from remote clients.
- **`isMeta`:** message **hidden in transcript UI** but **visible to model**—for **ticks, teammate messages, resource updates**.
- **`agentId`:** route notification to **specific subagent** vs main thread.
- **`preExpansionValue`:** for **keyword detection** without paste-expanded noise.
- **`workload`:** provenance stamped onto **`UserMessage`** for structured analytics.

### Apply to your product

- Use **one inbound pipeline** with **priority tiers**, e.g.:
  - **`now`:** security prompts, @-urgent, modal-required permissions  
  - **`next`:** normal user messages  
  - **`later`:** digests, non-blocking agent status  

- Always **filter by recipient** (channel, thread, **agent instance id**) before dequeue—mirrors **`agentId`** filtering.
- For **Slack Events API**-style ingress, mirror **`skipSlashCommands` / `bridgeOrigin`**: treat external text as **data**, not **command injection**.

---

## 4. Cross-session messaging socket (`UDS_INBOX`, `concurrentSessions.ts`, `setup.ts`)

### What appears in the leak

- When **`UDS_INBOX`** feature is on, session PID registry JSON includes **`messagingSocketPath`** from **`CLAUDE_CODE_MESSAGING_SOCKET`**.
- **`setup.ts`** comment: socket exported before hooks so early consumers see it.

### Apply to your product

- **Unix domain sockets** are one implementation of **local IPC**; your cloud analogue is **per-session WebSocket** or **grpc stream** keyed by **session id**.
- Persist **reconnect handles** alongside **worker identity** (same idea as PID file metadata).

---

## 5. KAIROS, proactive ticks, and MCP “channels” (`settings/types.ts`, `messages.ts`, `messageQueueManager.ts`)

### What appears in the leak

- **`minSleepDurationMs` / `maxSleepDurationMs`** (when `PROACTIVE` or `KAIROS`): throttle **Sleep tool** for proactive ticks; **-1** = indefinite sleep until user input—useful for **managed/remote** environments.

- **`KAIROS` settings:** **`assistant`**, **`assistantName`**—assistant mode with **scheduled check-in skills** and custom system behavior.

- **`channelsEnabled` + `allowedChannelPlugins`:** enterprise opt-in for **MCP servers** declaring **`claude/channel`** to **push inbound messages** into the conversation; org **allowlist** can **replace** vendor default ledger.

- Code references tie **`KAIROS` / `KAIROS_CHANNELS`** to **message queue** and **message** construction (feature-gated).

### Apply to your product

- **Inbound integrations** (GitHub, Jira, PagerDuty) should match **channel capability** pattern: **explicit org toggle + plugin allowlist**.
- **Proactive agents** need **sleep/backoff policy** to avoid **API spend storms** and **notification fatigue**—the leak encodes this as **first-class settings**.

---

## 6. Remote task notifications (`RemoteAgentTask.tsx`)

- Remote tasks call **`enqueuePendingNotification`** when they need to surface completion to the user—fits the **same queue** as human input, at **`later`** priority by default.

### Apply to your product

- **Job completion** should enter the **same ordering system** as messages, with **lower priority than typing** unless marked urgent.

---

## Summary: messaging checklist

| Mechanism | Leak idea | Slack-like product analogue |
|-----------|-----------|------------------------------|
| JSON inbox + locks | Per-agent durable inbox | Per-bot queue / outbox table |
| Permission sync | Leader approves for worker | Channel-based approval with ticket id |
| Priority queue | now/next/later | Urgent vs background |
| `agentId` filter | Don’t steal wrong worker’s queue | Thread + bot instance routing |
| `isMeta` | System context without UI noise | Internal context messages |
| Bridge flags | No accidental slash from remote | Treat Slack text as untrusted |
| UDS path in registry | IPC endpoint for session | WebSocket URL + session token |
| KAIROS channels | MCP push with org gate | Enterprise integration allowlist |

---

## Files referenced (under `src/`)

- `utils/teammateMailbox.ts`
- `utils/swarm/permissionSync.ts`
- `utils/messageQueueManager.ts`, `utils/queueProcessor.ts`
- `types/textInputTypes.ts` (`QueuedCommand`)
- `types/messageQueueTypes.js` (imported by `messageQueueManager.ts` and `sessionStorage.ts` for `QueueOperationMessage`; the `.ts` source file is **not present** in this repo snapshot—only references exist)
- `utils/sessionStorage.ts` (`recordQueueOperation`)
- `utils/concurrentSessions.ts`
- `utils/messages/systemInit.ts` (`UDS_INBOX`)
- `setup.ts`
- `utils/settings/types.ts` (KAIROS, channels, sleep)
- `tasks/RemoteAgentTask/RemoteAgentTask.tsx`
- `tools/SendMessageTool/constants.js` (referenced paths in repo)
