# Context: `product/platform`

## Cursor session rules (read first)

- **Workspace folder:** Cursor **Open Folder** must be **`Ando-product`**, the worktree on **`product/platform`**. If the root is `Ando` or `Ando-demo`, stop and tell the human to open the correct folder.
- **One chat = this worktree only:** Edits belong under this worktree root only unless the human explicitly shares another path.
- **Git:** Commit and push from **`product/platform`**. Regularly **`git merge main`** here to reduce drift with shared UI.
- **Secrets:** API keys and provider credentials live on the **server / BFF** — never commit them; never put them in client env vars that ship to the browser.
- **`docs/branches/` is tracked;** **`brand.md`** / **`product.md`** and other **`docs/`** may be local-only — sync from the human’s canonical tree if needed.
- **Sidebar:** If `docs/` is hidden, use **Cmd+P** or disable “Explorer: Exclude Git Ignore.”

## If you are the “product” agent

You own the **`product/platform`** branch and the **`Ando-product`** worktree. Your goal is a **v1-shaped product**: state **survives refresh**, API boundaries are real, secrets never ship in the browser.

## Before you write code

1. Read **`brand.md`** (repo root) in full — design system, motion, IKB usage.
2. Read **`product.md`** (repo root) in full — screens, feed semantics, permission/completion patterns.

Those two files are the **binding** context for how Nave should look and behave while you add persistence and APIs.

## `docs/01`–`04`

Optional background: **`docs/01`–`04`** are scraped notes on agents, memory, queues, and observability (e.g. Claude Code–style framing). **Take inspiration only** — they are not specifications you must implement wholesale; prefer **`product.md`** and real Nave UX when they conflict.

## Suggested scope

- **Persistence** — e.g. Supabase for workspaces, channels, messages, permission state; map rows ↔ types in `src/store/index.ts`.
- **BFF / serverless** — API keys only on the server; client calls your API.
- **Auth (minimal v1)** — workspace-scoped identity.
- **Idempotency and audit** — approve/deny safe to retry; record who approved what.

## Do / don’t

- **Merge `main`** often for UI fixes.
- **Don’t** block on hyperscaler agent platforms until **one channel** is end-to-end.

## Related

- `CONTEXT-main.md`  
- `CONTEXT-demo-quick-demo.md`  
