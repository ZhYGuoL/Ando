# Completion Card — Interaction Spec

> Read this file in full before writing any code.  
> Also read: **PRODUCT.md**, **PERMISSION_CARD.md**, **04-long-running-agents-and-observability.md**, **brand.md**

---

## Context

When an agent **finishes work** (or stops mid-flight), it surfaces a **completion card** inline in the channel feed, attached to the agent’s summary message. This is one leg of the **three completion signals** from product: (1) this card, (2) the IKB banner under the top bar, (3) the agent’s sidebar status returning to **idle**.

The card is not a modal. It stays in the feed as a durable record of outcome and metadata.

Natural follow-on from **permission cards**: permissions gate risky steps; the completion card is the **closing beat** — clear outcome, honest numbers, and next actions.

---

## States

Drive the UI with a `state` prop:

- `running` — task still finishing; card can appear while final checks or writes complete  
- `completed` — success; full stats; primary satisfaction state  
- `killed` — stopped with **partial** output; semantics are honest, not framed as success  
- `failed` — run failed; errors and copy reflect that; **no IKB** on error emphasis (brand)

---

## What every state shows

Aligned with **PRODUCT.md** (Screen 1):

- **Status dot** — encodes lifecycle (IKB = active work, green = completed, amber family = killed, red family = failed)  
- **Task name** — short outcome-oriented title (`Heading` scale from brand)  
- **Duration line** — elapsed or final duration + status word (`Small` + muted)  
- **Four stats** — `Files changed`, `Sub-processes`, `Errors`, `Approvals` — metric pattern from brand (uppercase label, large number; **one** IKB-highlighted primary metric on `completed`, errors use **negative** hue on `failed`, never IKB)  
- **Three actions** — `View diff`, `View run log`, `Assign follow-up` (button specs from brand)

Optional **context line** (`hint`) for `running`, `killed`, and `failed` — short, declarative (voice rules in brand).

### `running`

- Primary **IKB** action is **`View run log`** (live visibility). **`View diff`** and **`Assign follow-up`** are de-emphasized until the run settles (`product` allows diff after completion).  
- Dot: **IKB** (progress / active, not “done green”).  
- Supporting hint: e.g. finishing validation and writes — **no** spinners; skeleton or calm copy only (brand).

### `completed`

- Dot: **green** — explicit product requirement (“green status dot”).  
- **Files changed** is the **IKB** primary metric (single focal numeric emphasis per brand).  
- **`View diff`** is the **IKB** filled button; other two **secondary**.

### `killed`

- Slightly **warm tinted** surface and border (honest “stopped”, aligned with permission / blocked warmth — not success green).  
- **Files** may show a **partial** note.  
- Copy states partial output is available.  
- **`View diff`** remains **IKB** when diff exists (partial is still reviewable).

### `failed`

- **Cool-warm error tint** on surface/border; dot and errors stat use **failure** hue — **never IKB** for errors.  
- **`View run log`** is **IKB** (diagnose first); **`View diff`** de-emphasized.

---

## Content overrides (`taskName`, `stats`, …)

For **demo and shell** builds, copy can stay static. When embedding in a **real feed narrative**, pass:

- **`taskName`** — replaces default title  
- **`stats`** — partial merge into the row for the current `state` (e.g. `durationLabel`, `files`, `errors`, …)

**Permission card parity:** `PermissionCard` accepts optional **`actionTitle`**, **`resource`**, **`description`**, **`policyAgentName`**, **`policyPathGlob`** so feed stories stay consistent without forking components.

---

## Embedding in the feed

Same structural rules as **PERMISSION_CARD.md**:

- Card sits **under** the agent message body, **aligned with text** (not full-width past the avatar gutter).  
- **No gap** between message text and card when there is no intervening block; if a **sub-process** control sits between body and card, standard vertical rhythm (`mt-4`) between those blocks is fine.  
- Prefer **`MockFeedMessage`** (or equivalent) so **avatar**, **IKB agent name**, **tag**, and **timestamp** match product Screen 1.

```
[Avatar]  Agent name   [agent]   time
          Message text summarizing the outcome or ongoing run.

          ┌─ completion card ─────────────────────────────┐
          │  · task · stats · actions                     │
          └───────────────────────────────────────────────┘
```

---

## Animation

Match **brand.md** motion: **`nave-surface`**, **`nave-float`**, **`nave-rise`** on real buttons only. **No** sliding in from off-screen, **no** bounce. Transitions between lifecycle states should feel **immediate and calm** (opacity, border/background, collapse if a future compact resolved state is added).

Respect **`prefers-reduced-motion`** via global `.nave-*` disables in `index.css`.

---

## Simultaneous completions

Each completion card attaches to **one** agent message. Multiple tasks → multiple messages and cards, independent `state` each.

---

## Dev / review page

Hash route: **`#completion-card-review`** — all four states, each inside **`MockFeedMessage variant="agent"`**, labeled.

Order:

1. `running`  
2. `completed`  
3. `killed`  
4. `failed`  

---

## Implementation map

| Asset | Role |
|--------|------|
| `src/components/completion/CompletionCard.tsx` | Presentational `state` + optional `taskName` / `stats` |
| `src/components/permission/MockFeedMessage.tsx` | Feed row wrapper; optional `avatar`, `timestamp`, `variant` |
| `src/CompletionCardReviewPage.tsx` | Static review grid |
| `src/App.tsx` — workspace feed | Live shell: Patch + permission + Scout + completion |
