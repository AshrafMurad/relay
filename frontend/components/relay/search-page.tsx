"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { Paperclip, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { API_BASE_URL, apiRequest } from "@/lib/api/client"
import type { MessageDTO, SearchMessagesResponse, WorkspaceDTO } from "@/lib/api/contracts"
import { useErrorTranslator } from "@/lib/i18n/errors"

function resultHref(workspaceSlug: string, message: MessageDTO) {
  return message.channelId ? `/app/${workspaceSlug}/channels/${message.channelId}` : `/app/${workspaceSlug}/dm/${message.directConversationId}`
}

export function SearchPage({ workspaceSlug }: { workspaceSlug: string }) {
  const errors = useErrorTranslator()
  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [query, setQuery] = useState("")
  const [queryError, setQueryError] = useState("")
  const [results, setResults] = useState<MessageDTO[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void apiRequest<{ workspaces: WorkspaceDTO[] }>("/workspaces")
      .then(({ workspaces }) => setWorkspace(workspaces.find((item) => item.slug === workspaceSlug) ?? null))
      .catch((caught) => setError(errors.apiError(caught)))
  }, [errors, workspaceSlug])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!workspace) return
    if (query.trim().length < 2) {
      setQueryError(errors.field("searchMin"))
      return
    }
    setLoading(true)
    setError("")
    setQueryError("")
    try {
      const response = await apiRequest<SearchMessagesResponse>(`/search?workspaceId=${workspace.id}&q=${encodeURIComponent(query.trim())}`)
      setResults(response.results)
    } catch (caught) {
      const message = errors.apiError(caught)
      setError(message)
      toast.error(errors.toastTitle("searchFailed"), { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form className="flex shrink-0 flex-col gap-2 border-b border-signal-line p-4 sm:flex-row" noValidate onSubmit={submit}>
        <label className="sr-only" htmlFor="message-search">Search query</label>
        <div className="flex-1">
          <Input aria-describedby={queryError ? "message-search-error" : undefined} aria-invalid={Boolean(queryError)} autoFocus id="message-search" onChange={(event) => { setQuery(event.target.value); setQueryError("") }} placeholder="Search saved messages" value={query} />
          {queryError && <p className="text-helper mt-1.5 font-semibold text-destructive" id="message-search-error">{queryError}</p>}
        </div>
        <Button className="sm:w-auto" disabled={loading || !workspace} type="submit">{loading ? <Spinner /> : <Search />} {loading ? "Searching" : "Search"}</Button>
      </form>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && <p className="mb-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{error}</p>}
        <div className="space-y-2">
          {loading && <p className="inline-flex items-center gap-2 rounded-md border border-signal-line bg-signal-surface px-3 py-2 text-xs text-signal-muted" role="status"><Spinner className="size-3.5 text-signal-cyan" />Searching saved history...</p>}
          {results.map((message) => (
            <article className="rounded-md border border-signal-line bg-signal-surface p-3 transition-colors hover:border-signal-cyan/50" key={message.id}>
              <div className="flex items-baseline gap-2">
                <Link className="text-xs font-semibold text-signal-cyan-ink underline-offset-4 hover:underline" href={resultHref(workspaceSlug, message)}>{message.author.name}</Link>
                <time className="text-metadata text-signal-muted" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
              </div>
              <p className="mt-1 max-w-[72ch] whitespace-pre-wrap text-sm leading-6">{message.content || "Attachment-only message"}</p>
              {message.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{message.attachments.map((attachment) => <a className="text-helper inline-flex items-center gap-1.5 rounded-full border border-signal-line bg-signal-paper px-2 py-1 text-signal-muted hover:border-signal-cyan hover:text-signal-ink" href={`${API_BASE_URL}${attachment.downloadUrl}`} key={attachment.id}><Paperclip className="size-3" />{attachment.originalFilename}</a>)}</div>}
            </article>
          ))}
          {!loading && !query && <div className="px-4 py-10 text-center"><Search className="mx-auto size-5 text-signal-muted" /><p className="mt-3 text-sm font-semibold">Search workspace history</p><p className="mt-1 text-xs text-signal-muted">Enter at least two characters to search messages you can access.</p></div>}
          {!loading && query && results.length === 0 && !error && <div className="rounded-md border border-dashed border-signal-line bg-signal-surface/45 px-4 py-8 text-center"><h2 className="text-sm font-semibold">No matching messages</h2><p className="mt-1 text-xs text-signal-muted">Try a different term or open a conversation from the sidebar.</p></div>}
        </div>
      </div>
    </div>
  )
}
