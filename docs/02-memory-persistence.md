# Memory and persistence (from `src/`)

**Audience:** A **Slack-like team agent** product needs **durable memory** at multiple scopes: **per-user**, **per-team/workspace**, and **per-conversation/session**. This document summarizes how the leaked `src/` approaches **session memory**, **team memory**, and related **safety/sync** concerns, mapped to what you would implement.

**Provenance:** Unverified leak; educational indexing only (repo `README.md`).

---

## Why this matters for your app

Long-running agents fail without:

- A **scratchpad** that survives **context compaction** and **session restarts** (facts, decisions, open threads).
- A **shared team layer** so the **next human or agent** picks up where others left off—without dumping secrets into a public channel.
- **Clear scope rules**: private vs team vs channel-visible.

The leak implements much of this as **file-backed** memory with **explicit indexing** and **heavy path validation** for team scope.

---

## 1. Session memory: background extraction (`services/SessionMemory/sessionMemory.ts`)

### What appears in the leak

- **Purpose:** Maintain a **markdown file** of notes about the **current conversation**, updated **periodically in the background** without blocking the main chat.

- **Gate:** Feature flag (`tengu_session_memory`) and remote config (`tengu_sm_config`)—non-blocking cached reads.

- **Threading model:** Runs only when `querySource === 'repl_main_thread'` so **subagents/teammates** don’t all trigger extraction.

- **When to extract (`shouldExtractMemory`):**
  - After **initialization threshold** (context tokens ≥ configured minimum)—aligned with **autocompact** token counting.
  - Between updates: requires **minimum token growth** since last extraction **and** either:
    - enough **tool calls** since last update, **or**
    - **no tool calls** in the last assistant turn (natural “pause”) **while** token threshold met.
  - Design intent: avoid **extracting too often**; token threshold is **always** required once initialized.

- **How extraction runs:**
  - **`createSubagentContext`** + **`runForkedAgent`**: isolated fork so memory work **doesn’t mutate parent agent state** or caches incorrectly.
  - Prompt built from **current memory file** + path (`buildSessionMemoryUpdatePrompt`).
  - **`canUseTool`** restricted so the fork can only touch the **memory file** (`createMemoryFileCanUseTool`).

- **Operational hooks:** `waitForSessionMemoryExtraction` (timeout/stale detection), analytics events for gate failures (internal user type).

### Apply to your product

- Run **memory compaction** as a **separate job** (queue, worker, or forked run) with **narrow write permissions**—never the full prod toolset.
- Tie **“when to summarize”** to **observable conversation pressure** (tokens, tool bursts, turn boundaries)—not a fixed timer only.
- **Scope by thread:** only the **canonical session** for a channel/thread should run extraction; **worker agents** should write to **delegated memory** or **structured stores** you control.

---

## 2. Session memory configuration (`sessionMemoryUtils.ts`)

### What appears in the leak

Defaults (overridable by remote config):

| Setting | Default role |
|--------|----------------|
| `minimumMessageTokensToInit` | Don’t create memory until conversation is “large enough” (default **10_000** tokens in snippet) |
| `minimumTokensBetweenUpdate` | Minimum **context growth** between updates (default **5_000**) |
| `toolCallsBetweenUpdates` | Minimum **tool calls** between updates (default **3**) |

### Apply to your product

- Expose **org-level tuning**: noisy teams may want **less frequent** extraction; critical ops may want **more aggressive** checkpoints.
- Keep **one consistent token definition** across **autocompact**, **memory**, and **billing** to avoid surprising behavior.

---

## 3. Team memory: directory layout and prompts (`memdir/teamMemPaths.ts`, `teamMemPrompts.ts`)

### What appears in the leak

- **Enablement:** `isTeamMemoryEnabled()` requires **auto memory** on **and** a feature flag (`tengu_herring_clock`). Team memory is a **subtree** of auto memory—single switch keeps **prompt, injection, sync watcher** consistent.

- **Paths:**
  - **Team dir:** `<memoryBase>/projects/<sanitized-project-root>/memory/team/` (trailing separator normalized).
  - **Entrypoint file:** `.../team/MEMORY.md` (index / hub).

