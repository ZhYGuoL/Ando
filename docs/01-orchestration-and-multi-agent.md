# Orchestration and multi-agent patterns (from `src/`)

**Audience:** You are building a **Slack-like product** where **teams** interact with **long-running agents** that own ongoing work. This document extracts **orchestration and multi-agent** ideas from the leaked Claude Code–style `src/` snapshot and maps them to that product—**patterns and architecture**, not code to copy verbatim.

**Provenance:** Unverified third-party leak; see repo `README.md`. Do not assume any feature shipped or works as described.

---

## Why this matters for your app

Team products need clear answers for:

- Who is the **orchestrator** vs a **worker**?
- How do workers **inherit policy** (model, permissions, plugins)?
- How do you **cap parallelism** (cost, rate limits, UX)?
- How do you **resume** after disconnect when identity lived in a session?

The leak encodes several concrete approaches.

---

## 1. Team as a first-class object (`teamHelpers.ts`, `reconnection.ts`)

### What appears in the leak

- A **`TeamFile`** persisted as `~/.claude/teams/{team}/config.json` (sanitized names) with:
  - **`leadAgentId`**, optional **`leadSessionId`** (for discovery)
  - **`members`**: each with `agentId`, `name`, optional `agentType`, `model`, `prompt`, `color`, `planModeRequired`, `joinedAt`, `tmuxPaneId`, `cwd`, `worktreePath`, `sessionId`, **`subscriptions`**, `backendType`, **`isActive`** (idle vs running), **`mode`** (permission mode)
  - **`teamAllowedPaths`**: shared edit allowlist (path + tool + who added it)
  - Optional **`hiddenPaneIds`** for UI

- **Reconnection:** On resume, teammate context can be rebuilt from **team name + agent name** stored in the transcript, by re-reading the team file and matching the member (`reconnection.ts`).

### Apply to your product

- Treat each **workspace / channel family** as something like **`TeamFile`**: a durable record of **which agents exist**, their **roles**, and **policy**.
- Persist **leader vs member** explicitly so any client can reattach.
- Use **`isActive` / idle** for presence-style UI (“this agent is waiting” vs “working”).
- **`teamAllowedPaths`** is the sketch of **scoped capabilities**: shared rules for what any teammate may touch without escalation.

---

## 2. Spawning and inheriting policy (`spawnUtils.ts`, `constants.ts`)

### What appears in the leak

- **`getTeammateCommand()`**: override binary via env (`CLAUDE_CODE_TEAMMATE_COMMAND`) for tests or alternate runners—same idea as your product pointing workers at a specific **worker image** or **runtime version**.

- **`buildInheritedCliFlags`**: propagates from parent to child:
  - Permission mode (`bypassPermissions` / `acceptEdits`) unless **`planModeRequired`** (then bypass is **not** inherited—plan mode wins for safety)
  - Model override, settings path, inline plugins, teammate mode, Chrome flags

- **`buildInheritedEnvVars`**: forwards provider endpoints, config dir, remote markers, proxy/CA bundles so subprocesses don’t **silently hit the wrong API or bypass TLS/proxy policy**.

### Apply to your product

- Every **child agent run** should get an explicit **policy bundle**: auth, model, tool allowlists, and **“plan-only until approved”** style gates.
- **Parent overrides** for dangerous shortcuts (e.g. full auto-approve) should be **blocked** when the child is in a stricter mode—mirror the plan-mode precedence idea.

---

## 3. Swarm backends and isolation (`swarm/backends/`, `teammateContext.ts`)

### What appears in the leak

- Multiple **backends** (tmux panes, iTerm, in-process, etc.) for where a “teammate” actually runs.
- **`TeammateContext`** via **`AsyncLocalStorage`**: in-process teammates get **per-task identity** (`agentId`, `agentName`, `teamName`, `color`, `planModeRequired`, `parentSessionId`, `abortController`) without clobbering globals—important when many agents share one Node process.

- **`leaderPermissionBridge.ts`**: module-level registration so the **leader’s** React-driven permission UI can service **in-process** teammate permission requests.

### Apply to your product

- You may run workers in **separate processes/containers** (like tmux panes) **or** **in-process** (lower latency, harder isolation). The leak’s split matches a real design fork:
  - **Process isolation** → stronger security, higher overhead.
  - **In-process + AsyncLocalStorage-style context** → needs strict **tool sandboxing** and **permission bridging** to a single UI.

---

## 4. Coordinator mode: shrink the orchestrator’s tool surface (`toolPool.ts`, `constants/tools.ts`)

### What appears in the leak

- When **`COORDINATOR_MODE`** is on and env **`CLAUDE_CODE_COORDINATOR_MODE`** is truthy, the tool pool restricts to:

  **`COORDINATOR_MODE_ALLOWED_TOOLS`**: `Agent`, `TaskStop`, `SendMessage`, `SyntheticOutput` (names from `constants/tools.ts`).

