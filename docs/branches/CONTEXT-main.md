# Context: `main` (integration baseline)

## What this repo is

**Nave** — a Slack-like workspace UI where AI agents are first-class members. This codebase is a **browser Vite + React + TypeScript** shell (product spec still mentions Electron in places; the running app is web). Visual system is in **`brand.md`** (IKB `#002FA7`, flat surfaces, near-monochrome).

Authoritative product framing: **`product.md`** plus **`docs/01`–`04`**. Read those before large feature work.

## What has been built so far

- **Four navigable screens** (React Router): workspace feed (`/#channel=…`), agent cockpit (`/agent/:id`), sub-process detail (`/process/:id`), mission control home (`/home`).
- **Zustand store** (`src/store/index.ts`) as the single source of truth for:
  - `messages` — channel feed (`FeedMessage`: human / agent / permission / completion / subprocess metadata)
  - `agents` — patch, scout, mux style data: status (`running` | `idle` | `blocked`), `currentTask`, `subProcesses`, `taskHistory`, `memory`, etc.
  - `permissionCardStates` — per message id (`pending`, `reviewing`, `approved`, `denied`, always-allow flow)
- **Sidebar** lists channels + agents from the store (`MISSION_AGENT_CARD_ORDER`); **no duplicate `agents` const** in the UI.
- **Permission resolution** is message-id aware: frontend permission (`msg-f-004`) runs `applyFrontendPostApproval` / `applyFrontendPostDeny`; infra / backend permission (`msg-i-003`) runs backend-specific post-handlers so approving Scout does not mutate Patch.
- **Mission control** derives agent cards, pending permission rows, and a merged activity feed from **selectors** in the store (not hardcoded lists).
- **Navigation stack** + back bar with fallback to `#activeChannel` when the stack is empty (`src/nav/NavStackContext.tsx`, `BackBar` in `App.tsx`).
- **Git worktrees** (optional): repo root `Ando` on `main`, sibling folders **`Ando-demo`** (`demo/quick-demo`), **`Ando-product`** (`product/platform`).

## Your role on `main`

- Keep **`main`** as the **shared, buildable baseline**: small UI fixes, refactors that both lines need, doc updates, dependency alignment.
- **Do not** land heavy demo-only hacks or production infra **only** on `main` without also deciding whether `demo/quick-demo` / `product/platform` should merge or cherry-pick.
- When feature lines diverge, **merge or cherry-pick** deliberately; resolve conflicts in `App.tsx` / `store/index.ts` with care — both are central.

## Useful commands

```bash
git worktree list    # from any linked checkout
npm run build        # must pass before merge to main
```

## Related

- [CONTEXT-demo-quick-demo.md](./CONTEXT-demo-quick-demo.md) — fast demo line  
- [CONTEXT-product-platform.md](./CONTEXT-product-platform.md) — persistence / API line  
