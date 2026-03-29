# Appointments List Restyle Design

## Goal

Restyle the appointments list view to match the reference in `ui_redesign/code copy.html`, while preserving all existing appointments data, links, actions, loading behavior, and empty-state behavior.

## Scope

In scope:
- Restyle the appointments table container, header row, and appointment rows.
- Update the visual treatment of customer, service, date/time, provider, source, status, and actions cells.
- Keep the list view inside the existing appointments page layout and filter controls.
- Keep current row actions functional.

Out of scope:
- Changes to filters, page header, pagination, dialogs, data fetching, API contracts, or non-list views.
- Changes to action behavior, appointment business logic, or routing.

## Approach

Update `crm-frontend/src/components/appointments/AppointmentsTable.tsx` directly instead of introducing a parallel redesign component.

The component will move from the current generic shared-table presentation to a custom table layout that visually aligns with the reference:
- Rounded white card container with subtle border/shadow treatment.
- Soft tinted table header with uppercase column labels.
- Larger customer identity cell with avatar and secondary identifier text.
- Stacked service and duration text.
- Stacked date and time text.
- Provider cell with a small leading status dot.
- Compact source badge styling.
- Pill-style status badge styling.
- Minimal actions column that preserves the current controls and links.

## Behavior Preservation

The restyle must not change:
- The `appointments` and `isLoading` props contract.
- Existing loading and empty-state branching.
- The detail-page link.
- The complete action availability and timing logic.
- The cancel action behavior.

## Error Handling

No new error paths are introduced. Existing missing-data fallbacks such as `Walk-in Customer` and `—` remain intact and should still render cleanly in the new layout.

## Testing

Validation will focus on:
- TypeScript build/lint safety for the updated component.
- Visual sanity of the appointments list in loading, populated, and empty states.
- Preservation of row actions and detail navigation.
