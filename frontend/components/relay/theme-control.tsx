"use client"

import { Moon, Sun } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { applyTheme, getThemeSnapshot, subscribeToTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function ThemeControl({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "dark")
  const nextTheme = theme === "dark" ? "light" : "dark"

  return (
    <Button
      aria-label={`Use ${nextTheme} theme`}
      className={cn("text-inherit", className)}
      onClick={() => applyTheme(nextTheme)}
      size={showLabel ? "sm" : "icon-sm"}
      title={`Use ${nextTheme} theme`}
      type="button"
      variant="ghost"
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      {showLabel && <span>{nextTheme === "dark" ? "Dark mode" : "Light mode"}</span>}
    </Button>
  )
}
