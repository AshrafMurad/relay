"use client"

import Link from "next/link"
import { LogOut } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"

import { BrandLogo } from "@/components/relay/brand-logo"
import { ThemeControl } from "@/components/relay/theme-control"
import { Button } from "@/components/ui/button"
import { safeNextPath } from "@/lib/auth/redirect"
import { usePublicSession } from "@/components/relay/public-session-provider"

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
            <Button nativeButton={false} render={<Link href="/app" />} size="sm">Open Relay</Button>
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
            <Button
              aria-current={pathname === "/login" ? "page" : undefined}
              className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              nativeButton={false}
              render={<Link href={`/login${query}`} />}
              size="sm"
              variant={pathname === "/login" ? "outline" : "ghost"}
            >
              Log in
            </Button>
            <Button
              aria-current={pathname === "/signup" ? "page" : undefined}
              nativeButton={false}
              render={<Link href={`/signup${query}`} />}
              size="sm"
              variant={pathname === "/signup" ? "outline" : "default"}
            >
              Sign up
            </Button>
          </>
        )}
      </div>
    </nav>
  )
}
