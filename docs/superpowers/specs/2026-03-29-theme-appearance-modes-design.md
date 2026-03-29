# Theme Appearance Modes Design

## Goal

Extend the current typed theme system so every brand theme supports:

- `light`
- `dark`
- `system`

without changing component geometry, spacing, typography, or behavior.

The app should let users choose a brand theme independently from appearance mode. Example combinations:

- `ora-default` + `light`
- `lumina-clinical` + `dark`
- `zomato-bistro` + `system`

## Current State

- Brand themes are defined in `crm-frontend/src/lib/theme/themes.ts`
- A single selected theme id is persisted in `localStorage`
- `ThemeProvider.tsx` applies one set of semantic CSS tokens to `document.documentElement`
- Components consume semantic tokens through CSS variables in `globals.css`

This already gives a good base because components mostly do not depend on raw per-theme classes.

## Recommended Architecture

Use a two-axis theme model:

1. `brand theme`
2. `appearance mode`

### Brand Theme

Brand theme remains the identity layer:

- `ora-default`
- `lumina-clinical`
- `sterile-slate`
- `warm-sand`
- `swiggy-spice`
- `zomato-bistro`
- `neon-lemon`

### Appearance Mode

Appearance mode becomes a second top-level setting:

- `light`
- `dark`
- `system`

`system` resolves to `light` or `dark` using `prefers-color-scheme`.

## Theme Registry Changes

Refactor each theme definition from:

- one flat `tokens` object

to:

- `modes.light.tokens`
- `modes.dark.tokens`

Each dark mode is hand-tuned per theme rather than derived algorithmically.

This keeps brand identity intact in dark mode:

- `lumina` can stay cool and editorial
- `zomato` can stay blush-red rather than muddy maroon
- `neon-lemon` can stay citrus-forward without unreadable neon surfaces

## Provider Changes

`ThemeProvider.tsx` should manage two persisted preferences:

- selected brand theme
- selected appearance mode

Suggested storage keys:

- `crm-theme`
- `crm-theme-appearance`

The provider should:

1. read the saved theme id
2. read the saved appearance mode
3. resolve `system` to the active OS preference
4. apply the correct token set for `theme + resolved mode`
5. update live when OS color scheme changes while `system` is selected

## DOM State

Set explicit root dataset markers:

- `data-theme="<brand-theme-id>"`
- `data-appearance="<resolved-mode>"`
- `data-appearance-preference="<light|dark|system>"`

This makes debugging and future CSS targeting easier.

## Header UI

Keep theme switching in the shared header, but split controls into:

1. brand theme selector
2. appearance selector

The appearance selector should expose:

- `Light`
- `Dark`
- `System`

The existing brand theme selector should remain intact.

## Token Rules

Appearance mode still changes colors only.

Allowed to vary:

- page background
- shell gradients
- sidebar/topbar/panel surfaces
- borders
- text colors
- accent colors
- status colors where needed for contrast

Not allowed to vary:

- border radius
- shadows structure beyond color adaptation if needed
- font family
- font size
- spacing
- button shapes
- layout

## Dark Mode Design Rules

For every brand theme:

- keep strong contrast between shell, chrome, and content panels
- avoid flat near-black everywhere
- preserve the brand accent hue
- keep text neutral and readable
- ensure table and form surfaces remain distinct from the page shell

Dark mode should feel like the same theme in a darker environment, not a generic dark overlay.

## Implementation Steps

1. Refactor `themes.ts` to support `modes.light` and `modes.dark`
2. Add appearance-mode types and helpers
3. Update `ThemeProvider.tsx` to persist and resolve theme + appearance
4. Add `matchMedia('(prefers-color-scheme: dark)')` handling for `system`
5. Update header UI to expose both controls
6. Verify that existing semantic CSS variables still drive all dashboard pages without additional component rewrites

## Testing

Verify:

- switching brand theme in light mode works
- switching brand theme in dark mode works
- `system` follows OS preference on first load
- `system` updates when OS appearance changes
- theme + appearance persist across reloads
- dashboard shell, panels, side menu, tables, and forms visibly change in both light and dark modes
- no shape or typography regressions occur

## Risks

### Registry Size

The theme registry will grow significantly because each theme now has two token sets.

Mitigation:

- keep shared semantic token names unchanged
- group each theme by `light` and `dark`

### Dark Mode Contrast Drift

Some themes may look attractive but lose readability on tables and inputs.

Mitigation:

- bias toward stronger surface separation in dark mode
- test on dashboard-heavy pages, not just the shell

### UI Clutter

Adding another selector to the header could make the control area noisier.

Mitigation:

- keep controls compact and clearly labeled
- preserve the current header layout
