import type { ConversationReadStateDTO, MessageDTO } from "../modules/messages/message.contracts.js";

export interface RealtimeConversation {
  type: "channel" | "dm";
  id: string;
  workspaceId: string;
  room: string;
}

export type RealtimeDomainEvent =
  | { type: "message:new" | "message:update" | "message:delete"; sequence: string; conversation: RealtimeConversation; message: MessageDTO }
  | { type: "reaction:update"; sequence: string; conversation: RealtimeConversation; messageId: string }
  | { type: "conversation:read:update"; sequence: string; conversation: RealtimeConversation; readState: ConversationReadStateDTO };

type RealtimeListener = (event: RealtimeDomainEvent) => void | Promise<void>;

export class RealtimeEventBus {
  readonly #listeners = new Set<RealtimeListener>();

  publish(event: RealtimeDomainEvent) {
    for (const listener of this.#listeners) void Promise.resolve(listener(event)).catch(() => undefined);
  }

  subscribe(listener: RealtimeListener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
