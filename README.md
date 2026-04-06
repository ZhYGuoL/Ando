# Ando (Nave UI)

Slack-like workspace shell: channels, agent feed, permission and completion cards, agent cockpit, mission control. Built with **Vite**, **React**, **TypeScript**, **Zustand**, and **React Router**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

## Layout

- `src/App.tsx` — routes, workspace, home, cockpit, sub-process views  
- `src/store/` — Zustand store, selectors, seed data  
- `src/components/` — permission and completion cards, feed message chrome  
