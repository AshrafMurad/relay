# Shared Public Navigation and Site-Wide Auth Theme Plan

## 1. Purpose

Unify Relay around two decisions:

1. Every public route uses one shared navigation component and one shared public-page frame.
2. The visual language currently established by the login and signup experience becomes the visual system for the entire site, including the authenticated workspace.

This is a presentation and frontend-structure project. Authentication behavior, workspace permissions, API contracts, realtime behavior, routing semantics, and product scope must remain unchanged.

## 2. Confirmed Decisions

- Theme scope: the entire site, including `/app/**`.
- Public navigation scope: `/`, `/login`, `/signup`, and `/invite/[token]`.
- Public navigation behavior: session-aware.
- Auth visual authority: near-black blue-green surfaces, crisp blue-green borders, high-contrast text, electric cyan for realtime/focus/link state, and orange for identity and primary actions.
- Workspace composition: preserve the compact, conversation-first app layout. Apply the auth visual language through tokens, surfaces, controls, and states rather than copying the auth hero composition into the workspace.
- Theme support: keep deliberate dark and light themes because project requirements mandate both. Dark remains the default and the primary visual reference.

## 3. Goals

- Remove independently implemented public headers and navigation bars.
- Give visitors the same brand, navigation placement, action hierarchy, responsive behavior, and focus behavior on every public route.
- Show anonymous actions to signed-out visitors and useful workspace/account actions to signed-in visitors.
- Preserve invitation destinations when users move between invitation, login, and signup routes.
- Replace auth-only hard-coded colors with a shared semantic token system.
- Centralize typography, spacing, radii, control sizing, validation states, and recurring surface treatments so they can be changed without editing every page.
- Carry the auth page's visual identity through the landing page, invitations, workspace gateway, app shell, messages, search, members, dialogs, sheets, forms, and all supporting states.
- Preserve Relay's orange/cyan semantic split and low-noise communication-first behavior.
- Make theme selection persistent and prevent incorrect-theme flashes during page load.
- Meet WCAG 2.2 AA, keyboard, reduced-motion, and responsive requirements.

## 4. Non-Goals

- No backend, database, API, DTO, Socket.IO, authorization, or authentication-flow redesign.
- No route URL changes.
- No feature additions such as password recovery, OAuth enablement, account settings, or new marketing sections.
- No rewrite of `RelayAppShell` or `ChannelMessages` domain behavior.
- No decorative glow, gradient, or oversized marketing typography inside dense conversation and management surfaces.
- No removal of light mode.
- No fabricated product claims, metrics, testimonials, or customer evidence.
- No unrelated correction of validation rules or message limits as part of the theme work. Track such issues separately.

## 5. Current-State Findings

### Public navigation duplication

| Surface | Current owner | Current behavior |
| --- | --- | --- |
| `/` | `frontend/app/page.tsx` | Local nav with unconditional Log in and Sign up actions |
| `/login`, `/signup` | `frontend/components/relay/auth-page.tsx` | Local nav with mode-based button emphasis and preserved `next` query |
| `/invite/[token]` | `frontend/components/relay/invitation-page.tsx` | Separate header; signed-in users see Use another account, signed-out users get auth actions only inside pending invitation content |
| `/app` | `frontend/components/relay/workspace-gateway.tsx` | Authenticated product header, outside the public-nav scope |

The uncommitted navigation work already present in `auth-page.tsx` should be treated as design input, then replaced by the shared public navigation instead of being duplicated further.

### Theme fragmentation

- `frontend/app/globals.css` contains shadcn semantic roles and a parallel `signal-*` vocabulary.
- `frontend/components/relay/auth-page.tsx` contains a third, private palette made from hard-coded hex and RGB values.
- The root layout forces the `dark` class, while the workspace toggle directly mutates the root class without persistence.
- Auth colors are more saturated and higher contrast than the current app palette.
- Inputs are independently styled in auth, the app shell, workspace gateway, search, and members surfaces.
- Public and gateway page scrolling is inconsistent because global `body` overflow is hidden.
- The horizontal logo is designed for dark surfaces and requires a deliberate light-theme treatment.

### Relevant existing architecture

