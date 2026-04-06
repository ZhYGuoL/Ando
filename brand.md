---
description: Nave brand aesthetic and design system — apply to all UI work
alwaysApply: true
---

# Nave Corp — Design System

## Philosophy

Derived from core values: **Brutalist Clarity**, **Craft Over Slop**, **Quiet Intensity**.

Form follows function. Every element earns its place. Nothing is hidden, nothing is decorative. The UI should feel demanding but never joyless — precise, composed, and built to last.

---

## Color Palette

### Base (monochrome)
| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#0f0f0f` | Primary text, max contrast |
| `--color-dark-surface` | `#1a1a1a` | Dark UI surfaces, inverse backgrounds |
| `--color-background` | `#f5f4f0` | App background (warm off-white, not pure white) |
| `--color-surface` | `#ebebeb` | Cards, panels, secondary surfaces |
| `--color-muted` | `#9a9a9a` | Placeholder text, disabled states |
| `--color-border` | `#d4d0c8` | Dividers, borders |
| `--color-warm-accent` | `#c8b89a` | Secondary accent, used very sparingly |

### Sidebar — warm ink (not flat black)

The rail is **chromatic dark**: a very deep **warm brown-gray** so it relates to the shell’s **warm paper** (`#f5f4f0`) instead of reading as a default `#000` block. Implementation lives in `src/index.css` as `--nave-sidebar-*` tokens (background `#151311`, edges `#2e2925`, hover `#1f1c18`, etc.). IKB active rows stay **`#161b2b`** — unchanged.

### Brand Color — IKB (International Klein Blue)
| Token | Hex | Usage |
|---|---|---|
| `--color-ikb` | `#002FA7` | Primary brand color — Yves Klein, 1960 |
| `--color-ikb-light` | `#e8eef8` | IKB tint for hover backgrounds |
| `--color-ikb-mid` | `#6685cc` | IKB mid for ghost borders |
| `--color-ikb-dark` | `#001254` | IKB deep for pressed states |

### IKB Rules — Critical
- IKB appears on **one focal element per view, maximum**
- Its power comes entirely from restraint — it hits hardest when everything around it is near-neutral
- **Use IKB for:** primary CTA buttons, active nav states, focus rings, key metric numbers, links, progress indicators
- **Never use IKB for:** large background fills, decorative borders, body copy, secondary actions, error/warning states, multiple elements simultaneously

---

## Typography

**Primary UI:** [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) — engineered, legible, slightly humanist. Reads as **tooling and infrastructure**. Open license. Self-hosted via `@fontsource/ibm-plex-sans` (**400**, **500**).

**Monospace (paths, resources, ids):** [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) — same family system as Plex Sans. `@fontsource/ibm-plex-mono` (**400**).

**Vite:** Fonts load through **Fontsource** CSS imports in `src/main.tsx` (no `next/font`).

No display fonts, no serifs in UI except rare editorial moments.

```
/* App default — see src/index.css @theme */
font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
```

### Alternative typefaces (if you pivot later)

All are **distinct from Inter/Roboto** but still compatible with **brutalist clarity** — pick one family and commit.

