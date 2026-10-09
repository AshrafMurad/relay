"use client"

import { useTranslations } from "next-intl"

import { formatMessage } from "./format"
import { getMessages, type AppMessages } from "./messages"

type Values = Record<string, string | number>

function getPathValue(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) return (current as Record<string, unknown>)[part]
    return undefined
  }, source)
}

function createFallbackTranslator(namespace: keyof AppMessages) {
  const namespaceMessages = getMessages()[namespace]
  const translate = (key: string, values?: Values) => {
    const value = getPathValue(namespaceMessages, key)
    if (typeof value !== "string") return key
    return values ? formatMessage(value, values) : value
  }
  translate.has = (key: string) => typeof getPathValue(namespaceMessages, key) === "string"
  return translate
}

const fallbackTranslators = new Map<keyof AppMessages, ReturnType<typeof createFallbackTranslator>>()

function getFallbackTranslator(namespace: keyof AppMessages) {
  const existing = fallbackTranslators.get(namespace)
  if (existing) return existing
  const translator = createFallbackTranslator(namespace)
  fallbackTranslators.set(namespace, translator)
  return translator
}

export function useTranslateT<Namespace extends keyof AppMessages>(namespace: Namespace) {
  try {
    return useTranslations(namespace)
  } catch {
    return getFallbackTranslator(namespace)
  }
}
