---
name: Relay
description: A precise, dark-first communication workspace with auth-derived contrast, orange routing signals, and electric-cyan realtime awareness.
colors:
  light-carbon: "#050c10"
  light-panel: "#071116"
  light-panel-raised: "#13252e"
  light-panel-text: "#eef4f5"
  light-panel-muted: "#a9b5bf"
  light-paper: "#edf3f4"
  light-surface: "#f8fbfb"
  light-surface-raised: "#dce8ea"
  light-ink: "#102027"
  light-muted: "#516871"
  light-line: "#b5c9ce"
  light-relay-orange: "#df850d"
  light-relay-orange-ink: "#925000"
  light-realtime-cyan: "#007f8c"
  light-realtime-cyan-ink: "#006873"
  light-status-green: "#287453"
  dark-carbon: "#050c10"
  dark-panel: "#071116"
  dark-panel-raised: "#13252e"
  dark-panel-text: "#eef4f5"
  dark-panel-muted: "#a9b5bf"
  dark-paper: "#050c10"
  dark-surface: "#0b141a"
  dark-surface-raised: "#13252e"
  dark-ink: "#eef4f5"
  dark-muted: "#a9b5bf"
  dark-line: "#28404a"
  dark-relay-orange: "#ffa42e"
  dark-relay-orange-ink: "#ffc06c"
  dark-realtime-cyan: "#00f5ff"
  dark-realtime-cyan-ink: "#72f8ff"
  dark-status-green: "#58d6a1"
  destructive-light: "#b83f37"
  destructive-dark: "#e07068"
typography:
  headline:
    fontFamily: "Archivo, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "Archivo, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Archivo, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  metadata:
    fontFamily: "Geist Mono, monospace"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  sm: "4.8px"
  md: "6.4px"
  lg: "8px"
  xl: "10.8px"
  2xl: "13.6px"
  pill: "9999px"
spacing:
  "1": "4px"
  "1.5": "6px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "7": "28px"
components:
  primary-send-dark:
    backgroundColor: "{colors.dark-relay-orange}"
    textColor: "{colors.dark-carbon}"
    rounded: "{rounded.md}"
    size: "28px"
  primary-send-light:
    backgroundColor: "{colors.light-relay-orange}"
    textColor: "{colors.light-carbon}"
    rounded: "{rounded.md}"
    size: "28px"
  active-channel-dark:
    backgroundColor: "rgb(245 161 55 / 12%)"
    textColor: "{colors.dark-relay-orange}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "32px"
  active-channel-light:
    backgroundColor: "rgb(242 162 58 / 12%)"
    textColor: "{colors.light-relay-orange}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    height: "32px"
  reaction-default:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-muted}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 8px"
  reaction-active:
    backgroundColor: "rgb(85 194 201 / 10%)"
    textColor: "{colors.dark-realtime-cyan}"
    rounded: "{rounded.pill}"
    height: "24px"
    padding: "0 8px"
  composer-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.lg}"
    padding: "10px 12px 6px"
  attachment-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: Relay

## Overview

**Creative North Star: "The Signal Routing Desk"**

Relay is a precise, dark-first operating surface for ongoing team communication. Its auth-derived near-black rails, crisp blue-green borders, high-contrast panels, and compact controls keep the message stream dominant; identity appears as a restrained route of orange from the Relay mark through the active workspace, current conversation, unread activity, and primary send action.

Realtime confidence is present without turning the product into a monitoring console. Electric cyan carries healthy presence, synchronization, active reactions, typing, links, and connection focus, while ordinary navigation and content remain neutral. Light mode is a cool-paper counterpart, not an inversion: it preserves the same hierarchy and state meanings with pale blue-green surfaces, deep blue-green navigation, and adjusted ink and border values.

**Key Characteristics:**

- Dark-first, edge-to-edge workspace with a fully supported warm light theme.
- Compact, readable density built around 60px headers, 32px navigation rows, and 12px conversation text.
- Orange routing signals for identity and location; cyan operational signals for healthy realtime state.
- Tonal layering and hairline borders instead of a field of cards or decorative effects.
- Persistent desktop context that becomes focused drawers on narrower screens.

