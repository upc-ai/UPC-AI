# UPC AI — Design System

**Product:** UPC AI — Official AI-Powered Academic & Campus Assistant for Udai Pratap College (UPC), Varanasi
**Version:** 2.0 (supersedes v1.0 — full design-language pivot; replaces the indigo/dark-first system entirely)
**Status:** Approved design contract — the single source of truth for every UPC AI surface (marketing site, chat product, study tools, admin portal)
**Design language:** Warm-editorial: tinted cream canvas, serif display headlines, warm coral CTAs, dark navy product surfaces

> This document defines the complete visual system: tokens, typography, spacing, components, motion, accessibility, responsive behavior, and the consumable CSS custom properties. Engineering implements from Section 10 directly. **When this document and any other document disagree on visual matters, this document wins.**

---

## Table of Contents

- [Section 1 — Philosophy](#section-1--philosophy)
- [Section 2 — Color](#section-2--color)
- [Section 3 — Typography](#section-3--typography)
- [Section 4 — Spacing & Layout](#section-4--spacing--layout)
- [Section 5 — Components](#section-5--components)
- [Section 6 — Icons](#section-6--icons)
- [Section 7 — Animation & Motion](#section-7--animation--motion)
- [Section 8 — Accessibility](#section-8--accessibility)
- [Section 9 — Responsive Design](#section-9--responsive-design)
- [Section 10 — Design Tokens (CSS Custom Properties)](#section-10--design-tokens-css-custom-properties)

---

## Section 1 — Philosophy

### 1.1 Identity

UPC AI is the warmest, most editorial interface in the education-AI category. Where every other college software product uses cool blue + slate + white (ERP portals, LMS dashboards), UPC AI reads like a **literary publication**: a tinted cream canvas, a slab-serif display voice, a warm coral accent, and dark navy surfaces that carry the actual product chrome.

Five words: **Warm. Editorial. Considered. Grounded. Trustworthy.**

The system deliberately counter-positions against the cold "campus software" aesthetic. A student opening UPC AI at midnight before an exam should feel like they opened a well-set book, not an admin portal.

### 1.2 The Trinity

Every page is built from exactly three surface tones — no fourth is ever introduced:

1. **Cream canvas** — the default page floor (`#faf9f5` marketing / `#F0ECE0` product)
2. **Cream cards** — one step darker (`#efe9de` marketing / white + hairline product)
3. **Dark navy** — product chrome, code, mockups, footer (`#181715` family / `#2b2a27` family)

Coral (`#cc785c`) is the **voltage** — scarce on individual elements, generous only on full-bleed callout moments.

### 1.3 Principles

- **P1 — Warm canvas, never white.** Pure white and cool grays are forbidden as page floors. The cream tint is the brand.
- **P2 — Serif for display, humanist sans for everything else.** Display headlines are always the serif at weight 400–500 with negative tracking, never bold. Body is always the humanist sans. The split is unbreakable.
- **P3 — Color-block first, shadow rare.** Depth comes from cream↔dark surface contrast. Shadows appear almost nowhere.
- **P4 — Editorial pacing.** 96px between bands, generous 32px card padding, single-column reading widths. Whitespace is the layout.
- **P5 — Show the product, don't illustrate it.** Hero and feature moments use real product chrome (chat mockups, code windows, knowledge cards), not abstract marketing art.
- **P6 — WCAG 2.2 AA is the floor.** Warm palettes make contrast non-trivial; Section 8 defines the compliant pairings. Accessibility overrides brand fidelity when they conflict.
- **P7 — Coral is scarce.** One coral moment per viewport, roughly. The full-bleed coral callout band is the only place coral fills a large area.
- **P8 — Bilingual by design.** English and Hindi (Devanagari) are first-class. Every font stack carries a Devanagari-optimized fallback, and Hindi spans are always marked `lang="hi"`.

### 1.4 Brand Mark

UPC AI's mark is a **constructed letterform "U"** (Udai Pratap): three rectilinear strokes — a full-height pillar stem, a **floating right arm** raised above the base with an even air-gap, and a base bar tucked flush under the right edge. Uniform 120px strokes, even 60px air-gaps, optically centered in a 1024 viewBox. Strictly rectilinear — sharp corners, no rounding, one fill color.

**Monochrome discipline:** ink (`#141413`/black) on light surfaces · white on dark surfaces · accent orange (`#c96442`) tint only for the streaming/thinking marker. Never gradient, never multi-color.

**Sizing & lockup (premium convention — the OpenAI/Gemini ratio):** the `LogoMark` component uses a **tight viewBox** (`272 212 480 600` — artwork edge-to-edge, zero dead padding) with `size` = height; width auto-computes at the mark's 4:5 aspect (0.8×). In lockups the mark sits at **1.25× the wordmark text size** with a 10px gap ("UPC AI", Inter 500, tracking 0.01em). The favicon variant (`icon.svg`) is the square, padded enlargement: letterform scaled to 70% of canvas height (strokes 144, air-gaps 72, centered) so it reads at 16px. The mark always travels locked with the wordmark until recognition matures. It also serves as the chat greeting marker and the "AI is thinking" marker (may shimmer during generation only).

**Source of truth:** runtime = `LogoMark` component (`packages/ui`, currentColor SVG); assets = `packages/ui/src/assets/logo-black-on-white.svg` and `logo-white-on-black.svg`; favicon = `apps/web/src/app/icon.svg`.

### 1.5 Typeface Licensing Note

The reference design language uses licensed faces (Copernicus, StyreneB). UPC AI ships the documented open substitutes from day one — no licensing risk, near-identical character:

| Role | Typeface | Source |
|---|---|---|
| Display serif | **Cormorant Garamond** (500, −0.02em) | Google Fonts (OFL) |
| Body sans | **Inter** (400/500/600) | Google Fonts (OFL) |
| Mono | **JetBrains Mono** (400/500) | Google Fonts (OFL) |
| Hindi body | **Noto Sans Devanagari** (400/500) | Google Fonts (OFL) |
| Hindi display | **Noto Serif Devanagari** (500) | Google Fonts (OFL) |

If a licensed serif (e.g., Tiempos Headline) is ever acquired, it drops into the display stack with zero token changes.

---

## Section 2 — Color

### 2.1 Brand & Accent (theme-independent)

| Token | Hex | Use |
|---|---|---|
| `primary` (Coral) | `#cc785c` | Primary CTAs, brand moments, full-bleed callout cards, citation accents (large text only) |
| `primary-active` | `#a9583e` | Pressed/hover state of coral; **also the AA-safe small-text link color** |
| `primary-disabled` | `#e6dfd8` | Disabled primary buttons |
| `accent` (Product orange) | `#c96442` | In-product accents: send button, greeting U mark, focus rings, thinking marker, mode-chip selection |
| `accent-teal` | `#5db8a6` | Status dots, "indexed/available" indicators, terminal chrome (sparing) |
| `accent-amber` | `#e8a55a` | Small warm highlights, category badges (sparing) |

**Coral discipline:** coral appears on individual buttons and links, and generously on exactly one component — the full-bleed coral callout band. It never paints sidebars, navs, form fields, or charts.

### 2.2 Marketing Surfaces (landing page, public pages)

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#faf9f5` | Page floor — tinted cream, never pure white |
| `surface-soft` | `#f5f0e8` | Soft section bands, dividers |
| `surface-card` | `#efe9de` | Feature/content cards (one step darker than canvas) |
| `surface-cream-strong` | `#e8e0d2` | Active category tabs, emphasized bands |
| `surface-dark` | `#181715` | Dark navy: product mockup cards, code windows, CTA bands, footer |
| `surface-dark-elevated` | `#252320` | Elevated panels inside dark surfaces |
| `surface-dark-soft` | `#1f1e1b` | Code block interiors inside dark cards |
| `hairline` | `#e6dfd8` | 1px borders on cream — reads as elevation, not a line |
| `hairline-soft` | `#ebe6df` | Barely-visible internal dividers |

### 2.3 Product Surfaces (app: chat, study tools, admin)

| Token | Light | Dark | Use |
|---|---|---|---|
| `app-canvas` | `#F0ECE0` | `#2b2a27` | Main app background (chat reading surface) |
| `app-sidebar` | `#f5f0e8` | `#1f1e1b` | Sidebar floor |
| `app-card` | `#ffffff` | `#33322e` | Elevated cards, admin tables, modals |
| `app-card-soft` | `#f5f0e8` | `#1f1e1b` | Secondary cards, inputs' resting surface |
| `bubble-user` | `#E5E0D6` | `#393937` | User chat message bubble |
| `bubble-user-hover` | `#dcd5c6` | `#44423c` | Hover on user bubble actions |
| `composer-bg` | `#ffffff` | `#1f1e1b` | Prompt composer surface |
| `composer-border` | `#E5E0D6` | `#3d3a35` | Composer hairline border |
| `code-block` | `#1f1e1b` | `#141412` | Code blocks (warm dark in BOTH themes) |

### 2.4 Text Colors

| Token | Hex (on cream) | Hex (on dark) | Use |
|---|---|---|---|
| `ink` | `#141413` | `#faf9f5` | Headlines, primary text |
| `body-strong` | `#252523` | `#e8e6df` | Lead paragraphs, emphasized text |
| `body` | `#3d3d3a` | `#d4d1c7` | Running text |
| `muted` | `#6c6a64` | `#a3a098` | Sub-headings, secondary text |
| `muted-soft` | `#8e8b82` | `#8f8c84` | Captions, fine print (large/non-essential only) |
| `on-primary` | `#ffffff` | `#ffffff` | Text on coral |
| `link` | `#a9583e` | `#e0a188` | Inline links (AA-safe in both themes) |

### 2.5 Semantic

| Token | Hex | Background | Use |
|---|---|---|---|
| `success` | `#5db872` | `#eaf5ec` | Success toasts, status dots, quiz pass |
| `warning` | `#d4a017` | `#faf3dd` | Warnings, stale-content flags |
| `error` | `#c64545` | `#faebeb` | Validation, destructive, quiz fail |
| `info` | `#5b7fa6` | `#ecf1f6` | Neutral notices (warm-shifted blue, never brand-blue) |

Semantic colors never carry meaning alone — always paired with icon + text (Section 8).

### 2.6 Themes

- **Light (default).** The cream system above. UPC AI is light-first — the warm-editorial identity IS light mode.
- **Dark (warm).** A warm charcoal mirror (`#2b2a27` family, per 2.3). Dark mode is warm — never cool gray, never pure black. The previous OLED-black theme is dropped (one dark theme, done perfectly).
- **High contrast.** `data-contrast="high"` overrides: borders 2px, `muted-soft`→`muted`, 3px focus rings, semantic colors darkened one step, card↔canvas contrast strengthened. Token overrides in Section 10.4.

---

## Section 3 — Typography

### 3.1 Font Stacks

```css
--font-display: "Cormorant Garamond", "Noto Serif Devanagari", Garamond, "Times New Roman", serif;
--font-body: "Inter", "Noto Sans Devanagari", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, "Cascadia Code", Consolas, monospace;
```

The Devanagari faces sit inside both stacks — Hindi glyphs flow automatically when `lang="hi"` content appears, keeping voice consistent.

### 3.2 Scale

| Token | Size / Line | Weight | Tracking | Face | Use |
|---|---|---|---|---|---|
| `display-xl` | 64 / 1.05 | 400 | −1.5px | Display | Landing h1 |
| `display-lg` | 48 / 1.1 | 400 | −1px | Display | Section heads |
| `display-md` | 36 / 1.15 | 400 | −0.5px | Display | Sub-sections, chat greeting |
| `display-sm` | 28 / 1.2 | 400 | −0.3px | Display | Callout headlines, plan names |
| `title-lg` | 22 / 1.3 | 500 | 0 | Body | Large card titles |
| `title-md` | 18 / 1.4 | 500 | 0 | Body | Feature card titles |
| `title-sm` | 16 / 1.4 | 500 | 0 | Body | Small titles, list labels |
| `body-lg` | 16 / 1.6 | 400 | 0 | Body | AI response text, lead paragraphs |
| `body-md` | 16 / 1.55 | 400 | 0 | Body | Default running text |
| `body-sm` | 14 / 1.55 | 400 | 0 | Body | Secondary text, footer |
| `caption` | 13 / 1.4 | 500 | 0 | Body | Badges, captions |
| `caption-uppercase` | 12 / 1.4 | 500 | 1.5px | Body | Tags, "NEW"/"OFFICIAL" badges |
| `code` | 14 / 1.6 | 400 | 0 | Mono | Code blocks |
| `button` | 14 / 1.0 | 500 | 0 | Body | Button labels |
| `nav-link` | 14 / 1.4 | 500 | 0 | Body | Nav items |

**Rules.** Display type is never bold (400/500 only) — emphasis comes from size, not weight. Negative tracking on display sizes is non-negotiable. Body text never exceeds 16px except `body-lg` in AI responses. One `h1` per page; never skip heading levels.

### 3.3 AI Response Typography (chat markdown rendering)

- Assistant headings render in the **display serif** (`display-sm` for `#`, `title-lg` serif for `##`), body in `body-lg` sans — the editorial signature.
- Assistant text sits directly on the canvas (no bubble), max-width **680px** (~70 chars), left-aligned.
- Lists: 24px item spacing, markers in `muted`.
- Code blocks: `code-block` warm-dark surface in both themes, `on-dark` text, 16px padding, radius 12, horizontal scroll never wrap; syntax theme per Section 10.5.
- Tables: `body-sm` cells, uppercase `caption` headers, horizontal hairline dividers only, alternating rows on `app-card-soft`; tables stay atomic (never split).
- Math: KaTeX default fonts, display math centered with 16px vertical margins.
- Blockquotes: 3px `accent` left border, 16px padding, `muted` italic.
- Citations: superscript `[1]` in `accent`, weight 500 — click opens the sources panel.
- Hindi response text: `lang="hi"`, `body-lg` Devanagari stack, line-height 1.75 (Devanagari needs taller lines for matras).

---

## Section 4 — Spacing & Layout

### 4.1 Scale (4px base)

`xxs 4 · xs 8 · sm 12 · md 16 · lg 24 · xl 32 · xxl 48 · section 96`

### 4.2 Grid & Containers

- **Max content width:** 1200px centered (marketing); **680px** reading column (chat + AI responses); 960px admin tables; 1120px dashboards.
- **Hero:** 6/6 split (headline left, mockup card right) at ≥1024px.
- **Feature grids:** 3-up desktop → 2-up tablet → 1-up mobile.
- **Department/subject tiles:** 4-up desktop → 2-up tablet → 1-up mobile.
- **Card padding:** 32px (feature/mockup/plan cards), 24px (code windows, tiles), 48–64px (callout bands).

### 4.3 Band Rhythm (marketing)

Sections never repeat the same surface twice in a row. The pacing alternates:

```
canvas hero → cream feature cards → dark product mockup → canvas comparison
→ cream tiles → canvas testimonials → coral callout → dark footer
```

96px vertical padding between bands; internal card padding stays generous (32px).

### 4.4 App Layout Metrics

| Element | Size |
|---|---|
| Top nav (marketing) | 64px, `canvas` bg, hairline bottom border |
| Sidebar (app) | 260px expanded / 64px collapsed; 200–320px drag-resize |
| Composer | 48px collapsed → 200px expanded; sticky bottom, 16px page inset |
| Chat column | 680px centered, 24px message spacing |
| Sources panel | 360px right slide-in (mobile: bottom sheet 85%) |
| Admin table rows | 48px, `app-card` surface |

---

## Section 5 — Components

### 5.1 Marketing Components

**Top Nav** — 64px, `canvas`, hairline bottom. Left: U mark + "UPC AI" wordmark. Center-left links (Features, Knowledge, Study Tools, For Faculty, FAQ) in `nav-link`. Right: "Sign in" text-link + **button-primary** "Try UPC AI". `<768px`: hamburger → full-screen cream sheet.

**Hero Band** — 96px vertical padding on `canvas`. Left: `display-xl` serif headline, `body-lg` sub-head, button row (primary + secondary). Right: `hero-illustration-card` — a real UPC AI chat mockup on `surface-dark` (cream text, U mark greeting, citation chips), radius 16.

**Feature Card** — 3-up grid. `surface-card` bg, radius 12, 32px padding, small icon top, `title-md` head, `body-md` description. Icons: Lucide, 24px, `ink`.

**Product Mockup Card (dark)** — `surface-dark`, radius 12, 32px padding. Carries real product chrome: a chat exchange, a code window, or a knowledge result with citation chips. Text `on-dark`; accents `accent-teal`/`accent-amber` sparingly.

**Code Window Card** — `surface-dark` with `surface-dark-soft` interior, radius 12, 24px padding, line numbers in `muted-soft`, syntax colors per Section 10.5, JetBrains Mono. Used to show solved math/code answers.

**Knowledge Comparison Card** — canvas bg, hairline border, radius 12, 32px padding. Compares capabilities ("Ask anything" vs "Official college answers") with a `link`-style "See how" footer.

**Department/Subject Tile** — canvas bg, hairline border, radius 12, 20px padding, 64px identifier (department monogram in `surface-card` circle), `title-sm` name. Whole tile tappable.

**Callout Band (coral)** — full-width `primary` fill, radius 12 (inset from page edge by 24px), 48–64px padding, `display-sm` serif headline in `on-primary`, sub-line, and a **cream button** (canvas bg, ink text) as the CTA. One per page, placed pre-footer.

**CTA Band (dark)** — alternative pre-footer: `surface-dark`, `on-dark` text, pairs with a code-window or mockup card.

**Footer** — `surface-dark`, 64px vertical padding, 4-column link list (Product / College / Resources / Legal) in `body-sm` on `on-dark` at 70% emphasis, wordmark + U mark at top. Never inverts.

**Cookie/Consent Card** — bottom-right floating, `surface-dark`, radius 12, 24px padding.

### 5.2 Buttons

| Variant | Spec |
|---|---|
| **button-primary** | bg `primary`, text `on-primary`, `button` type, radius 8, padding 12×20, height 40. Press: `primary-active`. Disabled: `primary-disabled` bg + `muted` text. |
| **button-primary-accessible** | bg `primary-active` (#a9583e) — used wherever the label is small text in an AA-strict context (Section 8.2) |
| **button-secondary** | bg `canvas`, text `ink`, 1px `hairline` border, same metrics |
| **button-secondary-on-dark** | bg `surface-dark-elevated`, text `on-dark` — never inverts to light on dark surfaces |
| **button-text-link** | transparent, `ink`; press → `link` |
| **button-icon-circular** | 36px circle, `canvas` bg, hairline border, ink icon |
| **send-button** | 36px circle, bg `accent` (#c96442), white arrow icon; disabled `muted-soft`; becomes stop (square icon) while streaming |

Buttons darken on press only — no other hover styling exists in this system. One primary button per context. Minimum touch target 44×44 (visual size may stay 40 — padding extends the hit area).

### 5.3 Inputs

- **text-input** — bg `canvas`, 1px `hairline`, radius 8, 10×14 padding, height 40, `body-md`. Focus: border `accent` + 3px `accent`@15% outer ring.
- **composer** — the product's signature input: bg `composer-bg`, 1px `composer-border`, radius 16, padding 14×16, auto-expand 48→200px. Bottom toolbar: attach `+` (left), subject & mode pickers (left, `category-tab` style), send button (right). Focus ring on the whole composer. Placeholder in `muted`.
- **otp-input** — six 44px boxes, `text-input` styling, `title-lg` digits, auto-advance.

### 5.4 Chat Components

- **User message** — right-aligned, `bubble-user` bg, radius 16 (4px corner at the tail), max-width 80%, padding 10×14, `body-md`. Hover reveals edit/copy at low opacity.
- **Assistant message** — **no bubble, no avatar.** Editorial text directly on `app-canvas`, 680px column, `body-lg`. Hover reveals actions row (copy, thumbs, regenerate, bookmark) at low opacity.
- **Thinking indicator** — the U mark + "Thinking…" in *italic serif* (display face, 16px) with a slow text shimmer (opacity 0.5→1, 1.8s ease). During retrieval: "Searching college documents…" same treatment. Reduced motion: static text.
- **Citation chip** — inline superscript `[1]` in `accent`; sources panel card: numbered chip + `title-sm` doc title + page + 2-line snippet + relevance bar (visual only, never a number).
- **Sources panel** — 360px right slide-in (mobile bottom sheet). Cards on `app-card`, radius 12, 16px padding.
- **Mode chips** — study modes (Learn / Practice / Explain Simply / Challenge Me) as `category-tab` pills under the greeting and in the composer toolbar; active = `surface-cream-strong` bg + `ink` text.
- **Sidebar** — `app-sidebar` bg, hairline right border. Sections: collapse control, New Chat (secondary button, full-width), chat history grouped (Today / Yesterday / Previous 7 days / Older), Tools (Quizzes, Flashcards, Notes, Bookmarks), footer (Settings, profile). Items 36px, radius 8, hover `app-card-soft`, active `bubble-user` + 3px `accent` left bar.

### 5.5 Utility Components

| Component | Spec |
|---|---|
| **badge-pill** | `surface-card` bg, `ink` text, `caption`, pill radius, 4×12 padding |
| **badge-coral** | `primary` bg, `on-primary`, `caption-uppercase` — "NEW", "OFFICIAL", "URGENT" |
| **badge-semantic** | semantic bg tint + semantic text, `caption` — success/warning/error/info |
| **category-tab** | transparent bg, `muted` text, 8×14 padding, radius 8; active: `surface-card` bg + `ink` |
| **accordion** | hairline dividers, chevron 180° rotate 200ms, `title-sm` |
| **toast** | bottom-right (mobile: bottom-center), `surface-dark` bg, `on-dark` text, 3px semantic left border, radius 12, max 3 stacked, 4s (8s errors); `role="status"` |
| **dialog/modal** | `app-card` bg, radius 16, widths 480/640, max-height 85vh, 24px padding, overlay rgba(20,20,19,0.5); open: fade + 8px rise 250ms |
| **tooltip** | `surface-dark` bg, `on-dark` 12px text, radius 6, 400ms delay |
| **skeleton** | `app-card-soft` blocks, opacity pulse 0.55→0.8, 1.5s; appears only after 300ms |
| **spinner** | 20px, 2px `muted` border, `accent` top arc |
| **empty state** | U mark 40px in `muted-soft`, `title-md` heading, `body-sm` hint, optional secondary action |

---

## Section 6 — Icons

- **Library:** Lucide (tree-shaken, individual imports only).
- **Sizes:** 14 (1.5px stroke) · 16 (1.5) · 20 (1.75, default) · 24 (2) · 32 (2).
- **Color:** default `muted`; interactive icons inherit text color; active nav `ink` + `accent` bar; semantic per meaning; decorative → `aria-hidden="true"`; icon-only buttons require `aria-label`.
- **Icon + text gap:** 8px (6px compact). Icons lead text; trailing only for actions (copy, external).
- Never use color as the only signal — icons pair with text labels in all semantic cases.

---

## Section 7 — Animation & Motion

### 7.1 Signature: AI Streaming

1. User message appears instantly (no animation).
2. U mark + italic-serif "Thinking…" shimmer (0–2s).
3. Status line: "Searching college documents…" (builds trust that answers are grounded).
4. Tokens stream in batches appended at ~60fps (rAF), each batch fading in over **80ms** — no slide, no bounce.
5. Blinking caret (1s interval) at the stream head; disappears on completion.
6. Citation superscripts pop (scale 0.8→1 + fade, 150ms, spring) as they appear.
7. On completion: actions row fades in staggered 50ms; sources panel slides in (250ms) if citations exist.

### 7.2 Standard Motion

| Token | Value |
|---|---|
| instant | 0ms |
| fast | 100ms |
| normal | 150ms |
| moderate | 200ms |
| slow | 300ms |
| spring | 300ms cubic-bezier(0.34, 1.56, 0.64, 1) |

UI transitions: sidebar 200ms, dialogs 250ms fade+rise, dropdowns 150ms scale+fade, flashcard 3D flip 400ms (Y-axis), quiz score ring 1s ease-out, confetti at ≥90% quiz score. There are no hover animations in this system — press states only.

### 7.3 Reduced Motion

`prefers-reduced-motion` or the accessibility setting: streaming batches every 200ms with no fade; static thinking text; no shimmer, no confetti, no flip (100ms crossfade); instant panels; spinner allowed (motion-native), skeletons static.

---

## Section 8 — Accessibility

### 8.1 Contrast Pairs (validated)

| Pair | Ratio (approx) | Allowed use |
|---|---|---|
| `ink` on `canvas` / `app-canvas` | 15.8:1 / 14.9:1 | All text |
| `body` on `canvas` | 10.4:1 | Body text |
| `muted` on `canvas` | 5.4:1 | Secondary text |
| `muted-soft` on `canvas` | 3.9:1 | ≥18.66px bold or non-essential only |
| `on-primary` on `primary` #cc785c | 3.2:1 | Button labels — see 8.2 |
| `on-primary` on `primary-active` #a9583e | 4.6:1 | AA for all text sizes |
| `link` #a9583e on `canvas` | 4.6:1 | Inline links (all sizes) |
| `on-dark` on `surface-dark` | 14.9:1 | Dark surfaces |
| `accent` #c96442 on `app-canvas` | 3.6:1 | Citations/UI accents ≥18.66px bold or non-text |

### 8.2 The Coral Rule

Coral `#cc785c` is 3.2:1 against white text — it passes WCAG only for **large text and non-text UI**. Therefore:
- Marketing primary buttons use coral (14px/500 labels — accepted trade-off, documented); any context demanding strict AA (compliance surfaces, legal text) uses `button-primary-accessible` (#a9583e).
- **In-product** primary actions and all inline links use `accent`/`link` (#c96442/#a9583e) per the table above.
- Body-size text is never set in coral.

### 8.3 Requirements

- Full keyboard navigation; visible focus: 2px `accent` ring, 2px offset, `:focus-visible` only.
- Skip-to-content link; landmarks (`header/nav/main/complementary`).
- Streaming text announced via `aria-live="polite"`; toasts `role="status"`; errors `role="alert"`.
- Modals: focus trap + return focus; Escape closes.
- Touch targets ≥44×44 (48 on mobile); no text below 12px.
- Color never the sole signal (icons + text with every semantic color).
- Hindi spans: `lang="hi"`; KaTeX ships MathML for screen readers.
- High-contrast mode tokens (Section 10.4) override when enabled.

---

## Section 9 — Responsive Design

### 9.1 Breakpoints

| Name | Width | Key changes |
|---|---|---|
| Mobile | <768px | Hamburger nav (full-screen cream sheet); hero stacks; grids 1-up; bottom tab bar (5 tabs: Chat, Knowledge, Tools, Notifications, Profile); modals → bottom sheets; admin tables → stacked cards; chat: no avatars anywhere, alignment distinguishes roles |
| Tablet | 768–1024px | Nav tightens; feature 2-up; tiles 2-up; sidebar becomes drawer (edge-swipe); split-view stacks |
| Desktop | 1024–1440px | Full system as specified |
| Wide | >1440px | Same, more outer breathing room; content caps at 1200px |

### 9.2 Rules

- Display sizes collapse by step (64→48→36; 48→36→28; 36→28→24) at tablet/mobile; body sizes never change.
- Feature/tile grids **reduce column count**, never shrink cards.
- Code blocks scroll horizontally, never wrap.
- Plan-style cards collapse 3→2→1; the featured dark card stays visually distinct at every size.
- Avatars (testimonials, profile) crop to circles at all sizes.

---

## Section 10 — Design Tokens (CSS Custom Properties)

### 10.1 Brand & Semantic (theme-independent)

```css
:root {
  /* Brand */
  --primary: #cc785c;
  --primary-active: #a9583e;
  --primary-disabled: #e6dfd8;
  --accent: #c96442;
  --accent-teal: #5db8a6;
  --accent-amber: #e8a55a;

  /* Semantic */
  --success: #5db872;  --success-bg: #eaf5ec;
  --warning: #d4a017;  --warning-bg: #faf3dd;
  --error:   #c64545;  --error-bg:   #faebeb;
  --info:    #5b7fa6;  --info-bg:    #ecf1f6;

  /* Radius */
  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 8px;
  --radius-lg: 12px; --radius-xl: 16px; --radius-pill: 9999px;

  /* Spacing */
  --space-xxs: 4px; --space-xs: 8px; --space-sm: 12px; --space-md: 16px;
  --space-lg: 24px; --space-xl: 32px; --space-xxl: 48px; --space-section: 96px;

  /* Typography */
  --font-display: "Cormorant Garamond", "Noto Serif Devanagari", Garamond, "Times New Roman", serif;
  --font-body: "Inter", "Noto Sans Devanagari", -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "Cascadia Code", Consolas, monospace;

  --text-display-xl: 64px;  --lh-display-xl: 1.05;  --ls-display-xl: -1.5px;
  --text-display-lg: 48px;  --lh-display-lg: 1.1;   --ls-display-lg: -1px;
  --text-display-md: 36px;  --lh-display-md: 1.15;  --ls-display-md: -0.5px;
  --text-display-sm: 28px;  --lh-display-sm: 1.2;   --ls-display-sm: -0.3px;
  --text-title-lg: 22px; --text-title-md: 18px; --text-title-sm: 16px;
  --text-body-lg: 16px; --text-body-md: 16px; --text-body-sm: 14px;
  --text-caption: 13px; --text-caption-uppercase: 12px;
  --text-code: 14px; --text-button: 14px; --text-nav: 14px;

  /* Motion */
  --duration-fast: 100ms; --duration-normal: 150ms; --duration-moderate: 200ms;
  --duration-slow: 300ms; --ease-default: ease; --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### 10.2 Marketing Tokens

```css
:root {
  --canvas: #faf9f5;
  --surface-soft: #f5f0e8;
  --surface-card: #efe9de;
  --surface-cream-strong: #e8e0d2;
  --surface-dark: #181715;
  --surface-dark-elevated: #252320;
  --surface-dark-soft: #1f1e1b;
  --hairline: #e6dfd8;
  --hairline-soft: #ebe6df;
  --ink: #141413; --body-strong: #252523; --body: #3d3d3a;
  --muted: #6c6a64; --muted-soft: #8e8b82;
  --on-primary: #ffffff; --link: #a9583e;
  --shadow-soft: 0 1px 3px rgba(20, 20, 19, 0.08);
}
```

### 10.3 Product Tokens (light default / warm dark)

```css
:root, [data-theme="light"] {
  --app-canvas: #F0ECE0;      --app-sidebar: #f5f0e8;
  --app-card: #ffffff;        --app-card-soft: #f5f0e8;
  --bubble-user: #E5E0D6;     --bubble-user-hover: #dcd5c6;
  --composer-bg: #ffffff;     --composer-border: #E5E0D6;
  --code-block: #1f1e1b;
  --app-ink: #1a1a18; --app-body: #3d3d3a;
  --app-muted: #5b5950; --app-muted-soft: #8e8b82;
  --app-link: #a9583e;
  --app-on-dark: #faf9f5;
  --app-hairline: #E5E0D6;
}

[data-theme="dark"] {
  --app-canvas: #2b2a27;      --app-sidebar: #1f1e1b;
  --app-card: #33322e;        --app-card-soft: #1f1e1b;
  --bubble-user: #393937;     --bubble-user-hover: #44423c;
  --composer-bg: #1f1e1b;     --composer-border: #3d3a35;
  --code-block: #141412;
  --app-ink: #eeeeec; --app-body: #d4d1c7;
  --app-muted: #a3a098; --app-muted-soft: #8f8c84;
  --app-link: #e0a188;
  --app-on-dark: #faf9f5;
  --app-hairline: #3d3a35;
}
```

### 10.4 High-Contrast Overrides

```css
[data-contrast="high"] {
  --hairline: #6c6a64; --app-hairline: #5b5950;
  --muted-soft: #6c6a64; --app-muted-soft: #5b5950;
  --shadow-soft: none;
}
[data-contrast="high"] *:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
```

### 10.5 Syntax Highlighting (code blocks, warm-dark)

```css
:root {
  --code-bg: var(--code-block);
  --code-text: #e8e6df;
  --code-keyword: #c65f4a;   /* warm coral-red */
  --code-string: #7d9a6c;    /* sage */
  --code-number: #d4a017;    /* amber */
  --code-comment: #8f8c84;   /* muted */
  --code-function: #e0a188;  /* soft coral */
  --code-type: #e8a55a;      /* accent amber */
  --code-lineno: #6c6a64;
}
```

---

## Closing — Iteration Guide

1. Reference tokens, never inline hex. If a value isn't tokenized, add the token here first.
2. Variants live as separate token/component entries (`-active`, `-disabled`, `-focused`).
3. One component at a time; keep the trinity (cream / cream-card / dark) and the coral scarcity rule.
4. When in doubt about emphasis: **bigger serif before bolder weight.**
5. Never introduce a fourth surface tone, a cool gray, or a pure white floor.
6. Never document hover states — this system defines default and pressed only.

---

## Changelog — v2.1

- **Brand mark adopted (§1.4 rewritten):** the founder-created constructed "U" mark (pillar stem + floating right arm + base bar; uniform 120px strokes, even 60px air-gaps, optically centered) replaces the placeholder sparkle everywhere — component, nav, footer, mockups, favicon (`apps/web/src/app/icon.svg`), apple-icon, and both assets in `packages/ui/src/assets/`. Monochrome discipline: ink on light, white on dark, accent tint for the streaming marker only. All sparkle references updated to the U mark.
