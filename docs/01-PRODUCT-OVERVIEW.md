# Relay — Product Overview

## 1. Product Summary

Relay is a real-time communication workspace for small remote teams. It gives teams a focused place to communicate through workspace channels and direct messages without the complexity of large enterprise communication platforms.

Relay is intentionally not a full Slack or Discord clone. The product is scoped around the communication features that matter most for small teams while demonstrating strong real-time application engineering.

## 2. Product Story

A small remote company has developers, designers, managers, and support staff working from different locations. Using general-purpose messaging apps creates fragmented discussions, poor context, and weak team organization.

Relay gives the company one shared workspace where members can:

- communicate in organized channels;
- send direct messages;
- see who is online;
- receive messages instantly;
- see typing activity;
- react and reply to messages;
- share files;
- find previous conversations;
- track unread activity.

## 3. Target Users

### Primary users
- Small remote teams.
- Early-stage startups.
- Small agencies.
- Distributed software teams.
- Small internal project teams.

### Typical team size
Relay V1 is optimized conceptually for teams of roughly 3–50 people. This is a product-positioning target rather than a hard technical limit.

## 4. Core Problem

Small teams often need organized, real-time communication but do not need the complexity, cost, administration, or feature depth of enterprise communication suites.

Relay solves this through a simple workspace model built around channels, direct conversations, presence, real-time delivery, and lightweight collaboration.

## 5. Product Goals

1. Deliver reliable real-time team messaging.
2. Keep collaboration organized around workspaces and channels.
3. Make communication state clear through presence, typing, unread state, and reactions.
4. Handle reconnects and temporary network failures gracefully.
5. Provide a polished, responsive experience.
6. Demonstrate production-minded real-time architecture.

## 6. Non-Goals for V1

Relay V1 will not include:

- voice calls;
- video calls;
- screen sharing;
- large-scale community servers;
- advanced bots;
- app marketplace integrations;
- enterprise SSO;
- billing;
- complex compliance tooling;
- workflow automation;
- full Slack-compatible feature parity.

## 7. Portfolio Purpose

Relay complements larger SaaS projects by demonstrating engineering areas that traditional dashboards do not showcase strongly:

- WebSockets and persistent connections;
- real-time event design;
- presence systems;
- reconnect and resynchronization logic;
- optimistic UI;
- event acknowledgements;
- message ordering and deduplication;
- unread/read state synchronization;
- authorization inside real-time channels;
- Redis pub/sub and ephemeral state.

## 8. Product Principles

### Real-time first
The product should feel immediate. Sending, receiving, typing, presence, and reactions should update without manual refreshes.

### Focused over feature-heavy
Every feature must reinforce team communication. Avoid adding unrelated project-management features to V1.

### Reliable over flashy
Connection recovery, message correctness, authorization, and state synchronization matter more than decorative functionality.

### Clear hierarchy
Users should always understand which workspace, channel, or conversation they are currently in.

### Small-team simplicity
Administration should remain lightweight.

## 9. V1 Success Criteria

V1 is considered successful when a team can:

1. Register and create a workspace.
2. Invite members.
3. Create and open public workspace channels.
4. Send and receive messages in real time.
5. Send direct messages.
6. See basic member presence.
7. See typing activity.
8. React and reply to messages.
9. Upload supported files.
10. Search conversation history.
11. Track unread messages.
12. Recover safely after losing and restoring network connectivity.