- Slash-command / worker path notes that **coordinator mode** is inherited by workers via env (`processUserInput` / `processSlashCommand.tsx` references).

### Apply to your product

- Your **#general orchestrator bot** should often **not** have the same tools as a **repo worker**. A dedicated **coordinator persona** with only:
  - **delegate / spawn / message / stop task / emit status**
  reduces **prompt injection → arbitrary action** risk and matches how teams actually use Slack (coordinate in channel, execute elsewhere).

---

## 5. Plan mode and parallel exploration caps (`planModeV2.ts`)

### What appears in the leak

- **`getPlanModeV2AgentCount()`**: default parallel agents depend on **subscription/tier** (e.g. higher tiers → more parallel agents), overridable by **`CLAUDE_CODE_PLAN_V2_AGENT_COUNT`** (clamped 1–10).
- **`getPlanModeV2ExploreAgentCount()`**: separate cap for “explore” agents, env **`CLAUDE_CODE_PLAN_V2_EXPLORE_AGENT_COUNT`**.
- **`isPlanModeInterviewPhaseEnabled()`**: interview phase gated by internal user type, env, and remote config.
- **`getPewterLedgerVariant()`**: experiment controlling how **verbose plan files** should be (trim/cut/cap)—operational detail that **long team threads** also hit (plan bloat → cost and rejection).

### Apply to your product

- Expose **org-level caps** on **parallel sub-agents** and **exploration depth**; allow **env/admin overrides** for enterprise.
- Treat **plan artifact size** as a **product metric**: huge plans hurt **human review** in Slack-like UIs and increase **token spend**.

---

## 6. Remote / delegated tasks (`RemoteAgentTask.tsx`, `ultraplan/`)

### What appears in the leak

- **`registerRemoteAgentTask`**: unified registration for remote work with:
  - **`isUltraplan`**, **`isLongRunning`**, **`isRemoteReview`**
  - **`remoteTaskType`**: e.g. `remote-agent`, `ultraplan`, `ultrareview`, `autofix-pr`, `background-pr`
  - **Polling** and **metadata** (e.g. PR owner/repo/number)
  - **`isLongRunning`**: explicitly “not complete after first `result`”—matches **agents that keep streaming or revisiting work**.

- **Sidecar persistence** (`persistRemoteAgentMetadata`): stores identity so **`--resume`** can reconnect; completion removes metadata so finished jobs don’t resurrect.

- **Ultraplan phases** surface in UI (`needs_input`, `plan_ready`, etc.)—good analogue for **agent state badges** in a channel.

### Apply to your product

- Any **long job** should have: **type**, **external id**, **spawn time**, **poll/heartbeat strategy**, and **durable handoff** so **refreshing the client** doesn’t orphan work.
- Distinguish **one-shot tasks** from **`isLongRunning`** in your task model and notifications.

---

## 7. Discovery and footer UX (`teamDiscovery.ts`)

### What appears in the leak

- Scans teams directory to find teams where **this session is leader**.
- **`getTeammateStatuses`**: reads `TeamFile` and maps members to **running/idle**, hiding **`team-lead`** from the teammate list, surfacing **hidden panes**, **backend type**, **permission mode**.

### Apply to your product

- Ship a **team rail** or **workspace sidebar**: **who is up**, **who is idle**, **which agent owns which task**—all derived from a **single durable team config**, not ephemeral WebSocket state alone.

---

## Summary: orchestration checklist for your Slack-like agent product

| Pattern in leak | Your product analogue |
|-----------------|------------------------|
| `TeamFile` + members array | Workspace agent registry + roles |
| Leader vs member IDs | Orchestrator bot vs worker agents |
| Inherited env/flags | Job template: model, auth, plugins, proxies |
| `planModeRequired` | Human approval before execution |
| Coordinator tool allowlist | Narrow tools for channel-facing bot |
| Plan/explore agent caps | Org policy + cost control |
| Remote task metadata + resume tokens | Durable job handles for reconnect |
| `isLongRunning` | Streaming / recurring agent contracts |
| Idle/active on members | Presence + workload indicators |

---

## Files referenced (under `src/`)

- `utils/swarm/teamHelpers.ts`, `utils/swarm/reconnection.ts`, `utils/swarm/constants.ts`, `utils/swarm/spawnUtils.ts`
- `utils/swarm/leaderPermissionBridge.ts`, `utils/teammateContext.ts`
- `utils/teamDiscovery.ts`
- `utils/toolPool.ts`, `constants/tools.ts`
- `utils/planModeV2.ts`
- `tasks/RemoteAgentTask/RemoteAgentTask.tsx`
- `utils/ultraplan/` (CCR session, teleport sentinels)
- `utils/teammate.ts`, `utils/teammateMailbox.ts` (cross-agent mail—see messaging doc)
- `utils/permissionSync.ts` (permissions over mailbox—see messaging doc)
