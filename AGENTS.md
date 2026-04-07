# Notes for AI coding agents (Nave / Ando)

This repository is often used as **several Git worktrees** on one machine. All worktrees share one `.git` directory; each checkout has **its own branch** and **its own working tree**.

## Worktree → branch map (typical layout)

| Open-folder root (example) | Branch            | Role |
|-----------------------------|-------------------|------|
| `…/Ando`                    | `main`            | Integration baseline; merge feature branches in here when asked to integrate. |
| `…/Ando-demo`               | `demo/quick-demo` | Demo line: fast, credible narrative. |
| `…/Ando-product`            | `product/platform`| Product line: v1-shaped, refresh-safe state, real API boundaries. |

Folder names may differ on your machine; infer the **active branch** with `git branch --show-current` if unsure.

## Git: nothing “syncs” between folders automatically

- Commits on `main` exist on **`main` only** until you **merge or rebase `main`** into `demo/quick-demo` or `product/platform` **in the worktree that is on that branch**.
- “Pulling” in one folder only updates **that folder’s checked-out branch**. To bring `.gitignore`, tooling, or shared fixes onto a feature line, run `git merge main` (or equivalent) **from that line’s worktree**.
- Treat **one Cursor window / one agent session ≈ one worktree** unless the human explicitly points you at another path.

## Specs and docs (fresh clone)

**Tracked in Git:** `docs/branches/` (`README.md`, `CONTEXT-*.md`) — same on every branch after you merge.

**Usually gitignored (may be missing on clone):** `brand.md`, `product.md` (repo root), and other paths under `docs/` outside `docs/branches/` (e.g. scratch notes).

If `brand.md` / `product.md` are absent, **do not invent** product or brand requirements — say they’re missing and ask the human to add copies. When they exist locally, read them before substantial UI work.

## Branch-specific agent context

Session rules live next to `docs/branches/README.md`:

| Branch            | Context file |
|-------------------|--------------|
| `main`            | `docs/branches/CONTEXT-main.md` |
| `demo/quick-demo` | `docs/branches/CONTEXT-demo-quick-demo.md` |
| `product/platform`| `docs/branches/CONTEXT-product-platform.md` |

Prefer the file that matches the **current branch** when the human `@`-mentions it.

## Security

Credentials and API keys belong on a **server or BFF**, not in client code or browser-shipped env vars. Never commit secrets.

## Project facts

- **Stack:** Vite, React, TypeScript, Zustand, React Router.
- **Scripts and layout:** see [README.md](README.md).