- `hasActiveSession()` in `frontend/lib/auth/session.ts` is the existing server-side session seam.
- `safeNextPath()` in `frontend/lib/auth/redirect.ts` is authoritative for local redirect validation.
- The root layout must remain common to public and authenticated routes.
- Next.js 16 route groups can share a layout without changing URL paths.
- `/app/[workspaceSlug]/**` is already composed through `RelayAppShell`.
- shadcn components are installed under `frontend/components/ui`; missing primitives must be checked in the registry before a custom primitive is added.

## 6. Target Experience

### Public frame

All public pages render inside one dark-first frame with:

- A consistent maximum width, outer gutter, top spacing, border treatment, and background.
- A single top-anchored, non-sticky public navigation so short viewports retain maximum content space.
- The Relay logo in the same size and location.
- Consistent button sizing and visual priority.
- Page content that scrolls within the public document frame without being clipped by global body overflow.
- Compact mobile behavior that keeps the logo and primary action visible without introducing a menu for only two or three actions.

### Public navigation state matrix

| Session | Route | Left side | Right side |
| --- | --- | --- | --- |
| Signed out | `/` | Relay home link | Log in, Sign up |
| Signed out | `/login` | Relay home link | Log in active, Sign up secondary |
| Signed out | `/signup` | Relay home link | Log in secondary, Sign up active |
| Signed out | `/invite/[token]` | Relay home link | Log in and Sign up, both preserving the invitation destination |
| Signed in | `/` | Relay home link | Open Relay, account menu/sign out |
| Signed in | `/invite/[token]` | Relay home link | Open Relay, account menu with Use another account/sign out |
| Signed in | `/login`, `/signup` | Not normally rendered | Existing server redirects continue before the page is shown |

Navigation requirements:

- Use `aria-label="Public navigation"` on the nav landmark.
- Use `aria-current="page"` for the active auth destination.
- Include the same compact dark/light theme control in every session state.
- Preserve a sanitized `next` destination when switching between login and signup.
- For invitation routes, use the current local invitation path as `next` exactly once.
- Do not expose private user data beyond the minimum account label needed for the signed-in state.
- Treat session lookup failure as signed out, matching current behavior.

### Site-wide visual language

The auth page becomes the palette and surface reference, not a literal page template.

- Near-black blue-green is the site canvas.
- Slightly lighter blue-green panels separate navigation, forms, overlays, and dense product regions.
- Crisp blue-green lines provide structure.
- High-contrast cool white is the primary foreground.
- Muted blue-gray supports metadata and secondary copy.
- Electric cyan is reserved for realtime health, focus, links, active reactions, typing, and synchronized state.
- Orange is reserved for Relay identity, current route, unread activity, and the primary action.
- Soft radial light and glow may appear in public hero or auth artwork contexts only.
- Persistent app panels remain flat and use tone plus borders rather than shadows.
- The existing compact app typography and density remain intact; public pages may retain larger display hierarchy.

## 7. Target Frontend Architecture

### Route organization

Create a public route group so the URLs stay unchanged:

```text
frontend/app/
├── layout.tsx
├── globals.css
├── (public)/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── invite/[token]/page.tsx
└── app/
    └── ...
```

`frontend/app/(public)/layout.tsx` owns the shared public frame, initial public session resolution, and `PublicNavigation`. Parentheses do not change the resulting URLs.

Do not put the public navigation in `frontend/app/layout.tsx`; doing so would incorrectly render it inside `/app/**`.

### Shared components

Add or extract the following focused pieces:

| Component/module | Responsibility |
| --- | --- |
| `components/relay/public-navigation.tsx` | Brand link, active route state, anonymous actions, signed-in actions, responsive behavior |
| `components/relay/public-session-provider.tsx` | Share the server-resolved public session with client public surfaces and update it after sign-out |
| `components/relay/theme-control.tsx` | One reusable accessible theme control for public and authenticated surfaces |
| `lib/auth/session.ts` | Expose a request-deduplicated server accessor returning the current user or `null`; keep a boolean helper only if still useful |
| `lib/theme.ts` | Theme type, storage key, root-class application, and system preference fallback |

Keep the provider limited to public session state and actions. Do not turn it into a general application-state layer.

### Session resolution

Use one server session accessor for the public layout and auth-route redirects:

- Forward the request cookie to the backend exactly as the current helper does.
- Keep `cache: "no-store"` semantics.
- Deduplicate calls within a single server render request.
- Return a deliberate `AuthUserDTO`-shaped public session value or `null`, never a database model.
- Preserve current failure behavior: backend/session lookup failure renders anonymous public navigation.
- Seed client public-session state from the server result.
- Let invitation acceptance reuse that state rather than always requesting `/auth/me` again.
- On public sign-out, call the existing endpoint, clear provider state, and refresh/replace the route as needed.

### Theme initialization

Replace the hard-coded root `dark` class and direct toggle mutation with a small theme system:

- Supported values: `dark` and `light`.
- Default: dark when no preference exists.
- Persist the user's selection in local storage.
- Apply the class and `color-scheme` before hydration with a minimal inline initialization script or an established Next-compatible theme solution.
- Use the same control and state in public navigation and authenticated navigation.
- Ensure server-rendered markup remains hydration-safe.
- Do not add a large theme dependency if the small local implementation is sufficient.

## 8. Token Strategy

### Canonical semantic roles

Promote the auth palette into `frontend/app/globals.css` and consume it through semantic roles:

| Role | Dark reference | Usage |
| --- | --- | --- |
| Canvas | `#050c10` | Page and workspace background |
| Carbon | approximately `#020a0e` to `#071116` | Brand rail and deepest navigation surface |
| Panel | `#071116` | Public nav, auth panels, app sidebar |
| Surface | `#0b141a` to `#0d1a21` | Inputs, cards, composer, menus |
| Raised surface | `#13252e` | Hover, selected neutral, raised transient content |
| Line | `#28404a` | Default structural border |
| Strong line | `#25475d` or `#3f5c68` | Focused/prominent panel boundary |
| Foreground | `#eef4f5` | Primary text |
| Muted foreground | `#a9b5bf` | Secondary text |
| Subtle foreground | `#84919a` | Tertiary metadata |
| Relay orange | `#ffa42e` | Identity, current route, unread, primary action |
| Orange hover | `#ffb64d` | Primary action hover only |
| Realtime cyan | `#00f5ff` | Health, links, active realtime state |
| Focus cyan | `#00d8e6` | Focus border, caret, focus ring |
| Destructive | existing semantic destructive family | Errors and destructive actions |

Exact values should be finalized through contrast testing, not copied blindly. Official Google mark colors remain asset-specific and are not theme tokens.

### Token implementation rules

- Make shadcn roles such as `background`, `foreground`, `card`, `popover`, `primary`, `muted`, `accent`, `border`, `input`, `ring`, and `sidebar` express the new system.
- Retain Relay-specific signal roles only where they communicate domain semantics that generic shadcn roles cannot express.
- Align any retained `signal-*` aliases with canonical values so components do not drift by vocabulary.
- Replace auth-page hex and RGB values with semantic utilities except for official brand asset colors and deliberate hero-image overlays.
- Replace dark-only `white/*` navigation borders and hovers with semantic sidebar roles.
- Author light values intentionally. Preserve the same orange/cyan meaning and contrast hierarchy without mechanically inverting dark values.
- Keep orange and cyan rare enough that state remains legible.

### Shared primitives

Before creating fields or alerts, check the shadcn registry for:

- Input
- Label
- Select
- Alert

Install and theme appropriate primitives rather than maintaining multiple `inputClass()` functions. Use Relay-specific composition only around those primitives.

### Reusable visual foundations

Do not reproduce the auth design by copying long Tailwind class strings into each page. Tailwind utilities remain appropriate for one-off layout composition, but repeated visual decisions must live in shared tokens, primitives, or named variants.

Centralize these foundations:

| Foundation | Shared source | Rule |
| --- | --- | --- |
| Typography | CSS theme variables and named text styles | Define display, page title, section title, body, label, helper, and metadata styles with responsive sizes, line heights, weights, and tracking |
| Spacing | CSS theme spacing values and documented layout patterns | Standardize public gutters, section gaps, form gaps, panel padding, and compact app density |
| Shape | Radius and border tokens | Standardize controls, panels, overlays, pills, and compact state markers |
| Control size | shadcn component variants | Standardize field and button heights, icon sizes, horizontal padding, and mobile touch targets |
| Surfaces | Semantic color and elevation tokens | Standardize canvas, panel, surface, raised surface, border, overlay, and hero-only effects |
| Interaction | Shared variants | Standardize hover, active, selected, focus-visible, disabled, pending, and pressed states |
| Validation | Shared field and alert composition | Standardize error border/ring, error text, helper text, `aria-invalid`, `aria-describedby`, alert treatment, and submission status |
| Motion | Shared durations/easing and reduced-motion rules | Standardize routine feedback, sheets, dialogs, and route-state transitions |