## Colors

The palette combines blue-black work surfaces, warm paper, mineral neutrals, Relay orange, and a sparingly used realtime cyan. The frontmatter values are normative and pair every recurring semantic color with its implemented light or dark value.

### Primary

- **Relay Orange:** Use the theme's `relay-orange` token only for Relay identity, current location, unread activity, and the primary send action.
- **Relay Orange Ink:** Use the theme-specific ink companion when orange must communicate emphasis as foreground text without losing contrast.

### Secondary

- **Realtime Cyan:** Use the theme's `realtime-cyan` token for healthy online presence, synchronized or connected state, typing activity, active reactions, successful technical context, and cyan focus treatment.
- **Realtime Cyan Ink:** Use the stronger theme-specific foreground companion where small cyan text requires additional contrast.
- **Status Green:** The light theme retains a distinct positive-status green; the dark theme intentionally converges this role with realtime cyan.

### Neutral

- **Carbon:** The deepest rail and Relay-mark ground. It anchors workspace identity rather than ordinary content.
- **Panel / Panel Raised:** Navigation and thread surfaces. Raised panel is a subtle state layer, not a floating card color.
- **Panel Text / Panel Muted:** High- and low-emphasis content on dark persistent navigation.
- **Paper:** The conversation canvas and ring color around overlapping participant avatars.
- **Surface / Surface Raised:** Composer, attachments, popovers, message action bars, and secondary content blocks.
- **Ink / Muted:** Primary conversation copy and metadata hierarchy.
- **Line:** The one-pixel structural separator for rails, headers, tabs, attachments, reactions, and composers.
- **Destructive:** Reserve for invalid or destructive states; it is not part of Relay's routine routing language.

### Named Rules

**The Two-Signal Rule.** Relay orange is reserved for identity, current location, unread activity, and primary send; cyan is reserved for healthy realtime state, including presence, synchronization, typing, and active realtime interactions.

**The Theme-Parity Rule.** Light and dark themes keep identical semantic roles and hierarchy; never obtain one by mechanically inverting the other.

**The Neutral Majority Rule.** Most of every screen remains neutral. Accent rarity is what makes routing and health state immediately legible.

## Typography

**Display Font:** Archivo (with sans-serif fallback)  
**Body Font:** Archivo (with sans-serif fallback)  
**Label/Mono Font:** Geist Mono (with monospace fallback)

**Character:** Archivo is compact, direct, and highly legible at Relay's operational sizes. Geist Mono isolates timestamps, shortcuts, latency, hashes, and queue counts as machine-state metadata without imposing a terminal aesthetic on the product.

### Hierarchy

- **Headline** (600, 14px, 1.25): Workspace, conversation, and thread titles.
- **Title** (600, 12px, 1.25): Message authors, attachment titles, and emphasized navigation.
- **Body** (400, 12px, 20px): Primary message copy, limited to 82ch in the conversation stream.
- **Label** (500, 10px, 1.25): Tabs, reactions, compact actions, section labels, and connection details. Supporting UI may step down to 8-9px where the implementation does so for tertiary metadata.
- **Metadata** (400, 9px, 1.25): Timestamps, keyboard shortcuts, commit hashes, latency, and other machine-readable state.

### Named Rules

**The Human-and-Machine Rule.** Use Archivo for people, content, and controls; use Geist Mono only for time, shortcuts, identifiers, measurements, and system state.

**The Dense-Not-Cramped Rule.** Small type is paired with stable line height, restrained line length, and clear tonal contrast; never reduce those safeguards merely to fit more rows.

## Layout

Relay fills the dynamic viewport and keeps body overflow contained inside purpose-built scroll regions. The shell has a minimum height of 620px and uses a conversation-first responsive grid:

- Below 768px, the conversation occupies the single visible column. Navigation opens as a left sheet up to `min(88vw, 320px)`, and threads open as a right sheet up to `min(92vw, 380px)`.
- From 768px, the 64px workspace rail persists beside the conversation.
- From 1024px, the 250px navigation sidebar also persists.
- From 1280px, an open 340px thread panel becomes an integrated fourth column; below this breakpoint it remains a sheet so the channel is not compressed.