- **Prompt design (`buildCombinedMemoryPrompt`):**
  - Two scopes: **private** (user-only) vs **team** (everyone in project directory).
  - **Taxonomy** of memory types (from shared `memoryTypes.ts`: user / feedback / project / reference style guidance).
  - **Two-step save**: write a **file per memory** with **YAML frontmatter** (`MEMORY_FRONTMATTER_EXAMPLE`), then add a **pointer line** in the directory’s **`MEMORY.md` index** (~150 chars per line, index truncation after N lines).
  - Explicit: **no secrets** in team memories; **semantic** organization; **update in place** vs duplicates.

### Apply to your product

- Mirror the **private vs team** split as **DM agent memory** vs **workspace memory**.
- An **index file** (or vector metadata table) avoids loading **every** memory blob into context; agents **follow pointers**.
- Your Slack analogue: **team memory** is **not** the same as **channel messages**—it’s **curated**, **searchable**, and **policy-bound**.

---

## 4. Team memory security: path validation (`teamMemPaths.ts`)

### What appears in the leak

**Problem:** Team memory lives on disk; malicious or buggy agents could try **traversal**, **symlink escape**, or **unicode tricks**.

**Mitigations:**

- **`sanitizePathKey`**: reject null bytes, URL-encoded `../`, NFKC-normalized fullwidth dots/slashes, backslashes, absolute paths.
- **`isTeamMemPath`**: `resolve()` for string containment under team dir (fast reject).
- **`validateTeamMemWritePath` / `validateTeamMemKey`**: **realpath deepest existing ancestor** + containment on **real** team directory; handles **dangling symlinks**, **symlink loops**, **ENOTDIR** in middle path; **fail closed** on ambiguous errors.
- **`isTeamMemFile`**: enabled flag **and** path check—used from **`teamMemoryOps.ts`** to classify **read/search/write** for summaries (“Recalling team memories…”).

### Apply to your product

Even if you use **object storage** or a **DB**, keep the same **invariants**:

- **Keys** are not raw user strings; they’re **validated identifiers**.
- **No symlink-style escapes** if you ever mount **filesystem** backends.
- **Audit categories**: team memory ops are **first-class** in UX and **policy** (who can read/write shared memory).

---

## 5. Supporting pieces

- **`memdir/findRelevantMemories.ts`**, **`memoryScan.ts`**, **`memoryAge.ts`**: retrieval/refresh mechanics for file-based memory (scanning, staleness)—relevant if you implement **“load top-k memories before reply.”**
- **Remote/memory interaction:** `spawnUtils.ts` forwards **`CLAUDE_CODE_REMOTE_MEMORY_DIR`** so remote teammates don’t flip memory off/on incorrectly vs parent.

### Apply to your product

- **Sync team memory** at **session start** (leak’s prompt says team memories **sync at beginning of every session**)—your equivalent: **hydrate from workspace store** on agent wake.
- **Ephemeral environments** (sandboxes) need explicit **memory root** or **disable** to avoid **wrong persistence** or **leaks between tenants**.

---

## Summary: memory checklist

| Layer | Leak pattern | Your product analogue |
|-------|----------------|------------------------|
| Session | Forked agent updates markdown | Background summarizer job per thread |
| Session | Token + tool thresholds | When to checkpoint |
| Team | `team/` under project memory | Workspace-scoped store |
| Team | `MEMORY.md` index + files | Registry + documents |
| Team | Path hardening | Tenant-safe keys / no traversal |
| Ops | Wait/stale on extraction | Backpressure on summarize queue |

---

## Files referenced (under `src/`)

- `services/SessionMemory/sessionMemory.ts`, `services/SessionMemory/sessionMemoryUtils.ts`, `services/SessionMemory/prompts.ts`
- `memdir/teamMemPaths.ts`, `memdir/teamMemPrompts.ts`, `memdir/memoryTypes.ts`, `memdir/memdir.js` (paths), `memdir/paths.ts`
- `utils/teamMemoryOps.ts`
- `utils/forkedAgent.ts` (forked extraction pattern)
- `utils/permissions/filesystem.ts` (session memory paths)
