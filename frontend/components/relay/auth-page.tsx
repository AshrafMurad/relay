"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, RadioTower, ShieldCheck } from "lucide-react"

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
  return "h-11 rounded-md border border-signal-line bg-signal-surface px-3 text-sm text-signal-ink outline-none transition placeholder:text-signal-muted/70 focus:border-signal-cyan focus:ring-2 focus:ring-signal-cyan/15"
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
        "rounded-md border px-3 py-2 text-sm",
        status.tone === "error" && "border-red-400/30 bg-red-500/10 text-red-200",
        status.tone === "success" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
        status.tone === "neutral" && "border-signal-line bg-signal-surface text-signal-muted",
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
    <label className="grid gap-1.5 text-sm font-medium text-signal-ink">
      {label}
      {children}
      {error && <span className="text-xs font-medium text-red-600">{error}</span>}
    </label>
  )
}

export function AuthPage({ mode }: { mode: AuthMode }) {
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
        router.push("/workspace")
        return
      }

      await apiRequest<{ user: AuthUserDTO }>("/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email: values.email, password: values.password }),
      })
      router.push("/workspace")
    } catch (error) {
      const apiFieldErrors = fieldErrorFromError(error)
      if (apiFieldErrors) setFieldErrors(apiFieldErrors)
      else setStatus(statusFromError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="h-dvh overflow-y-auto bg-signal-carbon px-4 py-4 text-signal-panel-text md:px-6 lg:px-8">
      <div className="mx-auto grid min-h-full w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_440px]">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-signal-panel p-5 md:p-8">
          <div className="absolute bottom-0 left-10 top-24 w-px bg-signal-amber/35" aria-hidden="true" />
          <div className="relative flex h-full min-h-[520px] flex-col justify-between gap-10">
            <div>
              <Link className="inline-flex w-32" href="/" aria-label="Relay home">
                <BrandLogo priority />
              </Link>

              <div className="mt-12 max-w-2xl">
                <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-signal-cyan">
                  {isSignup ? <ShieldCheck className="size-3.5" aria-hidden="true" /> : <RadioTower className="size-3.5" aria-hidden="true" />}
                  {isSignup ? "New workspace access" : "Authenticated workspace entry"}
                </div>
                <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.94] tracking-[-0.035em] md:text-7xl">
                  {isSignup ? "Start with the right access." : "Pick up the signal."}
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-signal-panel-muted">
                  {isSignup
                    ? "Create your account and continue directly into workspace setup to create a team space or accept an invitation."
                    : "Log in to continue to workspace setup, channel navigation, direct messages, and the realtime Relay shell."}
                </p>
              </div>
            </div>

            <div className="relative ml-5 grid gap-3 border-t border-white/10 pt-5 text-sm text-signal-panel-muted md:grid-cols-3">
              <p><span className="mb-2 flex size-7 items-center justify-center rounded-md bg-signal-amber text-signal-carbon"><LockKeyhole className="size-4" aria-hidden="true" /></span><span className="block font-semibold text-signal-panel-text">Session</span>HTTP cookies carry authenticated access.</p>
              <p><span className="mb-2 flex size-7 items-center justify-center rounded-md border border-signal-cyan/40 text-signal-cyan"><ShieldCheck className="size-4" aria-hidden="true" /></span><span className="block font-semibold text-signal-panel-text">Membership</span>Workspace actions stay server-authorized.</p>
              <p><span className="mb-2 flex size-7 items-center justify-center rounded-md border border-signal-cyan/40 text-signal-cyan"><RadioTower className="size-4" aria-hidden="true" /></span><span className="block font-semibold text-signal-panel-text">Realtime</span>Socket context follows signed-in users.</p>
            </div>
          </div>
        </section>

        <section className="grid content-center rounded-2xl border border-signal-line bg-signal-paper p-3 text-signal-ink shadow-2xl md:p-5">
          <div className="rounded-xl border border-signal-line bg-signal-surface p-5 md:p-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.02em]">{isSignup ? "Create account" : "Log in"}</h2>
                <p className="mt-2 text-sm leading-6 text-signal-muted">
                  {isSignup ? "Already have access?" : "Need an account?"} {" "}
                  <Link className="font-semibold text-signal-cyan-ink underline" href={isSignup ? "/login" : "/signup"}>
                    {isSignup ? "Log in instead" : "Create one"}
                  </Link>
                </p>
              </div>
              <span className="block size-10"><BrandLogo mark="icon" /></span>
            </div>

            <form className="mt-5 grid gap-4" noValidate onSubmit={handleSubmit}>
              {isSignup && <Field error={fieldErrors.name} label="Name"><input aria-invalid={Boolean(fieldErrors.name)} className={inputClass()} name="name" placeholder="Mina Chen" /></Field>}
              <Field error={fieldErrors.email} label="Email"><input aria-invalid={Boolean(fieldErrors.email)} className={inputClass()} inputMode="email" name="email" placeholder="you@team.com" /></Field>
              <Field error={fieldErrors.password} label="Password">
                <div className="relative">
                  <input
                    aria-invalid={Boolean(fieldErrors.password)}
                    className={cn(inputClass(), "w-full pr-11")}
                    name="password"
                    placeholder={isSignup ? `At least ${PASSWORD_MIN_LENGTH} characters` : "Your password"}
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-signal-muted transition hover:bg-signal-surface-raised hover:text-signal-ink focus:outline-none focus:ring-2 focus:ring-signal-cyan/25"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                </div>
              </Field>
              <StatusMessage status={status} />
              <Button className="mt-1 h-10" disabled={isSubmitting} type="submit">
                {isSignup ? "Create account" : "Enter workspace"}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-signal-line bg-signal-surface-raised p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-signal-cyan" aria-hidden="true" />What happens next</div>
              <p className="mt-2 text-sm leading-6 text-signal-muted">
                {isSignup
                  ? "Successful signup routes you to workspace setup, where you can create a workspace or enter an existing one."
                  : "Successful login routes you to workspace setup, where you can create a workspace or enter an existing one."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