Implementation rules:

- Prefer semantic classes such as `bg-background`, `text-muted-foreground`, `border-input`, and shared component variants over raw hex values or page-specific arbitrary values.
- Use CSS custom properties in `globals.css` for values that must change consistently across the product.
- Use `class-variance-authority` variants in shared shadcn/Relay components for recurring sizes, tones, and states.
- Create named typography utilities or shared typography components only when a style recurs; do not create wrappers for one-off text.
- Keep responsive layout utilities close to the consuming page when they describe unique composition rather than a reusable design decision.
- Avoid repeated arbitrary utilities such as `text-[...]`, `rounded-[...]`, `border-[#...]`, `bg-[#...]`, and custom shadow strings. Allow them only for documented, genuinely unique artwork or geometry.
- Preserve official third-party brand colors and deliberate auth artwork overlays as explicit exceptions.
- Keep validation rules and error mapping in domain/form logic, while rendering every field's visual validation state through the same shared primitives.
- Do not weaken existing server validation or rely on client styling as validation enforcement.

### Typography scale

Define the final values during implementation and contrast/responsive review, but provide these named roles before migrating pages:

- `display`: public hero statement only.
- `page-title`: auth, invitation, gateway, and utility-page titles.
- `section-title`: grouped content and app section headings.
- `body`: primary reading and form-support copy.
- `label`: field labels and compact action labels.
- `helper`: descriptions, validation guidance, and secondary status.
- `metadata`: timestamps, roles, machine state, and compact system details; mono only where the content is machine-readable.

The app may use denser values than public pages, but both must consume the same named scale or deliberate compact variants rather than defining unrelated sizes inline.

### Form and validation contract

All forms must compose the same field anatomy:

1. Visible label, except where an accessible visually hidden label is appropriate.
2. Shared input, textarea, or select primitive.
3. Optional helper text.
4. Field-specific error text connected with `aria-describedby`.
5. `aria-invalid` when invalid.
6. Shared form-level alert for API or submission errors that cannot be assigned to one field.
7. Consistent disabled, read-only, submitting, success, and error presentation.

Keep existing validation schemas, limits, API error codes, redirect behavior, and permission handling authoritative. This project standardizes how validation is presented and reused; it does not invent different business rules.

## 9. Implementation Phases

### Phase 0: Baseline and safeguards

- Capture desktop and mobile references for `/`, `/login`, `/signup`, a pending invitation, `/app`, one channel, search, and members.
- Capture current dark and light workspace states even though theme persistence is incomplete.
- Record public-nav anonymous and authenticated behavior.
- Run the existing frontend lint, typecheck, unit tests, and e2e smoke test before structural changes.
- Do not overwrite the current uncommitted `auth-page.tsx` changes; incorporate their intent while extracting the shared nav.

Exit criteria:

- Baseline behavior and screenshots exist.
- Existing failures are identified separately from migration regressions.

### Phase 1: Establish shared tokens and theme state

- Update `globals.css` with the auth-derived semantic dark palette and authored light counterpart.
- Align shadcn and Relay signal roles.
- Define the named typography scale, spacing/radius roles, control sizes, interaction states, and shared validation presentation.
- Add or install the required shadcn field primitives and expose only the variants needed by current Relay surfaces.
- Add the persisted theme initialization path.
- Replace `RelayAppShell.toggleTheme()` with the shared theme control.
- Add the compact theme control to the shared public navigation.
- Verify logo treatment in both themes. Add a theme-aware asset treatment only if contrast cannot be solved with its containing surface.

Exit criteria:

- Reload preserves theme selection.
- No incorrect-theme flash is visible in normal testing.
- `color-scheme` matches the root class.
- Core shadcn components render correctly in both themes.
- A representative form demonstrates the complete shared label, helper, validation, disabled, and submitting contract.
- Repeated visual values can be changed centrally without editing individual route components.

### Phase 2: Create the public route group and navigation

