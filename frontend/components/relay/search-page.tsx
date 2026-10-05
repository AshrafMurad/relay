"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Search } from "lucide-react"

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
    <main className="min-h-0 overflow-y-auto bg-signal-paper p-5 lg:col-start-3">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-lg font-semibold">Search messages</h1>
        <form className="mt-4 flex gap-2" onSubmit={submit}>
          <label className="sr-only" htmlFor="message-search">Search query</label>
          <input className="min-h-10 flex-1 rounded-md border border-signal-line bg-signal-surface px-3 text-sm outline-none focus:border-signal-cyan" id="message-search" minLength={2} onChange={(event) => setQuery(event.target.value)} placeholder="Find a message" value={query} />
          <Button disabled={loading || !workspace || query.trim().length < 2} type="submit"><Search /> {loading ? "Searching" : "Search"}</Button>
        </form>
        {error && <p className="mt-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{error}</p>}
        <div className="mt-5 space-y-3">
          {results.map((message) => (
            <article className="rounded-lg border border-signal-line bg-signal-surface p-3" key={message.id}>
              <Link className="text-xs font-semibold text-signal-cyan hover:underline" href={resultHref(workspaceSlug, message)}>{message.author.name}</Link>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              {message.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{message.attachments.map((attachment) => <a className="text-xs text-signal-muted underline" href={`${API_BASE_URL}${attachment.downloadUrl}`} key={attachment.id}>{attachment.originalFilename}</a>)}</div>}
              <time className="mt-2 block font-mono text-[10px] text-signal-muted" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
            </article>
          ))}
          {!loading && query && results.length === 0 && !error && <p className="text-sm text-signal-muted">No matching messages.</p>}
        </div>
      </div>
    </main>
  )
}
