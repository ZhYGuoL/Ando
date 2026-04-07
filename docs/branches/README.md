# Branch working context

These files live next to this README. This **`docs/branches/`** folder is **tracked in Git** so every worktree gets the same context after `git merge`. The rest of **`docs/`** (outside `branches/`) stays **gitignored** unless you add it with a narrower rule.

| Worktree / branch | File |
|-------------------|------|
| `main` | `CONTEXT-main.md` |
| `demo/quick-demo` | `CONTEXT-demo-quick-demo.md` |
| `product/platform` | `CONTEXT-product-platform.md` |

**Demo and product agents:** read **`brand.md`** and **`product.md`** at the repo root before coding (each `CONTEXT-*.md` says so).

**`docs/01`–`04`:** optional inspiration (Claude Code–style agent/memory notes), **not** mandatory specs — see `CONTEXT-main.md`.

**Cursor:** Each `CONTEXT-*.md` starts with **Cursor session rules** — which folder to open (`Ando` vs `Ando-demo` vs `Ando-product`), one worktree per chat, and git habits.

All three Git lines share the same codebase; prefer **merging `main` into your line** periodically so shared fixes stay aligned.