- Move the four public route trees under `app/(public)` without changing URLs.
- Add the public layout and shared page frame.
- Add `PublicNavigation` and session-aware action rendering.
- Preserve active route styling and `next` query behavior.
- Move public sign-out/use-another-account behavior into the shared navigation account action.
- Remove local nav/header markup from the home, auth, and invitation implementations.
- Ensure `/login` and `/signup` keep their current authenticated redirects.

Exit criteria:

- Exactly one public nav implementation exists.
- All public URLs resolve unchanged.
- Invitation continuation works through both login and signup.
- Signed-in and signed-out states match the state matrix.

### Phase 3: Migrate public content surfaces

- Refactor `AuthPage` to consume semantic tokens and the public frame.
- Replace auth-specific typography, input, status, and button class strings with the shared scale and component variants.
- Keep auth artwork and its overlay, but remove the duplicate logo if it creates unnecessary repetition with the shared nav; retain it only if visual review proves it is part of the artwork composition rather than navigation.
- Refactor the landing page to the auth-derived canvas, panel, line, text, cyan, and orange roles.
- Refactor invitation loading, invalid, terminal, pending, signed-out, signed-in, accepting, and error states.
- Make short-height and mobile public pages scroll correctly.
- Keep all existing auth and invitation behavior intact.

Exit criteria:

- Public pages read as one family.
- Auth no longer owns a private color system.
- No page duplicates the public navigation.
- Mobile controls remain reachable at 320px width and short viewport heights.

### Phase 4: Migrate authenticated entry and workspace shell

- Apply the new canvas, panel, border, foreground, muted, orange, and cyan roles to `WorkspaceGateway` and all its states.
- Migrate `RelayAppShell` loading, error, workspace rail, sidebar, mobile sheet, conversation header, user footer, dialogs, channel form, and empty states.
- Preserve the 64px rail, compact sidebar, 60px headers, responsive drawer behavior, route markers, unread state, and app-shell data flow.
- Replace dark-only `white/*` styles with semantic sidebar tokens.
- Keep orange for identity/location/unread/primary actions and cyan for focus/realtime health.
- Standardize fields through installed shadcn primitives.
- Replace repeated text-size, control-size, radius, and state utilities with shared named styles or variants where they recur.

Exit criteria:

- The workspace clearly belongs to the same visual system as auth.
- Dense product surfaces remain calm and readable.
- Navigation hierarchy and active/unread semantics are at least as clear as before.
- No authenticated behavior or permission gate changes.

### Phase 5: Migrate conversation and utility surfaces

- Refactor `ChannelMessages` tokens across message rows, action bars, reply previews, attachments, reactions, unread markers, typing, connection state, edit state, errors, loading, archive state, and composer.
- Refactor search fields, result surfaces, attachment links, empty/loading/error states.
- Refactor member management fields, select, invitation output, member rows, pending states, and errors.
- Audit popover, dropdown, dialog, sheet, textarea, avatar, tabs, tooltip, scroll area, and button primitives against the new tokens.
- Limit glow and radial effects to public/auth brand moments; use flat tonal hierarchy in operational surfaces.

Exit criteria:

- No production surface retains accidental old-palette or auth-only raw colors.
- No production surface duplicates recurring typography, field, validation, button, or panel recipes in page-local class strings.
- Interactive state meaning is consistent throughout the site.
- Conversation readability and density are preserved.

### Phase 6: Accessibility, responsive, and visual verification

- Test keyboard order and visible focus on all public navigation actions and core app controls.
- Verify `aria-current`, nav labels, icon-button names, dialog/sheet semantics, and status/error announcements.
- Test WCAG 2.2 AA contrast for both themes, including muted text, small metadata, focus rings, disabled controls, and cyan/orange text.
- Confirm state never relies on color alone.
- Confirm reduced-motion behavior for sheets, route accents, and auth/public transitions.
- Test widths at 320px, 375px, 768px, 1024px, and 1280px or larger.
- Test short viewport heights where auth and invitation actions can otherwise be clipped.
- Run one Impeccable mechanical detector pass over all changed UI targets after implementation, not during intermediate styling.

Exit criteria:

- Desktop and mobile route matrices pass in dark and light themes.
- No focus, overflow, clipping, contrast, or hydration defects remain.

