# Product sync from `demo/quick-demo` (inventory)

**When:** 2026-04-21  
**Source worktree:** `Ando-demo` (`demo/quick-demo` working tree)  
**Target worktree:** `Ando-product` (`product/platform`)

## Step 1 — Diff & tags

| Path | Tag | Notes |
|------|-----|--------|
| `src/store/index.ts` | **ship** | Full copy: feed seeds, subprocess demo advance, Paper MCP integration types, `feedMessageSubprocesses`, `DEMO_HUMAN_AUTHOR`, etc. |
| `src/App.tsx` | **ship** | Matches demo shell, feed, mission control, subprocess UI. |
| `src/mcp/paperMcp.ts` | **adapt** | Demo transport stub; replace with real MCP/BFF when wiring production. |
| `src/components/demo/DemoControls.tsx` | **adapt** | Renders only in `import.meta.env.DEV` or `?demo=1` — safe for prod build; remove import from `App.tsx` if you want zero demo chrome in bundle. |
| `src/components/completion/CompletionCard.tsx` | **ship** | |
| `src/components/permission/{PermissionCard,MockFeedMessage}.tsx` | **ship** | |
| `src/{Completion,Permission}CardReviewPage.tsx` | **ship** | |
| `src/index.css` | **ship** | |
| `index.html` | **ship** | Aligned with demo (title/meta if changed). |
| `docs/paths/*.md` | **drop** (branch-specific) | Do not overwrite product path docs with demo’s; keep `CONTEXT-product-platform.md`. |

## Step 2 — Shell + store (done)

Store and app shell are aligned with demo via file copy + successful `npm run build`.

## Step 3 — Screens + polish (ongoing)

- [ ] Read `product.md` / `brand.md` when present and reconcile copy.
- [ ] Replace Paper MCP stub with API-backed implementation.
- [ ] Persistence (Supabase/BFF) per `CONTEXT-product-platform.md`.
- [ ] Optional: tree-shake `DemoControls` from production bundle (dynamic import or strip in build).

## Step 4 — Demo-only hygiene

- `DemoControls` is already gated; subprocess “demo” timing lives in store — rename or isolate when real progress events exist.
