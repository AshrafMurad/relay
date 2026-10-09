"use client"

import Link from "next/link"
import { LogOut } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

import { BrandLogo } from "@/components/relay/brand-logo"
import { ThemeControl } from "@/components/relay/theme-control"
import { Button, buttonVariants } from "@/components/ui/button"
import { safeNextPath } from "@/lib/auth/redirect"
import { usePublicSession } from "@/components/relay/public-session-provider"
import { useTranslateT } from "@/lib/i18n/use-translate-t"
import { cn } from "@/lib/utils"

export function PublicNavigation() {
  const common = useTranslateT("common")
  const t = useTranslateT("navigation")
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { signOut, user } = usePublicSession()
  const authDestination = pathname.startsWith("/invite/")
    ? pathname
    : safeNextPath(searchParams.get("next") ?? undefined)
  const query = authDestination === "/app" ? "" : `?next=${encodeURIComponent(authDestination)}`

  return (
    <nav
      aria-label={t("publicAria")}
      className="theme-navigation flex min-h-14 shrink-0 items-center justify-between gap-3 rounded-2xl border border-sidebar-border bg-sidebar px-3 text-sidebar-foreground sm:px-5"
    >
      <Link aria-label={t("home")} className="flex shrink-0 items-center" href="/">
        <BrandLogo className="hidden w-24 dark:block sm:w-32" priority />
        <span className="flex items-center gap-2 dark:hidden">
          <span className="size-8"><BrandLogo mark="icon" priority /></span>
            <span className="text-lg font-semibold tracking-[-0.025em] text-signal-ink">{common("appName")}</span>
        </span>
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <ThemeControl className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        {user ? (
          <>
            <Link className={buttonVariants({ size: "sm" })} href="/app">{t("openRelay")}</Link>
            <Button
              aria-label={t("useAnotherAccount")}
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => void signOut()}
              size="icon-sm"
              title={t("useAnotherAccount")}
              type="button"
              variant="ghost"
            >
              <LogOut aria-hidden="true" />
            </Button>
          </>
        ) : (
          <>
            <Link
              aria-current={pathname === "/login" ? "page" : undefined}
              className={cn(buttonVariants({ size: "sm", variant: pathname === "/login" ? "outline" : "ghost" }), "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}
              href={`/login${query}`}
            >
              {t("login")}
            </Link>
            <Link
              aria-current={pathname === "/signup" ? "page" : undefined}
              className={buttonVariants({ size: "sm", variant: pathname === "/signup" ? "outline" : "default" })}
              href={`/signup${query}`}
            >
              {t("signup")}
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
