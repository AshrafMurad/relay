"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { apiRequest, ApiClientError } from "@/lib/api/client"
import type { AuthUserDTO } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "signup"
type Status = { tone: "neutral" | "success" | "error"; message: string } | null

function inputClass() {
  return "h-10 rounded-md border border-signal-line bg-signal-surface px-3 text-sm text-signal-ink outline-none transition focus:border-signal-cyan focus:ring-2 focus:ring-signal-cyan/15"
}

function statusFromError(error: unknown): Status {
  if (error instanceof ApiClientError) return { tone: "error", message: error.message }
  return { tone: "error", message: "Something went wrong." }
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-signal-ink">
      {label}
      {children}
    </label>
  )
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>(null)
  const isSignup = mode === "signup"

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      if (isSignup) {
        await apiRequest<{ user: AuthUserDTO }>("/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            email: form.get("email"),
            password: form.get("password"),
          }),
        })
        setStatus({ tone: "success", message: "Account created. You can sign in now." })
        return
      }

      await apiRequest<{ user: AuthUserDTO }>("/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      })
      router.push("/workspace")
    } catch (error) {
      setStatus(statusFromError(error))
    }
  }

  return (
    <main className="grid min-h-dvh overflow-y-auto bg-signal-carbon px-4 py-6 text-signal-panel-text md:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,0.9fr)_420px] lg:items-center">
        <section className="rounded-2xl border border-white/10 bg-signal-panel p-5 md:p-8">
          <Link className="inline-flex items-center gap-3" href="/">
            <span className="grid size-10 place-items-center rounded-lg bg-signal-amber text-sm font-bold text-signal-carbon">R</span>
            <span className="font-semibold">Relay</span>
          </Link>
          <h1 className="mt-10 max-w-[12ch] text-4xl font-semibold leading-none tracking-[-0.03em] md:text-6xl">
            {isSignup ? "Create your Relay access." : "Return to your workspace."}
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-6 text-signal-panel-muted md:text-base">
            {isSignup
              ? "Sign up, then enter the workspace setup screen to create or join a team."
              : "Log in to continue to workspace setup, channel navigation, and the authenticated Relay shell."}
          </p>
        </section>

        <section className="rounded-2xl border border-signal-line bg-signal-surface p-5 text-signal-ink shadow-2xl md:p-6">
          <div>
            <h2 className="text-xl font-semibold">{isSignup ? "Sign up" : "Log in"}</h2>
            <p className="mt-1 text-sm text-signal-muted">
              {isSignup ? "Already have access?" : "Need an account?"} {" "}
              <Link className="font-semibold text-signal-cyan-ink underline" href={isSignup ? "/login" : "/signup"}>
                {isSignup ? "Log in" : "Sign up"}
              </Link>
            </p>
          </div>

          <div className="mt-5"><StatusMessage status={status} /></div>

          <form className="mt-5 grid gap-3" onSubmit={handleSubmit}>
            {isSignup && <Field label="Name"><input className={inputClass()} name="name" required /></Field>}
            <Field label="Email"><input className={inputClass()} name="email" required type="email" /></Field>
            <Field label="Password"><input className={inputClass()} minLength={isSignup ? 12 : undefined} name="password" required type="password" /></Field>
            <Button type="submit">{isSignup ? "Create account" : "Log in"}</Button>
          </form>
        </section>
      </div>
    </main>
  )
}
