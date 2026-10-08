import type { FormEvent, ReactNode } from "react"
import { Upload } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { AuthUserDTO, ChannelDTO, WorkspaceDTO } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"
import { AvatarPicture, initials } from "@/components/relay/app-shell/shared"

export type ChannelFormMode = "create" | "edit"

function ImagePreview({ fallback, src }: { fallback: string; src: string | null }) {
  return (
    <Avatar className="size-20 overflow-hidden rounded-lg border border-signal-line bg-signal-surface">
      <AvatarPicture alt="" className="rounded-lg object-cover" src={src} />
      <AvatarFallback className="rounded-lg bg-signal-surface-raised text-sm font-semibold text-signal-muted">{fallback}</AvatarFallback>
    </Avatar>
  )
}

function formatImageSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UtilityDialog({ children, isMembersPage, open, workspaceName, onClose }: { children: ReactNode; isMembersPage: boolean; open: boolean; workspaceName: string; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <DialogContent className={cn("max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg border border-signal-line bg-signal-paper p-0 text-signal-ink ring-0 sm:max-w-2xl", isMembersPage && "sm:max-w-4xl")}>
        <DialogHeader className="shrink-0 border-b border-signal-line px-5 py-4 pr-12 text-left">
          <DialogTitle>{isMembersPage ? "Workspace members" : "Search messages"}</DialogTitle>
          <DialogDescription>{isMembersPage ? `Manage access to ${workspaceName} and share pending invitations.` : `Find messages across channels and direct conversations in ${workspaceName}.`}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

type AccountImagesDialogProps = {
  imageError: string
  imageSubmitting: "profile" | "workspace" | null
  imageUploadProgress: number
  mayManage: boolean
  open: boolean
  profileImageFile: File | null
  profilePreview: string | null
  user: AuthUserDTO
  workspace: WorkspaceDTO
  workspaceImageFile: File | null
  workspacePreview: string | null
  onChooseProfileImage: (file: File | null) => void
  onChooseWorkspaceImage: (file: File | null) => void
  onOpenChange: (open: boolean) => void
  onUploadProfileImage: () => void
  onUploadWorkspaceImage: () => void
}

export function AccountImagesDialog({ imageError, imageSubmitting, imageUploadProgress, mayManage, open, profileImageFile, profilePreview, user, workspace, workspaceImageFile, workspacePreview, onChooseProfileImage, onChooseWorkspaceImage, onOpenChange, onUploadProfileImage, onUploadWorkspaceImage }: AccountImagesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden border-signal-line bg-signal-paper p-3 text-signal-ink sm:max-w-lg sm:p-4">
        <DialogHeader className="pr-8">
          <DialogTitle>Profile and workspace images</DialogTitle>
          <DialogDescription className="text-xs leading-5 sm:text-sm">Upload JPG, PNG, GIF, or WebP images up to 5 MiB. Images are cropped for compact workspace and message surfaces.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <section className="rounded-lg border border-signal-line bg-signal-surface/55 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4">
              <ImagePreview fallback={initials(user.name)} src={profilePreview ?? user.image} />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Profile image</h3>
                <p className="text-helper mt-1 text-signal-muted">Shown beside your messages, direct messages, and member records.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center lg:grid-cols-[auto_minmax(0,1fr)_auto]">
                  <label className={cn(buttonVariants({ size: "sm", variant: "outline" }), "cursor-pointer border-signal-line bg-signal-paper text-signal-ink hover:bg-signal-surface-raised") } htmlFor="profile-image-input">Choose image</label>
                  <Input accept=".jpg,.jpeg,.png,.gif,.webp" className="sr-only" id="profile-image-input" onChange={(event) => onChooseProfileImage(event.target.files?.[0] ?? null)} type="file" />
                  <p className="text-metadata min-w-0 truncate rounded-md border border-signal-line bg-signal-paper px-2.5 py-2 text-signal-muted">
                    {profileImageFile ? `${profileImageFile.name} · ${formatImageSize(profileImageFile.size)}` : "No file selected"}
                  </p>
                  <Button className="w-full sm:col-span-2 lg:col-span-1 lg:w-auto" disabled={!profileImageFile || imageSubmitting !== null} onClick={onUploadProfileImage} size="sm" type="button">{imageSubmitting === "profile" ? <Spinner /> : <Upload />}{imageSubmitting === "profile" ? "Uploading" : "Upload"}</Button>
                </div>
              </div>
            </div>
            {imageSubmitting === "profile" && <Progress className="mt-3 gap-1.5" value={imageUploadProgress}><ProgressLabel className="text-helper text-signal-muted">Uploading profile image</ProgressLabel><ProgressValue className="text-metadata text-signal-muted" /></Progress>}
          </section>

          {mayManage && (
            <section className="rounded-lg border border-signal-line bg-signal-surface/55 p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4">
                <ImagePreview fallback={initials(workspace.name)} src={workspacePreview ?? workspace.imageUrl} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">Workspace image</h3>
                  <p className="text-helper mt-1 text-signal-muted">Used in the workspace rail and switcher for {workspace.name}.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center lg:grid-cols-[auto_minmax(0,1fr)_auto]">
                    <label className={cn(buttonVariants({ size: "sm", variant: "outline" }), "cursor-pointer border-signal-line bg-signal-paper text-signal-ink hover:bg-signal-surface-raised") } htmlFor="workspace-image-input">Choose image</label>
                    <Input accept=".jpg,.jpeg,.png,.gif,.webp" className="sr-only" id="workspace-image-input" onChange={(event) => onChooseWorkspaceImage(event.target.files?.[0] ?? null)} type="file" />
                    <p className="text-metadata min-w-0 truncate rounded-md border border-signal-line bg-signal-paper px-2.5 py-2 text-signal-muted">
                      {workspaceImageFile ? `${workspaceImageFile.name} · ${formatImageSize(workspaceImageFile.size)}` : "No file selected"}
                    </p>
                    <Button className="w-full sm:col-span-2 lg:col-span-1 lg:w-auto" disabled={!workspaceImageFile || imageSubmitting !== null} onClick={onUploadWorkspaceImage} size="sm" type="button">{imageSubmitting === "workspace" ? <Spinner /> : <Upload />}{imageSubmitting === "workspace" ? "Uploading" : "Upload"}</Button>
                  </div>
                </div>
              </div>
              {imageSubmitting === "workspace" && <Progress className="mt-3 gap-1.5" value={imageUploadProgress}><ProgressLabel className="text-helper text-signal-muted">Uploading workspace image</ProgressLabel><ProgressValue className="text-metadata text-signal-muted" /></Progress>}
            </section>
          )}

          {imageError && <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{imageError}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

type ChannelFormSheetProps = {
  channelNameError: string
  formError: string
  formMode: ChannelFormMode
  open: boolean
  selectedChannel: ChannelDTO | null
  submitting: boolean
  onClearChannelNameError: () => void
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function ChannelFormSheet({ channelNameError, formError, formMode, open, selectedChannel, submitting, onClearChannelNameError, onOpenChange, onSubmit }: ChannelFormSheetProps) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-[min(92vw,420px)] border-signal-line bg-signal-paper" side="right">
        <SheetHeader>
          <SheetTitle>{formMode === "create" ? "Create channel" : "Edit channel"}</SheetTitle>
          <SheetDescription>{formMode === "create" ? "Add a public channel for every active workspace member." : `Update #${selectedChannel?.name}.`}</SheetDescription>
        </SheetHeader>
        <form className="grid gap-5 px-4" key={`${formMode}-${selectedChannel?.id ?? "new"}`} noValidate onSubmit={onSubmit}>
           <label className="grid gap-1.5 text-sm font-medium">Name<Input aria-describedby={channelNameError ? "channel-name-error" : "channel-name-hint"} aria-invalid={Boolean(channelNameError)} autoFocus defaultValue={formMode === "edit" ? selectedChannel?.name : ""} name="name" onChange={onClearChannelNameError} readOnly={formMode === "edit" && selectedChannel?.name === "general"} />{channelNameError ? <span className="text-helper font-semibold text-destructive" id="channel-name-error">{channelNameError}</span> : <span className="text-helper font-normal text-muted-foreground" id="channel-name-hint">Lowercase letters, numbers, hyphens, and underscores only.</span>}</label>
           <label className="grid gap-1.5 text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span><Textarea className="min-h-28" defaultValue={formMode === "edit" ? selectedChannel?.description ?? "" : ""} name="description" /></label>
          {formError && <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{formError}</p>}
          <div className="flex justify-end gap-2"><Button onClick={() => onOpenChange(false)} type="button" variant="outline">Cancel</Button><Button disabled={submitting} type="submit">{submitting && <Spinner />}{submitting ? "Saving" : formMode === "create" ? "Create channel" : "Save changes"}</Button></div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
