# Development lines

| Branch | Doc (see with `git show` below) | Intent |
|--------|-----------------------------------|--------|
| `demo/quick-demo` | `docs/paths/quick-demo.md` | Fast static demo; client-orchestrated state |
| `product/platform` | `docs/paths/product-platform.md` | Persistence, BFF, auth-shaped v1 |

**Baseline:** `main` holds the shared UI prototype. Feature work targets one branch; merge or cherry-pick into `main` when stable.

To read the scoped doc while on `main`:

```bash
git show demo/quick-demo:docs/paths/quick-demo.md
git show product/platform:docs/paths/product-platform.md
```
