# Nave

Team workspace UI: channels, agent feed, permission and completion cards, agent cockpit, and mission control. Built with **Vite**, **React**, **TypeScript**, **Zustand**, and **React Router**.

## Scripts

| Command            | Description                 |
| ------------------ | --------------------------- |
| `npm run dev`      | Development server          |
| `npm run build`    | Typecheck + production build |
| `npm run preview`  | Preview production build    |
| `npm run lint`     | ESLint                      |

## For AI assistants

See **[AGENTS.md](AGENTS.md)** — worktrees, branches, git sync expectations, and where specs may live.

## Layout

- `src/App.tsx` — routes, workspace, home, cockpit, sub-process views  
- `src/store/` — Zustand store, selectors, seed data  
- `src/components/` — permission and completion cards, feed message chrome  

**Agent / worktree context** under `docs/branches/` is **committed** so all branches can share the same `CONTEXT-*.md` files after merging. **`brand.md`**, **`product.md`**, and most other **`docs/`** content stay **local-only**; keep copies if you use them.
