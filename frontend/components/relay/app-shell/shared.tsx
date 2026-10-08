import { AvatarImage } from "@/components/ui/avatar"
import { mediaUrl } from "@/lib/api/media"

export function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

export function AvatarPicture({ alt = "", className, src }: { alt?: string; className?: string; src: string | null | undefined }) {
  const resolved = mediaUrl(src)
  return resolved ? <AvatarImage alt={alt} className={className} src={resolved} /> : null
}