The top-level workspace, conversation, and thread headers are 60px high. The conversation tab bar is 44px high. Navigation rows are generally 32px high; direct-message rows are 36px. The message stream is centered to a 1152px maximum, message copy is capped at 82ch, ordinary attachment cards at 520px, and the visual preview at 480px. Horizontal message padding progresses from 20px to 28px at 640px; the composer progresses from 12px to 20px.

The desktop sequence is fixed: workspace rail, navigation, conversation, optional thread. Global destinations precede channels and direct messages. The composer anchors the conversation bottom, the connection control anchors the navigation bottom, and each region scrolls independently so orientation is preserved.

**The Conversation-First Rule.** Narrow layouts remove persistent secondary columns rather than compressing the desktop grid; drawers preserve access without stealing reading width.

## Elevation & Depth

Relay is flat by default. Depth comes from adjacent tonal surfaces and one-pixel borders; shadows are limited to transient overlays and the message action toolbar. Popovers and the toolbar use the implemented medium shadow, while sheets use the implemented large shadow. The sheet backdrop adds a 10% black veil and a very small backdrop blur when supported. Persistent rails, messages, attachment cards, reactions, and composers do not float at rest.

### Shadow Vocabulary

- **Overlay Medium** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): Popovers and hover-revealed message actions.
- **Sheet Large** (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): Mobile navigation and thread sheets only.

### Named Rules

**The Flat-Until-Transient Rule.** Persistent workspace structure uses value and borders; shadow signals an overlay or temporarily exposed control.

## Shapes

The form language is compact and mildly squared. The global 8px radius yields observed steps of 4.8px, 6.4px, 8px, 10.8px, and 13.6px. Containers and controls primarily use the 6.4px and 8px steps; tiny preview geometry uses 4.8px. Pills are reserved for reactions, unread counts, date markers, presence dots, and other intrinsically compact state.

Borders are normally one pixel and use the semantic line color or a 10% white line on persistent dark panels. The active route adds a two-pixel orange edge marker. Workspace tiles and person avatars may be softly squared; live status badges and participant stacks stay circular. Clipping belongs to previews, sheets, and bounded controls, not to the whole conversation canvas.

**The Minimal-Corner Rule.** Use the smallest established radius that suits the control; do not turn Relay into a collection of large rounded cards.

## Components

Relay-specific components compose installed shadcn/ui primitives. Reuse `Button`, `Avatar`, `DropdownMenu`, `Popover`, `ScrollArea`, `Sheet`, `Tabs`, `Textarea`, and `Tooltip` before adding a base control; check the installed UI directory and then the shadcn registry rather than recreating a primitive.

### Buttons

- **Shape:** Compact 24px, 28px, or 32px icon controls with gently squared corners; default controls are 32px high.
- **Primary:** The send action is a 28px orange square with carbon ink. It is disabled at 50% opacity when no trimmed draft exists.
- **Hover / Focus:** State changes use the 150ms default transition. Keyboard focus is a visible two- or three-pixel semantic ring; route controls use orange and realtime controls use cyan. Button press may translate down by one pixel.
- **Ghost / Outline:** Ghost actions remain neutral until hover. Workspace tiles use quiet outline borders and never compete with the primary send action.

### Chips

- **Style:** Reactions are 24px-high pills with a one-pixel line border, 8px horizontal padding, and 10px labels.
- **State:** Inactive reactions are neutral. Active reactions use cyan foreground, a 40% cyan border, and a 10% cyan wash; orange is not used for reaction selection.

### Cards / Containers

- **Corner Style:** Attachments and previews use the 6.4px radius; composers and transient overlays use 8px.
- **Background:** Use semantic surface layers. The onboarding preview alone uses a carbon miniature to echo Relay's own visual world.
- **Shadow Strategy:** No resting shadow. See Elevation & Depth for the small transient exceptions.
- **Border:** One-pixel semantic line, including internal dividers where controls share a container.
- **Internal Padding:** Common attachment padding is 10px vertically and 12px horizontally.

### Inputs / Fields

