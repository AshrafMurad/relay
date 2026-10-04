# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Relay is optimized first for small, distributed software teams of roughly 3-50 people: developers, designers, product managers, support staff, and team leads working across locations. Early-stage startups, small agencies, and internal project teams are secondary audiences where their needs align.

Users need to keep work conversations organized, understand current activity, and communicate without the cost, administration, or feature weight of an enterprise collaboration suite.

## Product Purpose

Relay gives a small remote team one focused workspace for reliable, real-time communication through public channels and one-to-one direct messages. It exists to reduce fragmented discussion and weak context while keeping everyday collaboration fast and understandable.

The product is intended to be genuinely deployable while also serving as a portfolio-grade demonstration of production-minded real-time engineering. Success means a team can join a workspace, communicate and share context confidently, recover cleanly from connection failures, and always understand what activity needs attention.

## Positioning

Relay is a focused communication workspace for small software teams, not a reduced enterprise suite or a public community platform. Its value comes from combining a deliberately constrained collaboration model with unusually strong reliability: durable messages, immediate propagation, optimistic reconciliation, deduplicated retries, reconnect recovery, explicit unread state, and server-enforced authorization.

## Operating Context

Teams use Relay throughout the workday on desktop and mobile web. Work is organized by workspace, public channel, and direct conversation. The message stream is the primary working surface; members move between conversations, monitor unread activity and presence, reply and react in context, share files, search prior discussions, and continue through temporary connection loss.

Owners and Admins handle lightweight workspace membership, invitations, and channel management. Members participate in channels and direct messages without a heavy administrative layer.

## Capabilities and Constraints

- V1 includes authentication, workspace membership and roles, invitations, public channels, one-to-one direct messages, durable text messaging, lightweight replies, emoji reactions, presence, typing, read state, attachments, and PostgreSQL-backed message search.
- Messages are safe plain text. Reliability, authorization, reconnect recovery, deterministic ordering, and deduplication take priority over feature breadth or decorative behavior.
- Desktop uses persistent navigation and a conversation surface. Mobile web is conversation-first, with navigation in a drawer or dedicated view rather than a compressed desktop layout.
- Communication must remain the visual and interaction focus. The interface should be compact but readable, fast to operate, and low in visual noise.
- V1 excludes calls, screen sharing, bots, workflow automation, marketplace integrations, billing, enterprise compliance features, and large public communities.
- The established architecture, API boundaries, security rules, limits, and role behavior in `docs/` remain authoritative. Visual work must not weaken or bypass them.

## Brand Commitments

- The product name is Relay.
- Product language must be direct, calm, and operationally clear, especially around connection state, failed actions, permissions, and recovery.
- Future work must not invent customers, testimonials, adoption metrics, benchmarks, awards, or other proof.
- No bespoke logo or brand asset currently exists. The framework starter assets in `frontend/public/` are not Relay brand assets.

## Evidence on Hand

- The product rationale, audience, scope, information architecture, business rules, technical architecture, user flows, security model, and delivery plan are documented in `docs/`.
- The implementation is designed to demonstrate WebSocket communication, presence, optimistic UI, acknowledgements, ordering, deduplication, unread synchronization, reconnect recovery, and authorization for persistent connections.
- There are no confirmed customer testimonials, usage metrics, case studies, press mentions, or market-performance claims. Future surfaces must not fabricate them.

## Product Principles

1. Reliability earns trust: durable truth, recovery, authorization, and correct synchronization outrank novelty.
2. Communication stays central: every feature and interface decision should improve conversation, context, or activity awareness.
3. Small teams stay in flow: common actions should be immediate, lightweight, and free from enterprise administration overhead.
4. State is always legible: users should quickly understand their workspace, active conversation, unread activity, connection state, and action outcome.
5. Product depth over feature count: a focused capability implemented completely is more valuable than broad but shallow parity with larger platforms.

## Accessibility & Inclusion

Relay targets WCAG 2.2 AA. Major actions must support keyboard operation, focus must remain visible, dialogs and controls must use appropriate semantics and labels, text and state indicators must meet contrast requirements, and meaningful state cannot rely on color alone. Motion must respect reduced-motion preferences and should communicate state rather than decorate the interface.
