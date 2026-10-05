"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Paperclip, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { API_BASE_URL, apiRequest } from "@/lib/api/client"
import type { MessageDTO, SearchMessagesResponse, WorkspaceDTO } from "@/lib/api/contracts"

function resultHref(workspaceSlug: string, message: MessageDTO) {
  return message.channelId ? `/app/${workspaceSlug}/channels/${message.channelId}` : `/app/${workspaceSlug}/dm/${message.directConversationId}`
}

export function SearchPage({ workspaceSlug }: { workspaceSlug: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MessageDTO[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void apiRequest<{ workspaces: WorkspaceDTO[] }>("/workspaces")
      .then(({ workspaces }) => setWorkspace(workspaces.find((item) => item.slug === workspaceSlug) ?? null))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Workspace could not be loaded."))
  }, [workspaceSlug])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!workspace || query.trim().length < 2) return
    setLoading(true)
    setError("")
    try {
      const response = await apiRequest<SearchMessagesResponse>(`/search?workspaceId=${workspace.id}&q=${encodeURIComponent(query.trim())}`)
      setResults(response.results)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-0 overflow-y-auto bg-signal-paper p-4 sm:p-6 lg:col-start-3">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-lg border border-signal-line bg-signal-surface/55 p-4 sm:p-5">
          <h1 className="text-base font-semibold">Search messages</h1>
          <p className="mt-1 text-xs leading-5 text-signal-muted">Search non-deleted message text in conversations you can access.</p>
          <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
            <label className="sr-only" htmlFor="message-search">Search query</label>
            <input className="min-h-10 flex-1 rounded-md border border-signal-line bg-signal-paper px-3 text-sm outline-none transition focus:border-signal-cyan focus:ring-2 focus:ring-signal-cyan/15" id="message-search" minLength={2} onChange={(event) => setQuery(event.target.value)} placeholder="Find a message" value={query} />
            <Button className="sm:w-auto" disabled={loading || !workspace || query.trim().length < 2} type="submit"><Search /> {loading ? "Searching" : "Search"}</Button>
          </form>
        </div>
        {error && <p className="mt-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{error}</p>}
        <div className="mt-5 space-y-2">
          {loading && <p className="rounded-md border border-signal-line bg-signal-surface px-3 py-2 text-xs text-signal-muted" role="status">Searching saved history...</p>}
          {results.map((message) => (
            <article className="rounded-lg border border-signal-line bg-signal-surface p-3 transition-colors hover:border-signal-cyan/50" key={message.id}>
              <div className="flex items-baseline gap-2">
                <Link className="text-xs font-semibold text-signal-cyan-ink underline-offset-4 hover:underline" href={resultHref(workspaceSlug, message)}>{message.author.name}</Link>
                <time className="font-mono text-[9px] tabular-nums text-signal-muted" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 max-w-[72ch] whitespace-pre-wrap text-sm leading-6">{message.content || "Attachment-only message"}</p>
              {message.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{message.attachments.map((attachment) => <a className="inline-flex items-center gap-1.5 rounded-full border border-signal-line bg-signal-paper px-2 py-1 text-[11px] text-signal-muted hover:border-signal-cyan hover:text-signal-ink" href={`${API_BASE_URL}${attachment.downloadUrl}`} key={attachment.id}><Paperclip className="size-3" />{attachment.originalFilename}</a>)}</div>}
            </article>
          ))}
          {!loading && query && results.length === 0 && !error && <div className="rounded-lg border border-dashed border-signal-line bg-signal-surface/45 px-4 py-8 text-center"><h2 className="text-sm font-semibold">No matching messages</h2><p className="mt-1 text-xs text-signal-muted">Try a different term or open a conversation from the sidebar.</p></div>}
        </div>
      </div>
    </main>
  )
}
