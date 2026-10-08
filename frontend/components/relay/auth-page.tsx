"use client"

import { useState, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Bell, Hash, RadioTower, UserRound, Zap, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FormField, FormStatus } from "@/components/relay/form-field"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { apiRequest, ApiClientError } from "@/lib/api/client"
import type { AuthUserDTO } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "signup"
type Status = { tone: "neutral" | "success" | "error"; message: string } | null
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>

const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 128

function statusFromError(error: unknown): Status {
  if (error instanceof ApiClientError) return { tone: "error", message: error.message }
  return { tone: "error", message: "Something went wrong." }
}

function fieldErrorFromError(error: unknown): FieldErrors | null {
  if (!(error instanceof ApiClientError) || error.code !== "VALIDATION_ERROR") return null

  const message = error.message.toLowerCase()
  if (message.includes("email")) return { email: error.message }
  if (message.includes("password")) return { password: error.message }
  if (message.includes("name")) return { name: error.message }
  return null
}

function validateAuthForm(form: FormData, isSignup: boolean) {
  const values = {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  }
  const errors: FieldErrors = {}

  if (isSignup && !values.name) errors.name = "Enter your name."
  if (!values.email) errors.email = "Enter your email."
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter a valid email address."
  if (!values.password) errors.password = "Enter your password."
  else if (isSignup && values.password.length < PASSWORD_MIN_LENGTH) errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  else if (values.password.length > PASSWORD_MAX_LENGTH) errors.password = `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`

  return { values, errors }
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24">
      <path d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.37a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.99-4.31 2.99-7.52Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.96-.89 6.61-2.42l-3.23-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.07v2.59A9.99 9.99 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.41 13.91a6.02 6.02 0 0 1 0-3.82V7.5H3.07a10.01 10.01 0 0 0 0 9l3.34-2.59Z" fill="#FBBC05" />
      <path d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.86-2.86A9.61 9.61 0 0 0 12 2 9.99 9.99 0 0 0 3.07 7.5l3.34 2.59C7.2 7.73 9.4 5.98 12 5.98Z" fill="#EA4335" />
    </svg>
  )
}

