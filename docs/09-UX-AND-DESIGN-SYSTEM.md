# Relay — UX & Design System

## 1. Design Goal

Relay should feel like a focused professional communication tool rather than a generic dashboard or decorative SaaS concept.

The interface should prioritize conversation density, hierarchy, speed, and clarity.

## 2. Design Principles

### Communication first
The message stream is the primary surface.

### Compact but readable
Use information density appropriate for a communication app without making the UI cramped.

### Strong hierarchy
Workspace, navigation, conversation context, messages, and composer should be immediately distinguishable.

### Low visual noise
Avoid excessive gradients, glow effects, unnecessary glassmorphism, giant cards, and decorative dashboard patterns.

### Fast interaction
Common actions should not require excessive modals or page changes.

## 3. Core Layout

Desktop should generally contain:

```text
Workspace/Navigation Sidebar | Conversation Surface | Optional Context
```

The optional context area must not be required for V1.

## 4. Core UI Components

- workspace switcher;
- channel row;
- DM row;
- avatar/presence indicator;
- conversation header;
- message item;
- message action menu;
- reaction group;
- reply preview;
- unread separator;
- typing indicator;
- composer;
- upload preview;
- search results;
- member list;
- invitation dialog;
- empty states;
- connection/reconnect status.

## 5. Message Design

Messages should support:

- avatar;
- author name;
- timestamp;
- content;
- edited state;
- reply context;
- attachments;
- reactions;
- hover actions;
- pending/failed send state.

Do not over-card individual messages.

## 6. Responsive Design

### Desktop
Persistent sidebar.

### Tablet
Collapsible navigation.

### Mobile
Conversation is the primary screen. Sidebar becomes a drawer or dedicated navigation view.

## 7. Accessibility

- keyboard navigation for major actions;
- visible focus states;
- semantic buttons;
- accessible dialogs;
- sufficient contrast;
- reduced-motion support where relevant;
- labels for icon-only actions.

## 8. Motion

Motion should communicate state rather than decorate the interface.

Good uses:

- sidebar transitions;
- message insertion;
- reaction state;
- typing state;
- upload progress;
- connection state.

Avoid elaborate page transitions that interfere with communication speed.

## 9. Impeccable UI Phase

The dedicated UI refinement sprint will use **Impeccable**.

### Policy
During feature development, build complete and usable UI using Tailwind CSS and shadcn/ui, but avoid spending excessive time polishing every screen individually.

After the core product is stable, run a dedicated Impeccable-driven design pass across the complete application.

### Impeccable phase goals

- improve spacing and visual rhythm;
- strengthen typography hierarchy;
- normalize component sizing;
- refine sidebar density;
- improve message readability;
- improve responsive behavior;
- improve hover/focus/active states;
- refine empty/loading/error states;
- improve composer UX;
- improve perceived quality and consistency;
- audit accessibility;
- remove generic/generated-looking UI patterns.

### Guardrail
The Impeccable phase should preserve established functionality and business behavior. It is a design refinement phase, not an excuse to rewrite working backend architecture.
