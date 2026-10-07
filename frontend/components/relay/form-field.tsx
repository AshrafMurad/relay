import type { ReactNode } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function FormField({
  children,
  className,
  error,
  hint,
  htmlFor,
  label,
}: {
  children: ReactNode
  className?: string
  error?: string
  hint?: string
  htmlFor: string
  label: ReactNode
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label className="text-label" htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-helper font-semibold text-destructive" id={`${htmlFor}-error`}>{error}</p> : hint ? <p className="text-helper text-muted-foreground" id={`${htmlFor}-hint`}>{hint}</p> : null}
    </div>
  )
}

export function FormStatus({ message, tone = "error" }: { message?: string; tone?: "error" | "neutral" | "success" }) {
  if (!message) return null
  return (
    <Alert
      className={cn(
        tone === "neutral" && "border-border bg-card",
        tone === "success" && "border-signal-green/45 bg-signal-green/10 text-signal-green",
      )}
      variant={tone === "error" ? "destructive" : "default"}
    >
      <AlertDescription className="text-current">{message}</AlertDescription>
    </Alert>
  )
}
