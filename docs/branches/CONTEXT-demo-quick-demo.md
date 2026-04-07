# Context: `demo/quick-demo`

## Cursor session rules (read first)

- **Workspace folder:** Cursor **Open Folder** must be **`Ando-demo`** (sibling of `Ando` on disk), the worktree checked out on **`demo/quick-demo`**. If the root is `Ando` or `Ando-product`, stop and tell the human to open the correct folder — otherwise commits and branch will be wrong.
- **One chat = this worktree only:** Do not edit paths under `../Ando` or `../Ando-product` unless the human explicitly pastes files from there; your edits should live under this worktree root.
- **Git:** Commit and push from **`demo/quick-demo`**. Before big sessions, **`git merge main`** (or rebase if the team prefers) in this folder to pick up shared fixes.
- **`docs/branches/` is tracked;** **`brand.md`** / **`product.md`** and other **`docs/`** files may be local-only — keep copies in sync with the human’s canonical tree (often the `Ando` folder) if `@` references fail.
- **Sidebar:** If ignored files are hidden, use **Cmd+P** or turn off “Explorer: Exclude Git Ignore.”

## If you are the “demo” agent

You own the **`demo/quick-demo`** branch and the **`Ando-demo`** worktree (sibling folder to the main repo, same remote branches). Your goal is a **credible, fast-to-ship demo**: narrative clarity beats production completeness.

## Before you write code

1. Read **`brand.md`** (repo root) in full — design system, motion, IKB usage.
2. Read **`product.md`** (repo root) in full — screens, feed semantics, what “Nave” is supposed to feel like.

Those two files are the **binding** context for UI and product behavior on this branch.

## `docs/01`–`04`

Optional background: **`docs/01`–`04`** are scraped notes on agents, memory, and observability (e.g. Claude Code–style framing). **Take inspiration only** — they are not specs you must follow 100%.

## Suggested scope

- Keep **Zustand + seed** as source of truth; add **scripted actions** (buttons, dev shortcuts) that mutate messages/agents/permission state.
- Deploy **static** (Vercel / Netlify / Cloudflare Pages). No server required for the happy path.
- Optional: **one serverless function** + model API for a single “real” agent reply; still no DB.

## Do / don’t

- **Do:** One polished path (assign → permission → approve → completion → mission control).
- **Don’t:** Supabase / auth as a prerequisite for the demo (that belongs on `product/platform`).

## Merge strategy

Merge **UI fixes** into `main` or `product/platform` when stable; avoid dragging heavy product infra back into this branch.

## Related

- `CONTEXT-main.md`  
- `CONTEXT-product-platform.md`  