### Phase 7: Documentation and cleanup

- Update `DESIGN.md` so its palette and component guidance match the implemented auth-derived system.
- Update the applicable `.impeccable/surfaces` brief or add a public-surface brief if implementation changes its visual authority.
- Remove obsolete local nav markup, duplicate field helpers, dead token values, and old raw color declarations.
- Keep `docs/09-UX-AND-DESIGN-SYSTEM.md` principles intact unless implementation reveals a needed clarification.

Exit criteria:

- Code, design documentation, and implementation references describe the same system.
- There is one source of truth for navigation, theme state, and semantic colors.

## 10. File-Level Change Map

### Add

- `frontend/app/(public)/layout.tsx`
- `frontend/components/relay/public-navigation.tsx`
- `frontend/components/relay/public-session-provider.tsx`
- `frontend/components/relay/theme-control.tsx`
- `frontend/lib/theme.ts`
- Focused tests for public navigation, auth surface behavior, and theme state

### Move without URL changes

- `frontend/app/page.tsx` to `frontend/app/(public)/page.tsx`
- `frontend/app/login/page.tsx` to `frontend/app/(public)/login/page.tsx`
- `frontend/app/signup/page.tsx` to `frontend/app/(public)/signup/page.tsx`
- `frontend/app/invite/[token]/page.tsx` to `frontend/app/(public)/invite/[token]/page.tsx`

### Modify

- `frontend/app/layout.tsx`
- `frontend/app/globals.css`
- `frontend/components/ui/input.tsx`, `label.tsx`, `select.tsx`, and `alert.tsx` when installed from the shadcn registry
- `frontend/lib/auth/session.ts`
- `frontend/lib/auth/redirect.ts` only if a shared helper is needed to preserve auth destinations
- `frontend/components/relay/auth-page.tsx`
- `frontend/components/relay/invitation-page.tsx`
- `frontend/components/relay/workspace-gateway.tsx`
- `frontend/components/relay/app-shell.tsx`
- `frontend/components/relay/channel-messages.tsx`
- `frontend/components/relay/search-page.tsx`
- `frontend/components/relay/workspace-members-page.tsx`
- `frontend/components/relay/brand-logo.tsx` only if theme-aware presentation is needed
- Relevant installed components under `frontend/components/ui/`
- `frontend/components/relay/invitation-page.test.tsx`
- `frontend/components/relay/workspace-gateway.test.tsx`
- `frontend/components/relay/channel-messages.test.tsx` only where semantic or accessible states change
- `frontend/tests/e2e/smoke.spec.ts`
- `DESIGN.md`
- Applicable `.impeccable/surfaces/*.md`

### Remove

- Local public navigation markup from home and auth surfaces.
- Invitation-specific top header once the shared nav owns that responsibility.
- Repeated `inputClass()` helpers after shadcn field primitives are installed and adopted.
- Repeated page-local typography, validation, panel, button, and interaction recipes after shared tokens or variants replace them.
- Direct root-class theme mutation in `RelayAppShell`.
- Hard-coded auth palette values that now have semantic tokens.

## 11. Testing Plan

### Unit and component tests

Add coverage for:

- Anonymous public nav renders Log in and Sign up.
- Authenticated public nav renders Open Relay and account/sign-out behavior.
- Active login/signup route exposes the correct current state.
- Switching login to signup and signup to login preserves a sanitized `next` value.
- Invitation nav actions preserve `/invite/[token]` as the destination.
- Public sign-out updates session-aware navigation.
- Auth form submission, field errors, API errors, password visibility, and pending state continue to work.
- Invitation loading, invalid, expired, revoked, accepted, wrong-account, signed-out, signed-in, accepting, and error states remain correct.
- Theme initialization and toggling apply the root class, `color-scheme`, and persisted preference.
- Shared fields consistently connect labels, helper/error text, `aria-invalid`, and `aria-describedby`.
- Typography and component variants render the intended public and compact app scales without route-specific copies.

Preserve existing tests for redirect safety, invitation acceptance, workspace routing, messaging order, optimistic reconciliation, and attachments.

### End-to-end route matrix

Test at desktop and mobile sizes:

