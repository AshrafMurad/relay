"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "group/toast border-signal-line bg-signal-surface text-signal-ink shadow-md",
          title: "text-sm font-semibold text-signal-ink",
          description: "text-xs leading-5 text-signal-muted",
          success: "border-signal-cyan/45 [&_[data-icon]]:text-signal-cyan",
          error: "border-destructive/45 [&_[data-icon]]:text-destructive",
          warning: "border-signal-amber/45 [&_[data-icon]]:text-signal-amber",
          info: "border-signal-line [&_[data-icon]]:text-signal-cyan",
          closeButton: "border-signal-line bg-signal-surface text-signal-muted hover:bg-signal-surface-raised hover:text-signal-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
