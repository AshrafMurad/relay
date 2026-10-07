"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Bell, Hash, RadioTower, UserRound, Zap, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/relay/brand-logo"
import { apiRequest, ApiClientError } from "@/lib/api/client"
import type { AuthUserDTO } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "signup"
type Status = { tone: "neutral" | "success" | "error"; message: string } | null
type FieldErrors = Partial<Record<"name" | "email" | "password", string>>

const PASSWORD_MIN_LENGTH = 6
const PASSWORD_MAX_LENGTH = 128

function inputClass() {
  return "h-12 w-full rounded-lg border border-[#28404a] bg-[#0b141a]/80 px-12 text-[15px] text-[#eef4f5] outline-none transition placeholder:text-[#71808a] focus:border-[#00d8e6] focus:ring-2 focus:ring-[#00d8e6]/20 sm:px-[52px]"
}

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

function StatusMessage({ status }: { status: Status }) {
  if (!status) return null
  return (
    <p
      className={cn(
        "rounded-[10px] border px-4 py-3 text-sm",
        status.tone === "error" && "border-red-400/30 bg-red-500/10 text-red-200",
        status.tone === "success" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
        status.tone === "neutral" && "border-[#28404a] bg-[#0b141a] text-[#a9b5bf]",
      )}
    >
      {status.message}
    </p>
  )
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

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[#eef4f5]">
      {label}
      {children}
      {error && <span className="-mt-0.5 text-xs font-semibold leading-4 text-red-300">{error}</span>}
    </label>
  )
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
        <Link className="pointer-events-auto inline-flex w-28 sm:w-32" href="/" aria-label="Relay home">
          <BrandLogo priority />
        </Link>

        <div className="mt-8 max-w-[520px] sm:mt-11 lg:mt-12">
          <div className="mb-4 flex w-fit items-center gap-2.5 rounded-full border border-[#00f5ff]/70 bg-[#001b22]/60 px-3.5 py-2 text-xs font-semibold text-[#00f5ff] shadow-[0_0_28px_rgb(0_245_255/0.12)] sm:text-sm">
            <RadioTower className="size-4" aria-hidden="true" />
            Realtime team messaging
          </div>
          <h2 className="max-w-[11ch] text-balance text-[clamp(2.4rem,4.8vw,3.8rem)] font-semibold leading-[0.98] tracking-[-0.035em] text-white drop-shadow-[0_5px_18px_rgb(0_0_0/0.55)]">
            {isSignup ? "Start where your team works." : "Pick up where you left off."}
          </h2>
          <p className="mt-4 max-w-[470px] text-base font-medium leading-7 text-[#b8c4cf] drop-shadow-[0_3px_12px_rgb(0_0_0/0.7)] sm:text-lg">
            {isSignup
              ? "Create your account, invite your team, and keep every workspace conversation moving in Relay."
              : "Continue to your conversations, channels, and team workspace in Relay."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 border-t border-white/10 pt-5 text-[#c7d0d8] sm:grid-cols-3 lg:gap-5">
        <div className="flex gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#ffa42e]/80 text-[#ffa42e] shadow-[0_0_22px_rgb(255_164_46/0.16)]">
            <Hash className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-5"><span className="block font-semibold text-white">Channels</span>Keep work organized across teams.</p>
        </div>
        <div className="flex gap-4 sm:border-l sm:border-white/10 sm:pl-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#00f5ff]/75 text-[#00f5ff] shadow-[0_0_22px_rgb(0_245_255/0.12)]">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-5"><span className="block font-semibold text-white">Presence</span>See who&apos;s online and in the flow.</p>
        </div>
        <div className="flex gap-4 sm:border-l sm:border-white/10 sm:pl-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-[#00f5ff]/75 text-[#00f5ff] shadow-[0_0_22px_rgb(0_245_255/0.12)]">
            <Zap className="size-5" aria-hidden="true" />
          </span>
          <p className="text-sm leading-5"><span className="block font-semibold text-white">Realtime</span>Messages and updates happen instantly.</p>
        </div>
      </div>

      <Bell className="absolute bottom-[35%] left-[52%] hidden size-12 text-[#ffa42e]/80 md:block" aria-hidden="true" />
    </div>
  )
}

export function AuthPage({ mode, nextPath = "/app" }: { mode: AuthMode; nextPath?: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [showPassword, setShowPassword] = useState(false)
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
    <main className="h-dvh overflow-y-auto bg-[#050c10] px-3 py-3 text-[#eef4f5] sm:px-5 sm:py-5 lg:grid lg:place-items-center lg:p-4">
      <div className="mx-auto grid min-h-full w-full max-w-[1320px] gap-4 lg:min-h-0 lg:grid-cols-[minmax(0,1.06fr)_minmax(380px,0.94fr)] xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
        <section className="relative min-h-[410px] overflow-hidden rounded-2xl border border-[#25475d] bg-[#071116] shadow-[0_24px_80px_rgb(0_0_0/0.35)] sm:min-h-[500px] lg:h-[min(calc(100dvh-32px),720px)] lg:min-h-0">
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

        <section className="grid rounded-2xl border border-[#25475d] bg-[radial-gradient(circle_at_85%_8%,rgb(18_35_39/0.92),transparent_24%),linear-gradient(180deg,#071116_0%,#050b0f_100%)] px-5 py-7 shadow-[0_24px_80px_rgb(0_0_0/0.32)] sm:px-8 lg:h-[min(calc(100dvh-32px),720px)] lg:min-h-0 lg:content-center lg:px-9 xl:px-10">
          <div className="mx-auto w-full max-w-[430px]">
            <div>
              <h1 className="text-balance text-[clamp(2.35rem,4.6vw,3.25rem)] font-semibold leading-none tracking-[-0.035em] text-white">
                {isSignup ? "Create account" : "Welcome back"}
              </h1>
              <p className="mt-3 text-base font-medium leading-7 text-[#a9b5bf] sm:text-lg">
                {isSignup ? "Sign up to start your Relay workspace." : "Log in to continue to your Relay workspace."}
              </p>
            </div>

            <form className={cn("grid", isSignup ? "mt-6 gap-3.5" : "mt-7 gap-4")} noValidate onSubmit={handleSubmit}>
              {isSignup && (
                <Field error={fieldErrors.name} label="Name">
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#9aaabd]" aria-hidden="true" />
                    <input aria-invalid={Boolean(fieldErrors.name)} className={inputClass()} name="name" placeholder="Mina Chen" />
                  </div>
                </Field>
              )}
              <Field error={fieldErrors.email} label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#9aaabd]" aria-hidden="true" />
                  <input aria-invalid={Boolean(fieldErrors.email)} className={inputClass()} inputMode="email" name="email" placeholder="you@team.com" />
                </div>
              </Field>
              <Field error={fieldErrors.password} label="Password">
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#9aaabd]" aria-hidden="true" />
                  <input
                    aria-invalid={Boolean(fieldErrors.password)}
                    className={cn(inputClass(), "pr-14")}
                    name="password"
                    placeholder={isSignup ? `At least ${PASSWORD_MIN_LENGTH} characters` : "Your password"}
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-[#9aaabd] transition hover:bg-white/5 hover:text-[#eef4f5] focus:outline-none focus:ring-2 focus:ring-[#00d8e6]/30"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
                  </button>
                </div>
              </Field>

              {!isSignup && (
                <div className="-mt-4 flex justify-end text-sm font-semibold">
                  <span className="text-[#00f5ff] underline decoration-[#00f5ff]/80 underline-offset-4" aria-disabled="true">
                    Forgot password?
                  </span>
                </div>
              )}

              <StatusMessage status={status} />
              <Button
                className="mt-1 h-12 rounded-lg bg-[#ffa42e] text-base font-bold text-[#071116] hover:bg-[#ffb64d] focus-visible:ring-[#ffa42e]/35"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Continuing..." : isSignup ? "Create Relay account" : "Continue to Relay"}
                <ArrowRight className="ml-2 size-5" aria-hidden="true" />
              </Button>
            </form>

            <div className={cn("flex items-center gap-5 text-sm text-[#84919a]", isSignup ? "my-4" : "my-5")}>
              <span className="h-px flex-1 bg-[#28404a]" />
              <span>or continue with</span>
              <span className="h-px flex-1 bg-[#28404a]" />
            </div>

            <button
              className="flex h-12 w-full items-center justify-center gap-5 rounded-lg border border-[#28404a] bg-[#0d1a21]/80 text-base font-semibold text-[#eef4f5] transition hover:border-[#3f5c68] hover:bg-[#13252e] focus:outline-none focus:ring-2 focus:ring-[#00d8e6]/25 disabled:cursor-not-allowed disabled:opacity-100"
              disabled
              title="Google sign-in is not configured yet."
              type="button"
            >
              <GoogleMark />
              Continue with Google
            </button>

            <p className={cn("text-center text-base text-[#a9b5bf]", isSignup ? "mt-5" : "mt-6")}>
              {isSignup ? "Already have an account?" : "Need an account?"} {" "}
              <Link className="font-semibold text-[#00f5ff] underline decoration-[#00f5ff]/80 underline-offset-4" href={`${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(nextPath)}`}>
                {isSignup ? "Log in" : "Create one"}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