| Flow | Required assertion |
| --- | --- |
| Anonymous landing | Shared nav, auth actions, primary CTA, no overflow |
| Login to workspace | Shared nav, successful auth, correct redirect |
| Signup to workspace | Shared nav, successful auth, correct redirect |
| Invitation to login | Invitation `next` survives and returns to acceptance |
| Invitation to signup | Invitation `next` survives and returns to acceptance |
| Authenticated landing | Open Relay and account action appear |
| Authenticated invitation | Correct account state, acceptance, and Use another account behavior |
| Theme persistence | Selected theme survives reload and route changes |
| Workspace desktop | Rail, sidebar, conversation, dialogs, and utility pages share the new system |
| Workspace mobile | Navigation sheet, conversation, composer, and utility pages remain usable |

### Visual and accessibility matrix

- Routes: home, login, signup, invitation, workspace gateway, channel, DM, search, members.
- Themes: dark and light.
- Viewports: mobile, tablet, desktop, and short-height desktop.
- States: default, hover, focus-visible, active, disabled, loading, empty, error, success, offline/reconnecting, unread, archived.
- Run automated accessibility checks if the project adds an established checker; always perform keyboard and contrast review manually.

### Required validation commands

Run from `frontend/` after implementation:

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Run the Impeccable detector once after the UI is complete:

```text
C:\Users\ashra\.agents\skills\impeccable\scripts\impeccable.cmd detect --json <changed-ui-targets>
```

## 12. Acceptance Criteria

- `/`, `/login`, `/signup`, and `/invite/[token]` render one shared public navigation implementation.
- Public URLs are unchanged after route grouping.
- Public navigation is session-aware and matches the confirmed state matrix.
- Login/signup switching and invitation auth entry preserve safe destinations.
- The entire public and authenticated site uses the auth-derived semantic visual system.
- Auth hard-coded theme values are replaced by shared tokens, except deliberate artwork overlays and official brand colors.
- Repeated text sizes, spacing, radii, control dimensions, surfaces, and interaction states are controlled through shared tokens or named variants rather than copied arbitrary Tailwind values.
- Forms use reusable field primitives and one validation-state contract while preserving existing validation logic and API behavior.
- Theme choice persists across reloads and public/app route transitions.
- Dark and light themes preserve semantic parity and pass WCAG 2.2 AA.
- The app shell remains conversation-first, compact, and responsive.
- Orange and cyan retain distinct meanings and are reinforced by non-color cues.
- Public pages and gateway states scroll correctly on narrow and short screens.
- Existing authentication, invitation, workspace, messaging, and authorization behavior is unchanged.
- Frontend lint, typecheck, tests, build, e2e tests, visual review, and the final detector pass succeed.
- `DESIGN.md` and the applicable surface brief match the shipped implementation.

## 13. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Route moves accidentally change URLs | Use one `(public)` route group and verify every route directly and through links |
| Public layout and auth pages duplicate session requests | Use one request-deduplicated server session accessor and seed client state |
| Invitation page and nav disagree after sign-out | Share public session state and update it from one sign-out action |
| Hard-coded auth colors leak into app code | Promote colors to semantic tokens before migrating surfaces |
| Neon accents reduce readability in dense views | Reserve cyan/orange by semantic role and keep operational surfaces predominantly neutral |
| Light mode becomes an afterthought | Define and test every semantic role in both themes during the token phase |
| Theme hydration flashes | Apply saved/system preference before hydration and keep server markup hydration-safe |
| Logo disappears in light mode | Keep it on a dark brand surface or provide a deliberate theme-aware treatment |
| Global hidden body overflow clips pages | Give the public frame and gateway explicit scroll ownership and test short heights |
| Shared nav queries make tests ambiguous | Scope assertions to the nav landmark and update invitation tests deliberately |
| Broad visual work causes behavior regressions | Migrate by surface, keep domain logic untouched, and run tests after each phase |

## 14. Recommended Delivery Order

Deliver this as reviewable slices rather than one large visual commit:

1. Shared tokens, persisted theme state, and primitive audit.
2. Public route group, shared navigation, and session behavior.
3. Landing, auth, and invitation visual migration.
4. Workspace gateway and app-shell visual migration.
5. Messages, search, members, overlays, and state migration.
6. Accessibility, responsive fixes, e2e coverage, detector pass, and design documentation.

Each slice should leave the frontend runnable and should not mix backend or product-scope changes into the visual migration.