- **Style:** The composer is a single bordered surface: a minimum 48px borderless textarea above a compact action row, separated by one hairline.
- **Focus:** The outer composer receives a subtle cyan 10% ring and a muted border shift; the inner textarea does not draw a competing ring. The caret is cyan.
- **Error / Disabled:** Preserve shadcn destructive rings and disabled opacity. Error language and icons must accompany color.

### Navigation

- **Workspace rail:** A 64px carbon rail with 40px workspace tiles, orange Relay mark, a left orange current-workspace marker, and compact unread dots.
- **Sidebar:** A 250px panel with global destinations first, then channels and direct messages. Active channels combine orange text, a 12% orange wash, a two-pixel route marker, bold type, and `aria-current`; unread routes combine weight with a dot.
- **Conversation tabs:** A quiet 44px line-tab bar. The active item receives a two-pixel orange underline; labels remain compact and secondary tabs hide selectively on narrow screens.
- **Mobile:** Navigation moves to a left sheet. It is not a squeezed permanent column.

### Messages, Attachments, and Threads

Messages are borderless rows with softly tinted hover feedback, a 32px squared avatar, 12px author and body type, and mono timestamps. Desktop actions appear in a bordered floating toolbar on hover or focus-within; mobile keeps a persistent overflow action. Message history uses `role="log"` and a descriptive label.

Attachments stay embedded in message flow. Image previews retain their own internal composition and filename metadata; file and commit cards use the shared surface, line, radius, and compact metadata scale. Reactions wrap directly below their message. Thread context uses the panel palette, repeats the source message and attachment, separates replies with a labeled hairline, and anchors a smaller composer at the bottom.

### Presence, Typing, and Synchronization

Cyan indicates healthy online presence and synchronization. The bottom connection control says "Signal clear" and "Synced just now" before opening detailed connected, latency, last-sync, and queued-message values. Typing uses a three-dot cyan cadence plus text. Presence dots remain supplemental to names or explicit status text; operational state must never rely on hue alone.

### Motion

Routine color and opacity feedback uses the implemented 150ms standard transition. Sheets use 200ms ease-in-out translation with a 150ms overlay fade; popovers use 100ms fade, zoom, and directional entry. The optional route line draws and settles over 700ms with `cubic-bezier(0.2, 0.8, 0.2, 1)`. Motion communicates opening, routing, or state change, never ambient decoration. Under `prefers-reduced-motion: reduce`, scroll animation is removed and all animations and transitions collapse to 0.01ms for one iteration.

### Accessibility Invariants

All icon-only actions retain accessible names. Navigation regions retain labels, current routes retain `aria-current`, message history retains log semantics, and visually hidden sheet titles and descriptions remain present for assistive technology. Keyboard focus is always visible. Hover-only desktop actions also appear on focus-within, while mobile receives a persistent action. State combines color with text, icon, weight, position, shape, or an explicit label. Theme changes must maintain WCAG 2.2 AA contrast and update `color-scheme` with the root theme class.

## Do's and Don'ts

### Do:

- **Do** reserve Relay orange for identity, current location, unread activity, and primary send.
- **Do** reserve cyan for healthy realtime state, presence, synchronization, typing, active reactions, and related focus treatment.
- **Do** keep the message stream wider and quieter than its navigation and thread context.
- **Do** preserve semantic parity across the implemented dark and light token sets.
- **Do** reuse or install shadcn/ui primitives before composing Relay-specific domain components.
- **Do** preserve visible keyboard focus, accessible names, reduced motion, and non-color state cues.

### Don't:

- **Don't** use orange as a general decoration, hover color, success color, or reaction-selection color.
- **Don't** turn cyan into a second brand accent for arbitrary content.
- **Don't** introduce generic SaaS card grids, oversized radii, gradient decoration, or an overt monitoring-console aesthetic.
- **Don't** compress rail, sidebar, conversation, and thread into a narrow desktop replica; move secondary context into sheets.
- **Don't** add shadows to persistent messages, attachments, navigation, or composers.
- **Don't** replace Archivo with mono text for ordinary content or expose machine metadata in the human reading voice.