| Face | Character | Best when |
|---|---|---|
| **IBM Plex Sans** (default) | Technical, institutional craft | Default — current shell |
| **[Source Sans 3](https://fonts.google.com/specimen/Source+Sans+3)** | Humanist, high readability | Long-reading comfort; pair with Source Code Pro |
| **[Geist Sans](https://vercel.com/font)** | Tight, Swiss-leaning dev UI | Sharper “tool” posturing; `@fontsource/geist-sans` + Geist Mono |
| **[Sometype Mono](https://fonts.google.com/specimen/Sometype+Mono)** | Distinct mono | Mono-only accent paired with another UI sans |
| **[Newsreader](https://fonts.google.com/specimen/Newsreader)** (serif) | Editorial, serious | **Rare** — marketing/report headings only |

**Avoid for Nave:** Inter, Roboto, Open Sans, Space Grotesk, “rounded” consumer sans — they fight **quiet intensity** or read as 2024 generic AI UI.

### Type scale (fixed sizes, app shell)

The shell is dense; 14px body is acceptable for panels. For **long prose** (docs, legal), prefer **15–16px** body and `max-width: 65ch` where copy runs long.

| Role | Size | Weight | Tracking | Line Height | Usage |
|---|---|---|---|---|---|
| Display | 28px | 500 | -0.02em | 1.1 | Hero headings, section titles |
| Heading | 18px | 500 | -0.01em | 1.3 | Panel titles, card headers |
| Body | 14px | 400 | 0 | 1.6 | Default text, descriptions |
| Small | 12px | 400 | 0 | 1.5 | Supporting text, captions |
| Label | 11px | 400 | 0.08em | 1 | Uppercase metadata, markers, timestamps |

### Typography rules
- **Sentence case always** — never Title Case, never ALL CAPS (labels excepted)
- Two weights only: 400 regular, 500 medium. Never 600 or 700 — too heavy
- No mid-sentence bolding. Entity names go in `code style`, not **bold**
- Labels are always uppercase with 0.08em letter-spacing
- Negative tracking on large type only (-0.02em display, -0.01em heading)

---

## Spacing

Base-4 scale. Generous padding. Whitespace is structure, not filler.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Micro gaps, icon padding |
| `--space-2` | 8px | Tight component internals |
| `--space-3` | 16px | Default component padding |
| `--space-4` | 24px | Section padding, card padding |
| `--space-5` | 32px | Component separation |
| `--space-6` | 48px | Section separation |
| `--space-7` | 64px | Page-level breathing room |

Panel/card padding: 24px. Page margins: 48px minimum.

---

## Borders & Surfaces

- **Default border:** `0.5px solid #d4d0c8`
- **Emphasis border:** `0.5px solid #9a9a9a`
- **IKB border (focus/active):** `0.5px solid #002FA7`
- **Border radius:** 4–6px maximum. Never exceed 6px — sharp is intentional
- **No drop shadows** — ever. Elevation is not part of this system
- **No gradients** — ever. Flat surfaces only
- Dividers are `0.5px` lines, not thick rules

---

## Components

### Buttons
```css
/* Primary — IKB */
background: #002FA7;
color: #ffffff;
border: none;
border-radius: 4px;
padding: 8px 16px;
font-size: 13px;
font-weight: 400;

/* Secondary */
background: transparent;
color: #0f0f0f;
border: 0.5px solid #d4d0c8;
border-radius: 4px;
padding: 8px 16px;
font-size: 13px;

/* Hover: secondary gets background #ebebeb */
/* Active: scale(0.98) */
/* Never use rounded pill buttons */
```

### Cards
```css
background: #f5f4f0; /* or white for raised */
border: 0.5px solid #d4d0c8;
border-radius: 6px;
padding: 24px;
/* No box-shadow */
```

### Inputs
```css
border: 0.5px solid #d4d0c8;
border-radius: 4px;
padding: 8px 12px;
font-size: 14px;
background: #ffffff;

/* Focus state — IKB border */
border-color: #002FA7;
outline: none;
```

### Status tags / pills
```css
/* Active — IKB */
background: #002FA7; color: #ffffff;

/* Pending — IKB ghost */
border: 0.5px solid #002FA7; color: #002FA7; background: transparent;

/* Neutral */
border: 0.5px solid #d4d0c8; color: #9a9a9a; background: transparent;

/* All pills: border-radius: 3px; font-size: 11px; padding: 3px 10px; letter-spacing: 0.04em; */
```

### Metric / stat displays
```css
/* Label above */
font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9a9a9a;

/* Number — use IKB for primary metrics */
font-size: 24px; font-weight: 500; color: #002FA7;

/* Supporting text below */
font-size: 12px; color: #9a9a9a;
```

### Dividers
```css
height: 0.5px;
background: #d4d0c8;
border: none;
margin: 24px 0;
```

---

## Motion — floaty drift

Nave UI uses a **light, aerial** motion language: elements ease into place with a soft deceleration; **buttons and primary click targets** get a **small hover lift** (`translateY`). **Static panels and cards** use **border / background transitions only** (`.nave-surface` + Tailwind `hover:border-*`) — alive, but not every box jumps. Motion still explains state (expand/collapse, navigation, press). **No drop shadows** for depth.

### Tokens (CSS variables)

Define on `:root` — use these everywhere for consistency:

| Token | Value | Usage |
|---|---|---|
| `--nave-float-ease` | `cubic-bezier(0.16, 1, 0.35, 1)` | Default “floaty” deceleration (slight overshoot feel, not bouncy physics) |
| `--nave-float-duration` | `420ms` | Hover rise, borders, backgrounds |
| `--nave-float-duration-short` | `280ms` | Opacity, micro feedback |
| `--nave-drawer-duration` | `420ms` | Grid `0fr` / `1fr` drawers (e.g. channel header) |
| `--nave-float-lift` | `2px` | Hover lift on **buttons** and **clickable cards** (light chrome) |
| `--nave-float-lift-dark` | `1px` | Same on `#0f0f0f` sidebar |

### Utility classes (`src/index.css`)

| Class | Behavior |
|---|---|
| `.nave-float` | Base transition pack: `transform`, `opacity`, `border-color`, `background-color`, `color` |
| `.nave-rise` | On hover/active: lifts by `--nave-float-lift`, active `scale(0.98)` — use on **buttons** and **clickable cards** |
| `.nave-rise-dark` | Same pattern with `--nave-float-lift-dark` — **sidebar** lists and nav |
| `.nave-surface` | **Non-lifting** panels: transition `border-color` / `background-color` — pair with `hover:border-*` in Tailwind |
| `.nave-enter` | One-shot entrance: fade + `translateY(14px)` → `0` |
| `.nave-stagger` | Direct children get `.nave-enter` with staggered `animation-delay` (list shells, message columns) |
| `.workspace-header-drawer` | Structural expand/collapse: grid rows + inner content drift (see stylesheet) |

### Rules

- Prefer **one motion family**: the drawer pattern + `.nave-float` + `.nave-rise*` + `.nave-surface` + enter/stagger. Do not mix unrelated easings on the same surface. **Do not** put hover lift on every bordered rectangle — reserve lift for real affordances.
- **Drawers**: animate height via `grid-template-rows: 0fr` ↔ `1fr`, not `height: auto`. Pair with opacity and a small inner `translateY` when collapsed (see `.workspace-header-drawer-content`).
- **Lists and feeds**: wrap the column in `.nave-stagger` so blocks ease in sequentially (subtle, ≤ ~1s total spread).
- **Reduced motion**: `prefers-reduced-motion: reduce` must **disable** transitions, hover lifts, and entrance animations — state changes remain instant.

---

## Icons

- Line icons only — no filled/solid icons
- Stroke width: 1.5px
- Size: 16px default, 20px maximum
- Color: inherits from text context — never independently colored except for IKB on active states
- No decorative icons — every icon must communicate function

---

## Do / Don't

### Do
- Use IKB on one focal element per view
- Use 0.5px borders as structural dividers
- Let whitespace carry layout weight
- Flat surfaces — no elevation hierarchy
- Explicit state — never rely on hidden affordances
- Sentence case everywhere
- Skeleton states instead of loading spinners
- Sharp corners (max 6px radius)
- Monochrome base, IKB as signal
- Use the **floaty motion** tokens and `.nave-*` utilities (`src/index.css`) for transitions, hovers, drawers, and list entrances — keep one family system-wide

### Don't
- Never use IKB on large background surfaces
- Never use gradients
- Never use drop shadows or box-shadows
- Never use decorative illustration or icons
- Never exceed 6px border-radius
- Never use loading spinners
- Never use color as decoration — only to encode meaning
- Never use font-weight 600 or 700
- Never use pure white (#ffffff) as background — use #f5f4f0
- Never use more than one IKB element per view

---

## Electron-specific notes

- Window chrome: frameless or minimal native titlebar, dark (#1a1a1a) or light (#f5f4f0) to match app theme
- Scrollbars: thin (6px), track transparent, thumb #d4d0c8, hover #9a9a9a
- Text rendering: `-webkit-font-smoothing: antialiased`
- No context menu styling — use native
- Vibrancy/blur effects: avoid — contradicts flat surface principle

---

## Voice & microcopy

Derived from "Brutalist Clarity" and "Negative Maintenance":
- Short, declarative sentences. No fluff.
- State what happened, not how to feel about it
- No exclamation marks
- No "successfully" — if it worked, just say what happened: "Saved." not "Successfully saved!"
- Error messages name the problem and the fix, nothing else
- Empty states explain the action, not the absence: "Add a project to get started" not "No projects yet"
