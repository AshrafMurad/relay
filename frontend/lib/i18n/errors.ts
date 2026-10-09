"use client"

import { useMemo } from "react"

import { useTranslateT } from "./use-translate-t"

type ErrorTranslator = ReturnType<typeof useTranslateT<"errors">>

function hasMessage(t: ErrorTranslator, key: string) {
  return t.has(key)
}

export function errorCodeFrom(error: unknown) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") return error.code
  return "fallback"
}

export function translateErrorCode(t: ErrorTranslator, code: string) {
  return hasMessage(t, code) ? t(code) : t("fallback")
}

export function useErrorTranslator() {
  const t = useTranslateT("errors")

  return useMemo(() => ({
    t,
    apiError(error: unknown) {
      return translateErrorCode(t, errorCodeFrom(error))
    },
    code(code: string) {
      return translateErrorCode(t, code)
    },
    field(key: string, values?: Record<string, string | number>) {
      const namespacedKey = `fields.${key}`
      return t.has(namespacedKey) ? t(namespacedKey, values) : t("fallback")
    },
    toastTitle(key: string) {
      const namespacedKey = `toast.${key}`
      return t.has(namespacedKey) ? t(namespacedKey) : t("fallback")
    },
  }), [t])
}
