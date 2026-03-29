# Theme Appearance Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hand-tuned `light`, `dark`, and `system` appearance support for every brand theme in the CRM frontend theme system.

**Architecture:** Keep brand theme selection and appearance mode as separate persisted settings. Refactor the theme registry so each brand theme owns `light` and `dark` semantic token sets, then resolve `system` in the provider using OS preference and expose both controls in the shared header.

**Tech Stack:** Next.js App Router, React client state, localStorage, CSS variables, typed TypeScript theme registry.

---

### Task 1: Refactor Theme Registry For Theme + Appearance

**Files:**
- Modify: `crm-frontend/src/lib/theme/themes.ts`

- [ ] **Step 1: Replace the flat token model with a two-mode theme model**

Define the new types in `crm-frontend/src/lib/theme/themes.ts`:

```ts
export type ThemeAppearance = 'light' | 'dark';
export type ThemeAppearancePreference = ThemeAppearance | 'system';

export interface ThemeMode {
  tokens: ThemeTokens;
}

export interface AppTheme {
  id: string;
  label: string;
  description: string;
  modes: Record<ThemeAppearance, ThemeMode>;
}
```

- [ ] **Step 2: Update every theme entry to expose `modes.light.tokens` and `modes.dark.tokens`**

Refactor each `makeTheme(...)` call from:

```ts
makeTheme('ora-default', 'ORA Default', '...', {
  'primary-50': '#f0fdfa',
  // ...
})
```

to:

```ts
makeTheme('ora-default', 'ORA Default', '...', {
  light: {
    tokens: {
      'primary-50': '#f0fdfa',
      // existing light tokens
    },
  },
  dark: {
    tokens: {
      'primary-50': '#173a36',
      // hand-tuned dark tokens
    },
  },
})
```

Keep all existing themes:

- `ora-default`
- `lumina-clinical`
- `sterile-slate`
- `warm-sand`
- `swiggy-spice`
- `zomato-bistro`
- `neon-lemon`

- [ ] **Step 3: Add registry helpers for resolved appearance**

Add helpers in `crm-frontend/src/lib/theme/themes.ts`:

```ts
export function getThemeById(themeId: string) {
  return appThemes.find((theme) => theme.id === themeId) ?? appThemes[0];
}

export function getThemeTokens(themeId: string, appearance: ThemeAppearance) {
  return getThemeById(themeId).modes[appearance].tokens;
}
```

- [ ] **Step 4: Verify the registry compiles and lints**

Run:

```bash
cd crm-frontend
npx eslint src/lib/theme/themes.ts
```

Expected: exit code `0`

- [ ] **Step 5: Commit the registry refactor**

```bash
git add crm-frontend/src/lib/theme/themes.ts
git commit -m "refactor theme registry for light and dark modes"
```

### Task 2: Resolve Light, Dark, And System In ThemeProvider

**Files:**
- Modify: `crm-frontend/src/components/theme/ThemeProvider.tsx`

- [ ] **Step 1: Add appearance preference state and storage**

Introduce:

```ts
const THEME_STORAGE_KEY = 'crm-theme';
const APPEARANCE_STORAGE_KEY = 'crm-theme-appearance';
```

and store:

```ts
const [themeId, setThemeId] = useState<AppThemeId>(...)
const [appearancePreference, setAppearancePreference] = useState<ThemeAppearancePreference>(...)
const [systemAppearance, setSystemAppearance] = useState<ThemeAppearance>('light')
```

- [ ] **Step 2: Add system appearance detection**

In `ThemeProvider.tsx`, listen to:

```ts
window.matchMedia('(prefers-color-scheme: dark)')
```

and keep `systemAppearance` in sync:

```ts
useEffect(() => {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const update = () => setSystemAppearance(media.matches ? 'dark' : 'light');
  update();
  media.addEventListener('change', update);
  return () => media.removeEventListener('change', update);
}, []);
```

- [ ] **Step 3: Resolve the active appearance and apply the right tokens**

Replace the old `applyTheme(themeId)` usage with:

```ts
const resolvedAppearance =
  appearancePreference === 'system' ? systemAppearance : appearancePreference;
```

and apply:

```ts
const tokens = getThemeTokens(themeId, resolvedAppearance);
themeTokenNames.forEach((tokenName) => {
  root.style.setProperty(`--${tokenName}`, tokens[tokenName]);
});
```

Also set:

```ts
root.dataset.theme = theme.id;
root.dataset.appearance = resolvedAppearance;
root.dataset.appearancePreference = appearancePreference;
```

- [ ] **Step 4: Expose the new context API**

Update the context value to include:

```ts
appearancePreference,
setAppearancePreference,
resolvedAppearance,
```

so header controls can consume them cleanly.

- [ ] **Step 5: Verify provider lint**

Run:

```bash
cd crm-frontend
npx eslint src/components/theme/ThemeProvider.tsx
```

Expected: exit code `0`

- [ ] **Step 6: Commit the provider refactor**

```bash
git add crm-frontend/src/components/theme/ThemeProvider.tsx
git commit -m "add light dark and system appearance handling"
```

### Task 3: Add Appearance Selector To Shared Header

**Files:**
- Modify: `crm-frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Read theme and appearance state from the provider**

Use the updated hook:

```ts
const {
  themeId,
  setThemeId,
  themes,
  appearancePreference,
  setAppearancePreference,
} = useTheme();
```

- [ ] **Step 2: Add a second selector for appearance**

Add a compact select beside the existing brand-theme selector with options:

```tsx
<option value="light">Light</option>
<option value="dark">Dark</option>
<option value="system">System</option>
```

Use existing header styling patterns and keep the current layout structure intact.

- [ ] **Step 3: Keep the UI stable**

Do not change header geometry or add new layout regions. Only add the appearance control inside the current control cluster.

- [ ] **Step 4: Verify header lint**

Run:

```bash
cd crm-frontend
npx eslint src/components/layout/Header.tsx
```

Expected: exit code `0`

- [ ] **Step 5: Commit the header control change**

```bash
git add crm-frontend/src/components/layout/Header.tsx
git commit -m "add appearance mode selector to header"
```

### Task 4: Verify End-To-End Theme Behavior

**Files:**
- Verify: `crm-frontend/src/app/layout.tsx`
- Verify: `crm-frontend/src/app/globals.css`
- Verify: `crm-frontend/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Confirm provider wiring still wraps the app**

Check that `ThemeProvider` still wraps the app tree in `crm-frontend/src/app/layout.tsx`.

- [ ] **Step 2: Confirm no CSS variable contract changes are needed**

Verify `crm-frontend/src/app/globals.css` still consumes semantic variables like:

```css
--background
--panel-background
--text-primary
--border-light
```

No component rewrite should be required if the variable names stay unchanged.

- [ ] **Step 3: Run focused lint across all touched theme files**

Run:

```bash
cd crm-frontend
npx eslint \
  src/lib/theme/themes.ts \
  src/components/theme/ThemeProvider.tsx \
  src/components/layout/Header.tsx \
  src/app/layout.tsx
```

Expected: exit code `0`

- [ ] **Step 4: Smoke-test system behavior manually**

Verify manually in the running app:

- select a brand theme in light mode
- switch to dark mode
- switch to system
- confirm OS appearance changes update the resolved appearance while `system` is selected
- confirm selected brand theme remains unchanged while only appearance changes

- [ ] **Step 5: Commit the verification pass**

```bash
git add crm-frontend/src/lib/theme/themes.ts \
  crm-frontend/src/components/theme/ThemeProvider.tsx \
  crm-frontend/src/components/layout/Header.tsx
git commit -m "verify two-axis theme appearance system"
```
