"use client"

import Link from "next/link"
import { LogOut } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

import { BrandLogo } from "@/components/relay/brand-logo"
import { ThemeControl } from "@/components/relay/theme-control"
import { Button, buttonVariants } from "@/components/ui/button"
import { safeNextPath } from "@/lib/auth/redirect"
import { usePublicSession } from "@/components/relay/public-session-provider"
import { cn } from "@/lib/utils"

export function PublicNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { signOut, user } = usePublicSession()
  const authDestination = pathname.startsWith("/invite/")
    ? pathname
    : safeNextPath(searchParams.get("next") ?? undefined)
  const query = authDestination === "/app" ? "" : `?next=${encodeURIComponent(authDestination)}`

  return (
    <nav
      aria-label="Public navigation"
      className="flex min-h-14 shrink-0 items-center justify-between gap-3 rounded-2xl border border-sidebar-border bg-sidebar px-3 text-sidebar-foreground sm:px-5"
    >
      <Link aria-label="Relay home" className="flex w-24 shrink-0 sm:w-32" href="/">
        <BrandLogo priority />
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <ThemeControl className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        {user ? (
          <>
            <Link className={buttonVariants({ size: "sm" })} href="/app">Open Relay</Link>
            <Button
              aria-label="Use another account"
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => void signOut()}
              size="icon-sm"
              title="Use another account"
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
              Log in
            </Link>
            <Link
              aria-current={pathname === "/signup" ? "page" : undefined}
              className={buttonVariants({ size: "sm", variant: pathname === "/signup" ? "outline" : "default" })}
              href={`/signup${query}`}
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
