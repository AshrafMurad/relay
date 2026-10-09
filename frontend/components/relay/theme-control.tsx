"use client"

import { Moon, Sun } from "lucide-react"
import { useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import { useTranslateT } from "@/lib/i18n/use-translate-t"
import { applyTheme, getThemeSnapshot, subscribeToTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function ThemeControl({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const t = useTranslateT("theme")
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "dark")
  const nextTheme = theme === "dark" ? "light" : "dark"

  return (
    <Button
      aria-label={t("useTheme", { theme: nextTheme })}
      className={cn("text-inherit", className)}
      onClick={() => applyTheme(nextTheme)}
      size={showLabel ? "sm" : "icon-sm"}
      title={t("useTheme", { theme: nextTheme })}
      type="button"
      variant="ghost"
    >
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      {showLabel && <span>{nextTheme === "dark" ? t("darkMode") : t("lightMode")}</span>}
    </Button>
  )
}
