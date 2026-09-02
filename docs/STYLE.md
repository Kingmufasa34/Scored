# Scored — design system

A small, systematic token set the whole app (and the phone dashboard) styles
through. It's derived from **Refactoring UI** (Adam Wathan & Steve Schoger) and
the community "styling skills" that codify it — see [Sources](#sources). The
rule of thumb behind everything here: **use constrained scales, not arbitrary
values; let spacing and shadow (not borders) carry hierarchy.**

The canonical implementation lives in [`public/styles.css`](../public/styles.css)
as CSS custom properties. This doc is the spec; the stylesheet is the source of
truth. Keep them in step.

## Principles (what to actually do)

1. **Design the hierarchy in greyscale first, add colour last.** Size, weight
   and spacing should already make the page readable before any accent appears.
2. **Everything comes off a scale.** No one-off `padding: 7px`. Pick the nearest
   step on the spacing/type/radius scales below.
3. **Group by proximity.** More space *around* a group than *within* it, so
   relationships read without dividers. Within-group 4–16px; between-group
   24–64px.
4. **Shadows mean elevation, never decoration.** Cards get the *subtlest*
   shadow (or none); reserve the deep shadows for things that float above the
   page (the bottom sheet, the FAB). A shadow only grows on hover/press.
5. **Borders are a last resort.** Prefer a surface change or spacing to a line.
6. **One primary action per view.** Secondary actions are tinted; tertiary are
   ghost/text. Never two filled primaries competing.
7. **Semantic colour ≠ accent.** Good/warn/bad (delay state) are their own
   hues, kept distinct from the brand blue so status reads at a glance.

## Tokens

### Spacing — `--sp-*` (≥25% jumps)
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96` px
→ `--sp-1 … --sp-16`. Tight coupling 4–8, component internals 12–16, section
padding 16–24, major separations 32–48.

### Type scale — `--fs-*`
`12 · 13 · 15 · 17 · 19 · 23 · 28` px, weights 400/500/600/700/800.
Body ~15px; labels 11–12px uppercased with `letter-spacing: .06em`; numeric data
(times, fares, CRS) in the mono face with `font-variant-numeric: tabular-nums`.

### Radius — `--r-*`
`10 · 14 · 18 · 22` px → `--r-1 … --r-4`. Chips/rows use r-1/r-2, cards r-3,
sheet r-4.

### Neutrals — blue-biased grey ramp (10 shades, explicit hex)
`--g-0` #ffffff · `--g-25` #f7f9fc · `--g-50` #eef1f8 · `--g-100` #e4e8f1 ·
`--g-200` #d6dcea · `--g-300` #b9c2d6 · `--g-400` #8a94a8 · `--g-500` #5c6576 ·
`--g-700` #2b3345 · `--g-900` #0c1220. Greys carry a slight hue toward the
accent so they read as chosen, not default. The dark theme redefines the same
token names — components never reference a raw hex.

### Brand — rail blue, systematic lightness
`--brand-50` #eef3ff · `--brand-100` #dbe6ff · `--brand-300` #8fb0ff ·
`--brand-500` #2f6bff (base: buttons/links) · `--brand-600` #1e4fd6 ·
`--brand-700` #183fae (emphasis/text).

### Semantic (delay status)
`good` #14884a · `warn` #9a6207 · `bad` #d5342b, each with a low-lightness `-bg`
tint for chips. Redefined per theme.

### Elevation — 5 functional levels
- `--e-0` `none` — static content
- `--e-1` subtle — **cards** (border alternative)
- `--e-2` low — the FAB / raised interactive
- `--e-3` medium — popovers
- `--e-4` high — the bottom sheet / modals (clearly above everything)

Hover/press nudges an element up one step; nothing static wears a deep shadow.

## Themes

Three states: explicit `data-theme="light"|"dark"` on `:root`, and the
unstamped system default. Define the full light palette on bare `:root`;
redefine **only tokens** under `@media (prefers-color-scheme: dark)` guarded as
`:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`.
Style components through tokens exclusively so both themes resolve as a set.

## Sources

- Refactoring UI — Adam Wathan & Steve Schoger — <https://www.refactoringui.com/>
- gnurio/refactoring-ui-plugin (10 applied styling skills) — <https://github.com/gnurio/refactoring-ui-plugin>
- jaywilburn/refactoring-ui-skill — <https://github.com/jaywilburn/refactoring-ui-skill>
- LovroPodobnik/refactoring-ui-skill — <https://github.com/LovroPodobnik/refactoring-ui-skill>
- Tailwind's grey ramp informs the neutral steps — <https://tailwindcss.com/docs/customizing-colors>
