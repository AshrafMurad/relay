type TokenValue = string | number

export function formatMessage(template: string, values: Record<string, TokenValue>) {
  return template.replace(/\{(\w+)\}/g, (match, key) => String(values[key] ?? match))
}
