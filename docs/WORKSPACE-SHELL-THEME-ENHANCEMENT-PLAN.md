# Workspace Shell and Theme Enhancement Plan

## Objective

Refine the authenticated Relay shell so workspace identity, conversation location, unread activity, account state, and common navigation actions are immediately legible in both light and dark themes. Preserve all existing routes, API calls, authorization behavior, realtime behavior, and responsive breakpoints.

## Audit Findings

- The desktop shell exposes two theme controls: one in the workspace rail and one in the sidebar footer.
- Workspace tiles show initials but the active workspace relies mainly on border color and lacks the stronger route marker used by channel rows.
- The workspace rail has no direct return to the workspace chooser.
- The sidebar workspace switcher is only a text row and does not visually connect to the active workspace tile.
- Members and search are available only inside the sidebar, increasing navigation cost from the conversation surface.
- Direct-message rows use a generic person icon instead of a stable identity marker.
- The sidebar footer compresses user identity, role, theme, and sign-out into one undifferentiated row.
- The conversation header has weak visual separation between conversation identity, supporting context, and actions.
- Light and dark tokens exist, but cross-tab theme changes do not apply the incoming preference to the document root.
- Theme state uses semantic variables correctly, but the root should also declare CSS `color-scheme` as a fallback before the initialization script runs.
- Loading, empty, and switching states use the right tokens but need the same shell surface hierarchy as ready state.

## Direction

Keep the Signal Routing Desk composition and compact density. Improve it through stronger routing cues, clearer grouping, better identity markers, and semantic surface layering rather than larger cards, decorative gradients, or additional persistent columns.

Orange remains identity/current-location/unread/primary-action state. Cyan remains focus, healthy realtime state, and active realtime interaction. Both themes preserve these meanings.

## Implementation

### Workspace rail

- Add a visible orange current-workspace marker that does not rely on border color alone.
- Keep workspace initials and tooltips, but strengthen selected and hover states through shared sidebar tokens.
- Add an accessible All workspaces action at the rail bottom.
- Remove the duplicate rail theme control; keep theme/account controls together in the sidebar footer.

### Sidebar

- Upgrade the workspace switcher to include the active workspace initials, name, and current role.
- Separate global workspace destinations from channels with a quiet structural divider.
- Show channel and DM counts in section labels where useful.
- Give DM rows stable initials/avatar treatment rather than a generic icon.
- Refine unread badges, archived state, empty states, hover states, and keyboard focus without increasing row height.
- Recompose the account footer into a clear identity block plus labeled theme and sign-out actions.

### Conversation header

- Put channel/DM identity in a compact semantic icon tile.
- Keep title and context copy visually distinct and truncation-safe.
- Add direct search and members actions using true links, shared button variants, tooltips, and accessible names.
- Keep channel management in the existing authorized overflow menu.
- Preserve the 60px height and mobile menu behavior.

### Conversation surface

- Make history and composer regions use canonical background/card/border roles.
- Preserve current message density, maximum measure, unread marker, composer behavior, and realtime indicators.
- Ensure loading, empty, archived, failed, and switching states have equal contrast in both themes.

### Theme system

- Add CSS `color-scheme` declarations for light and dark roots.
- Keep dark as the default and persist explicit light/dark selection.
- Apply storage events from other tabs to the root class, `data-theme`, and `color-scheme` without rewriting storage.
- Extend the reusable theme control with an optional visible label for account/navigation contexts while retaining the compact icon variant for public navigation.
- Audit public pages, auth, invitation, gateway, overlays, app shell, message surfaces, and form primitives in both themes.

### Responsive behavior

- Desktop: persistent rail and sidebar, one theme control in the sidebar footer.
- Tablet: persistent rail, sidebar sheet, conversation-first content.
- Mobile: no persistent rail; sidebar sheet contains workspace, navigation, account, and theme controls.
- Keep header actions reachable at 320px without truncating the conversation title beyond recognition.

## Files

- `frontend/components/relay/app-shell.tsx`
- `frontend/components/relay/channel-messages.tsx`
- `frontend/components/relay/theme-control.tsx`
- `frontend/lib/theme.ts`
- `frontend/app/globals.css`
- Relevant shell/theme tests and E2E coverage
- `DESIGN.md` if implemented behavior changes its component contract

## Acceptance Criteria

- Exactly one authenticated theme control is visible in the desktop shell.
- Active workspace, active conversation, unread routes, and realtime health remain distinguishable without color alone.
- Workspace chooser, search, members, theme, and sign-out actions are keyboard-accessible and have clear accessible names.
- Conversation header actions work at desktop and mobile breakpoints.
- DM rows have stable identity cues.
- Light and dark themes maintain equivalent hierarchy, focus visibility, borders, muted text contrast, and control states.
- Theme selection persists across reloads and route changes and synchronizes across tabs.
- No authentication, workspace, messaging, permission, or realtime behavior changes.
- Lint, typecheck, unit tests, production build, desktop/mobile E2E checks, and the Impeccable detector pass.