function AuthArtworkOverlay({ isSignup }: { isSignup: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-[linear-gradient(90deg,rgb(2_10_14/0.88)_0%,rgb(2_10_14/0.64)_38%,transparent_78%)] p-6 sm:p-8 lg:p-10 xl:p-11">
      <div>
        <div className="max-w-[520px]">
          <div className="mb-4 flex w-fit items-center gap-2.5 rounded-full border border-signal-cyan/70 bg-signal-carbon/70 px-3.5 py-2 text-xs font-semibold text-signal-cyan shadow-[0_8px_28px_rgb(0_0_0/0.28)] sm:text-sm">
            <RadioTower className="size-4" aria-hidden="true" />
            Realtime team messaging
          </div>
          <h2 className="max-w-[11ch] text-balance text-[clamp(2.4rem,4.8vw,3.8rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-white drop-shadow-[0_5px_18px_rgb(0_0_0/0.55)]">
            {isSignup ? "Start where your team works." : "Pick up where you left off."}
          </h2>
          <p className="mt-4 max-w-[470px] text-base font-medium leading-7 text-signal-panel-muted drop-shadow-[0_3px_12px_rgb(0_0_0/0.7)] sm:text-lg">
            {isSignup
              ? "Create your account, invite your team, and keep every workspace conversation moving in Relay."
              : "Continue to your conversations, channels, and team workspace in Relay."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 border-t border-sidebar-border pt-5 text-signal-panel-muted sm:grid-cols-3 lg:gap-5">
        <div className="flex gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-signal-amber/80 text-signal-amber">
            <Hash className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-5"><span className="block font-semibold text-white">Channels</span>Keep work organized across teams.</p>
        </div>
        <div className="flex gap-4 sm:border-l sm:border-sidebar-border sm:pl-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-signal-cyan/75 text-signal-cyan">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-5"><span className="block font-semibold text-white">Presence</span>See who&apos;s online and in the flow.</p>
        </div>
        <div className="flex gap-4 sm:border-l sm:border-sidebar-border sm:pl-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-signal-cyan/75 text-signal-cyan">
            <Zap className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-5"><span className="block font-semibold text-white">Realtime</span>Messages and updates happen instantly.</p>
        </div>
      </div>

      <Bell className="absolute bottom-[35%] left-[52%] hidden size-12 text-signal-amber/80 md:block" aria-hidden="true" />
    </div>
  )
}

export function AuthPage({ mode, nextPath = "/app" }: { mode: AuthMode; nextPath?: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [googleTooltipOpen, setGoogleTooltipOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSignup = mode === "signup"

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const { values, errors } = validateAuthForm(form, isSignup)
    setFieldErrors(errors)
    setStatus(null)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)
    try {
      if (isSignup) {
        await apiRequest<{ user: AuthUserDTO }>("/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            name: values.name,
            email: values.email,
            password: values.password,
          }),
        })
        router.replace(nextPath)
        return
      }

      await apiRequest<{ user: AuthUserDTO }>("/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email: values.email, password: values.password }),
      })
      router.replace(nextPath)
    } catch (error) {
      const apiFieldErrors = fieldErrorFromError(error)
      if (apiFieldErrors) setFieldErrors(apiFieldErrors)
      else setStatus(statusFromError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid flex-1 gap-4 lg:min-h-0 lg:grid-cols-[minmax(0,1.06fr)_minmax(380px,0.94fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <section className="panel-prominent relative hidden min-h-[410px] overflow-hidden bg-sidebar lg:block lg:h-[min(calc(100dvh-112px),720px)] lg:min-h-0">
          <Image
            alt="Relay realtime team messaging preview"
            className="object-cover"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 760px"
            src="/auth-bg.png"
          />
          <AuthArtworkOverlay isSignup={isSignup} />
        </section>

        <section className="panel-prominent grid min-h-[calc(100dvh-6.5rem)] bg-[radial-gradient(circle_at_85%_8%,color-mix(in_srgb,var(--accent),transparent_15%),transparent_28%)] px-5 py-7 sm:px-8 lg:h-[min(calc(100dvh-112px),720px)] lg:min-h-0 lg:content-center lg:px-9 xl:px-10">
          <div className="mx-auto w-full max-w-[430px]">
            <div>
              <h1 className="text-page-title text-balance">
                {isSignup ? "Create account" : "Welcome back"}
              </h1>
              <p className="mt-3 text-base font-medium leading-7 text-muted-foreground sm:text-lg">
                {isSignup ? "Sign up to start your Relay workspace." : "Log in to continue to your Relay workspace."}
              </p>
            </div>

            <form className={cn("grid", isSignup ? "mt-6 gap-3.5" : "mt-7 gap-4")} noValidate onSubmit={handleSubmit}>
              {isSignup && (
                <FormField error={fieldErrors.name} htmlFor="auth-name" label="Name">
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input aria-describedby={fieldErrors.name ? "auth-name-error" : undefined} aria-invalid={Boolean(fieldErrors.name)} className="px-12 sm:px-[52px]" fieldSize="large" id="auth-name" name="name" placeholder="Mina Chen" />
                  </div>
                </FormField>
              )}
              <FormField error={fieldErrors.email} htmlFor="auth-email" label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input aria-describedby={fieldErrors.email ? "auth-email-error" : undefined} aria-invalid={Boolean(fieldErrors.email)} className="px-12 sm:px-[52px]" fieldSize="large" id="auth-email" inputMode="email" name="email" placeholder="you@team.com" />
                </div>
              </FormField>
              <FormField error={fieldErrors.password} htmlFor="auth-password" label="Password">
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    aria-describedby={fieldErrors.password ? "auth-password-error" : undefined}
                    aria-invalid={Boolean(fieldErrors.password)}
                    className="px-12 pr-14 sm:pl-[52px]"
                    fieldSize="large"
                    id="auth-password"
                    name="password"
                    placeholder={isSignup ? `At least ${PASSWORD_MIN_LENGTH} characters` : "Your password"}
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
                  </button>
                </div>
              </FormField>

              {!isSignup && (
                <div className="-mt-4 flex justify-end text-sm font-semibold">
                  <span className="text-signal-cyan-ink underline decoration-signal-cyan/80 underline-offset-4" aria-disabled="true">
                    Forgot password?
                  </span>
                </div>
              )}

              <FormStatus message={status?.message} tone={status?.tone} />
              <Button
                className="mt-1 h-12 text-base font-bold"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Continuing..." : isSignup ? "Create Relay account" : "Continue to Relay"}
                <ArrowRight className="ml-2 size-5" aria-hidden="true" />
              </Button>
            </form>

            <div className={cn("flex items-center gap-5 text-sm text-muted-foreground", isSignup ? "my-4" : "my-5")}>
              <span className="h-px flex-1 bg-border" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <TooltipProvider>
              <Tooltip onOpenChange={setGoogleTooltipOpen} open={googleTooltipOpen}>
                <TooltipTrigger render={<Button aria-label="Continue with Google, coming soon" className="h-12 w-full gap-5 text-base" onClick={() => setGoogleTooltipOpen(true)} type="button" variant="outline" />}>
                  <GoogleMark />
                  Continue with Google
                </TooltipTrigger>
                <TooltipContent side="top">Coming soon</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <p className={cn("text-center text-base text-muted-foreground", isSignup ? "mt-5" : "mt-6")}>
              {isSignup ? "Already have an account?" : "Need an account?"} {" "}
              <Link className="font-semibold text-signal-cyan-ink underline decoration-signal-cyan/80 underline-offset-4" href={`${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(nextPath)}`}>
                {isSignup ? "Log in" : "Create one"}
              </Link>
            </p>
          </div>
        </section>
    </main>
  )
}
