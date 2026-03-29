# Design System Document

## 1. Overview & Creative North Star
**Creative North Star: The Clinical Sanctuary**
In an industry often defined by sterile, cold interfaces, this design system establishes a new standard for healthcare SaaS. It moves away from the "grid of lines" typical of medical software and adopts an editorial philosophy of breathing room and intentional depth. By blending "Healthcare Trust" with "Modern SaaS Elegance," we create an environment that feels authoritative yet calming.

The system breaks the template look through **intentional asymmetry** and **tonal layering**. Instead of hard borders, we use soft background shifts and overlapping surfaces to guide the eye. The interface shouldn't feel like a spreadsheet; it should feel like a premium, physical workspace—composed of layered glass and fine paper—where information is curated, not just displayed.

---

## 2. Colors
Our palette is rooted in refined teals (`primary`) and expansive neutrals (`surface`). These colors communicate hygiene and precision without the clinical harshness.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for sectioning. Contrast and containment must be achieved through background color shifts.
- To separate a sidebar from a main content area, place a `surface-container-low` panel against a `surface` background.
- Use `surface-container-lowest` for high-priority card elements to create a natural "lift" without a single line of stroke.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack.
*   **Base:** `background` (#f8f9ff)
*   **Secondary Zones:** `surface-container` (#e5eeff)
*   **Actionable Cards:** `surface-container-lowest` (#ffffff)
*   **Elevated Overlays:** `surface-bright` with 80% opacity and `backdrop-blur`.

### Glass & Gradient Implementation
Main CTAs and critical data visualizations should utilize subtle linear gradients (e.g., `primary` to `primary-container`). For floating elements like tooltips or modals, use semi-transparent surface colors with a `20px` backdrop blur to create a "frosted glass" effect, ensuring the layout feels integrated rather than disconnected.

---

## 3. Typography
The system employs a dual-font strategy to balance authority with accessibility.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern character. It commands attention for page titles and large data points (e.g., `headline-lg` for dashboard summaries).
*   **Body & Labels (Inter):** The workhorse of the system. Inter’s high x-height provides exceptional readability in high-density areas like appointment tables (`body-md`) and status tags (`label-md`).

**Editorial Hierarchy:**
- Use `display-sm` for hero metrics to establish confidence.
- Use `label-sm` in `on-surface-variant` for metadata to ensure secondary information remains present but unobtrusive.

---

## 4. Elevation & Depth
In this system, depth is a function of light and layer, not just shadows.

*   **Tonal Layering:** Always attempt to define depth via color first. A `surface-container-highest` card on a `surface-container` background provides all the hierarchy needed for a "Modern SaaS" aesthetic.
*   **Ambient Shadows:** When elevation is required (e.g., a modal or an active card), use extra-diffused shadows.
    *   *Specification:* `box-shadow: 0 12px 40px rgba(5, 52, 92, 0.06);` (Using a tinted `on-surface` color for the shadow prevents the "dirty" look of grey shadows).
*   **The Ghost Border:** If a boundary is strictly required for accessibility (e.g., input fields), use `outline-variant` at 20% opacity. Never use 100% opaque borders.
*   **Glassmorphism:** For floating navigation or top-bars, use `surface-container-lowest` at 70% opacity with a `blur(12px)` to allow the "medical teals" of the background to bleed through softly.

---

## 5. Components

### Buttons
- **Primary:** Filled with `primary`, text in `on-primary`. Use `xl` (0.75rem) roundedness for a soft, approachable feel.
- **Secondary:** Use `secondary-container` with `on-secondary-container`. This provides a "recessed" look that doesn't compete with the primary action.

### The Appointment Table (Critical Component)
- **Forbid Dividers:** Do not use horizontal lines between rows. Use `2.5` (0.85rem) vertical padding and a very subtle hover state change to `surface-container-low` to define rows.
- **Status Chips:** Use `secondary-container` for neutral states and `error-container` for cancellations. Keep labels in `label-md` uppercase to ensure they feel like "stamps" of authority.

### Input Fields
- Use `surface-container-lowest` for the field background.
- Apply the "Ghost Border" (`outline-variant` at 20%) only on focus.
- Use `spacing-3` (1rem) for internal padding to maintain the "Healthcare Trust" sense of space.

### Additional: Metric Cards
- Use `headline-sm` for the value and `label-md` for the trend.
- Place a subtle gradient mesh in the background using `surface-tint` at 5% opacity to add visual "soul."

---

## 6. Do's and Don'ts

### Do
*   **DO** use whitespace as a structural element. If a section feels crowded, increase the spacing from `spacing-4` to `spacing-6`.
*   **DO** use `surface-container-highest` to highlight the current active selection in a list or navigation.
*   **DO** ensure all status colors (teal, red, neutral) have sufficient contrast against their containers for accessibility.

### Don't
*   **DON'T** use black (#000000) for text. Always use `on-surface` (#05345c) to maintain the soft, sophisticated teal-neutral harmony.
*   **DON'T** use "Standard" 4px radius. Follow the scale: use `xl` (0.75rem) for large cards and `full` for tags/chips to maintain a modern, friendly aesthetic.
*   **DON'T** stack more than three levels of surface containers. Too many layers will break the "Clean & Professional" promise.