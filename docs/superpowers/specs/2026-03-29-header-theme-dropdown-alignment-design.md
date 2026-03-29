# Header Theme Dropdown Alignment Design

## Goal

Replace the header's theme and appearance native select controls with the same dropdown interaction pattern used for appointment status on the Appointments page.

## Scope

This change applies to:

- the brand theme selector in the shared header
- the light/dark/system appearance selector in the shared header
- any responsive rendering path for those same controls

This change does not alter:

- theme persistence keys
- theme resolution logic in `ThemeProvider`
- available theme or appearance values

## Approach Options

### Option 1: Reuse the existing dropdown component by generalizing it

Refactor `crm-frontend/src/components/ui/fluid-dropdown.tsx` so it can render arbitrary option sets instead of only appointment statuses.

Pros:

- one shared interaction model
- exact visual consistency with the Appointments page
- no duplicated animation or selection logic

Cons:

- requires a small refactor before the header can adopt it

### Option 2: Build a second header-only dropdown that mimics the same style

Pros:

- smaller immediate surface area

Cons:

- duplicated behavior and styling
- higher drift risk between Appointments and header controls

## Decision

Choose Option 1.

The existing `FluidDropdown` should become a generic reusable dropdown with typed options. The Appointments page should continue using it with the current status option set, and the header should use the same component for theme and appearance.

## Component Design

### Shared Dropdown

`crm-frontend/src/components/ui/fluid-dropdown.tsx` should accept:

- a typed option list
- current value
- change handler
- optional class name

Each option should support:

- `value`
- `label`
- optional `icon`
- accent `color`

The current animated panel, hover highlight, chevron behavior, and click-away handling should remain intact.

### Appointments Usage

The Appointments page should pass the current appointment-status options into the generalized dropdown so existing behavior remains unchanged.

### Header Usage

The header should replace both native `<select>` controls with the shared dropdown:

- theme dropdown using the available `themes`
- appearance dropdown using `light`, `dark`, and `system`

The current setter guards should remain in place so invalid values are ignored.

## Responsive Behavior

If the header exposes these controls in any mobile or alternate responsive path, that path should use the same dropdown component as well. There should not be one interaction on desktop and a different selector style on mobile for the same setting.

## Testing

Add focused frontend tests for the generalized dropdown behavior and its header integration.

At minimum, verify:

- selecting a theme calls `setThemeId` with the chosen theme id
- selecting an appearance option calls `setAppearancePreference` with the chosen value
- the Appointments status dropdown still maps selections correctly

## Risks

### Regression In Status Dropdown Behavior

Generalizing the component could accidentally change the Appointments filtering behavior.

Mitigation:

- preserve current option labels and values
- add focused tests around status selection

### Header Layout Tightness

The animated dropdown may be wider or taller than the native select controls.

Mitigation:

- keep header sizing compact
- verify layout at the existing desktop and responsive breakpoints
