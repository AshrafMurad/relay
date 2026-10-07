import Image from "next/image"

import { cn } from "@/lib/utils"

type BrandLogoProps = {
  className?: string
  mark?: "horizontal" | "icon"
  priority?: boolean
}

export function BrandLogo({ className, mark = "horizontal", priority = false }: BrandLogoProps) {
  if (mark === "icon") {
    return (
      <Image
        alt=""
        aria-hidden="true"
        className={cn("size-full object-contain", className)}
        height={1254}
        priority={priority}
        src="/logo-icon.png"
        width={1254}
      />
    )
  }

  return (
    <Image
      alt="Relay"
      className={cn("h-auto w-full object-contain", className)}
      height={724}
      priority={priority}
      src="/horizontal-logo.png"
      width={2172}
    />
  )
}
