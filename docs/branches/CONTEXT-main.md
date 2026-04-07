# Context: `main` (integration baseline)

## Cursor session rules (read first)

- **Workspace folder:** This chat must assume Cursor’s **Open Folder** root is the **`Ando`** directory (same machine path as the repo on `main`), **not** `Ando-demo` or `Ando-product`, unless the human explicitly says otherwise.
- **One window = one worktree:** Do not assume another Cursor tab is editing this tree. Other lines run in sibling folders with their own chats.
- **Branch:** Treat the active Git branch as **`main`** (integration). Merge **`demo/quick-demo`** and **`product/platform`** in here when the human asks to integrate; resolve conflicts in this worktree.
- **`docs/branches/` is tracked;** other **`docs/`** paths, **`brand.md`**, and **`product.md`** are usually gitignored and may exist only locally. If something is missing, say so — don’t invent that the repo “has no spec.”
- **Sidebar / Explorer:** If `docs/` is hidden, the human can disable “Explorer: Exclude Git Ignore” or open files via **Cmd+P**.
- **Before substantial UI work:** Read **`brand.md`** and **`product.md`** in full (repo root).

## What this repo is

**Nave** — a Slack-like workspace UI where AI agents are first-class members. This codebase is a **browser Vite + React + TypeScript** shell (product spec may still mention Electron in places; the running app is web).

### Specs you should actually follow

- **`brand.md`** (repo root) — design system: IKB, typography, motion, surfaces. Trace UI decisions here.
- **`product.md`** (repo root) — screen inventory, feed patterns, permission/completion behavior at a product level.

Read **`brand.md`** and **`product.md`** in full before substantial UI work.

### `docs/01`–`04` — inspiration only

The files **`docs/01-orchestration-and-multi-agent.md`** through **`docs/04-long-running-agents-and-observability.md`** are notes **scraped from how Claude Code (and similar tools) talk about agents, memory, and queues**. They are **not** Nave law: use them for **ideas and vocabulary**, not as requirements you must implement verbatim.

## What has been built so far

- **Four navigable screens** (React Router): workspace feed (`/#channel=…`), agent cockpit (`/agent/:id`), sub-process detail (`/process/:id`), mission control home (`/home`).
- **Zustand store** (`src/store/index.ts`) as the single source of truth for:
  - `messages` — channel feed (`FeedMessage`: human / agent / permission / completion / subprocess metadata)
  - `agents` — status (`running` | `idle` | `blocked`), `currentTask`, `subProcesses`, `taskHistory`, `memory`, etc.
  - `permissionCardStates` — per message id (`pending`, `reviewing`, `approved`, `denied`, always-allow flow)
- **Sidebar** lists channels + agents from the store (`MISSION_AGENT_CARD_ORDER`); **no duplicate `agents` const** in the UI.
- **Permission resolution** is message-id aware: frontend permission (`msg-f-004`) vs infra / backend (`msg-i-003`) use different post-handlers.
- **Mission control** derives agent cards, pending permission rows, and activity feed from **selectors** in the store.
- **Navigation stack** + back bar with fallback to `#activeChannel` when the stack is empty.
- **Git worktrees** (optional): sibling folders **`Ando-demo`** (`demo/quick-demo`), **`Ando-product`** (`product/platform`).

## Your role on `main`

- Keep **`main`** as the **shared, buildable baseline**.
- Prefer **merging or cherry-picking** between lines deliberately when feature work diverges.

## Related

- `CONTEXT-demo-quick-demo.md` — fast demo line  
- `CONTEXT-product-platform.md` — persistence / API line  
