import type { AuthUserDTO, MessageDTO } from "./api/contracts"

export const MESSAGE_CODE_POINT_LIMIT = 4_000

export type MessageDelivery = "sending" | "failed"

export type ClientMessage = MessageDTO & {
  delivery?: MessageDelivery
  failureMessage?: string
  temporary?: boolean
}

export type MessageContentResult =
  | { success: true; content: string; codePoints: number }
  | { success: false; content: string; codePoints: number; message: string }

export function validateMessageContent(value: string): MessageContentResult {
  const content = value.trim()
  const codePoints = Array.from(content).length
  if (codePoints === 0) {
    return { success: false, content, codePoints, message: "Write a message before sending." }
  }
  if (codePoints > MESSAGE_CODE_POINT_LIMIT) {
    return {
      success: false,
      content,
      codePoints,
      message: `Message is ${codePoints - MESSAGE_CODE_POINT_LIMIT} characters too long.`,
    }
  }
  return { success: true, content, codePoints }
}

export function compareMessages(left: ClientMessage, right: ClientMessage) {
  const timestampOrder = left.createdAt.localeCompare(right.createdAt)
  return timestampOrder || left.id.localeCompare(right.id)
}

export function mergeMessages(current: ClientMessage[], incoming: ClientMessage[]) {
  const merged = [...current]
  for (const message of incoming) {
    const duplicateIndexes: number[] = []
    merged.forEach((candidate, index) => {
      if (candidate.id === message.id || candidate.operationId === message.operationId) duplicateIndexes.push(index)
    })
    for (let index = duplicateIndexes.length - 1; index >= 0; index -= 1) {
      merged.splice(duplicateIndexes[index], 1)
    }
    merged.push(message)
  }
  return merged.sort(compareMessages)
}

export function replaceMessage(current: ClientMessage[], message: MessageDTO) {
  return mergeMessages(current, [message])
}

export function reconcileMessageUpdate(current: ClientMessage[], message: MessageDTO) {
  return replaceMessage(current, message).map((candidate) => {
    if (candidate.parentMessageId !== message.id || !candidate.parent) return candidate
    return {
      ...candidate,
      parent: {
        id: message.id,
        authorName: message.author.name,
        content: message.content,
        deletedAt: message.deletedAt,
      },
    }
  })
}

export function createOptimisticMessage({
  channelId,
  directConversationId,
  content,
  operationId,
  parent,
  temporaryId,
  user,
  workspaceId,
}: {
  channelId: string | null
  directConversationId?: string | null
  content: string
  operationId: string
  parent: MessageDTO | null
  temporaryId: string
  user: AuthUserDTO
  workspaceId: string
}): ClientMessage {
  const now = new Date().toISOString()
  return {
    id: temporaryId,
    workspaceId,
    channelId,
    directConversationId: directConversationId ?? null,
    operationId,
    author: { id: user.id, name: user.name, image: user.image },
    content,
    parentMessageId: parent?.id ?? null,
    parent: parent ? {
      id: parent.id,
      authorName: parent.author.name,
      content: parent.content,
      deletedAt: parent.deletedAt,
    } : null,
    reactions: [],
    editedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    delivery: "sending",
    temporary: true,
  }
}
