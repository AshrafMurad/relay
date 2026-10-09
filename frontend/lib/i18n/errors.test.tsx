import { renderHook } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"

import { DEFAULT_LOCALE } from "@/lib/i18n/locale"
import { getMessages } from "@/lib/i18n/messages"

import { useErrorTranslator } from "./errors"

function wrapper({ children }: { children: ReactNode }) {
  return <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={getMessages()}>{children}</NextIntlClientProvider>
}

describe("useErrorTranslator", () => {
  it("defines translations for every public API error code", () => {
    const errorMessages = getMessages().errors
    const apiErrorCodes = [
      "INTERNAL_ERROR",
      "NOT_FOUND",
      "SERVICE_UNAVAILABLE",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "VALIDATION_ERROR",
      "EMAIL_NOT_VERIFIED",
      "INVALID_CREDENTIALS",
      "INVITATION_INVALID",
      "INVITATION_EXPIRED",
      "INVITATION_ALREADY_USED",
      "INVITATION_PENDING",
      "ALREADY_MEMBER",
      "WORKSPACE_NOT_FOUND",
      "MEMBER_NOT_FOUND",
      "CHANNEL_NOT_FOUND",
      "CONVERSATION_NOT_FOUND",
      "CHANNEL_NAME_TAKEN",
      "DEFAULT_CHANNEL_PROTECTED",
      "MESSAGE_NOT_FOUND",
      "MESSAGE_EMPTY",
      "MESSAGE_TOO_LONG",
      "ATTACHMENT_NOT_FOUND",
      "ATTACHMENT_TOO_LARGE",
      "ATTACHMENT_LIMIT_EXCEEDED",
      "ATTACHMENT_TYPE_NOT_ALLOWED",
      "WORKSPACE_STORAGE_QUOTA_EXCEEDED",
      "CHANNEL_ARCHIVED",
      "INVALID_CURSOR",
      "MESSAGE_SEND_RATE_LIMITED",
      "RATE_LIMITED",
      "CONFLICT",
    ]

    for (const code of apiErrorCodes) {
      expect(errorMessages).toHaveProperty(code)
    }
  })

  it("translates API error codes from the errors namespace", () => {
    const { result } = renderHook(() => useErrorTranslator(), { wrapper })

    expect(result.current.apiError({ code: "FORBIDDEN" })).toBe("You do not have permission to do that.")
  })

  it("uses the generic fallback for unknown errors and unknown codes", () => {
    const { result } = renderHook(() => useErrorTranslator(), { wrapper })

    expect(result.current.apiError(new Error("Raw internal message"))).toBe("Something went wrong. Please try again.")
    expect(result.current.code("DOES_NOT_EXIST")).toBe("Something went wrong. Please try again.")
  })

  it("translates field-level validation messages with interpolation", () => {
    const { result } = renderHook(() => useErrorTranslator(), { wrapper })

    expect(result.current.field("messageTooLong", { extra: 3 })).toBe("Message is 3 characters too long.")
  })
})
