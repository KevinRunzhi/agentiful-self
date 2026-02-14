"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "../../../../../components/ui/Button";
import { Card, CardContent } from "../../../../../components/ui/Card";
import { Input } from "../../../../../components/ui/Input";

type ConversationStatus = "active" | "archived" | "deleted";
type MessageRole = "user" | "assistant" | "system" | "tool";

interface ConversationItem {
  id: string;
  title: string | null;
  status: ConversationStatus;
  pinned: boolean;
  appId: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string | null;
  contentParts?: {
    parts?: Array<
      | { type: "text"; text: string }
      | { type: "artifact"; artifactId: string; title?: string }
      | {
          type: "hitl";
          hitl: {
            action: "confirm" | "select" | "approve" | "input";
            title: string;
            description?: string;
            options?: Array<{ id: string; label: string }>;
            required: boolean;
          };
        }
    >;
  };
  createdAt: string;
}

interface ArtifactItem {
  id: string;
  title: string;
  type: string;
  version: number;
  isDraft: boolean;
}

interface UploadAttachment {
  id: string;
  fileName: string;
  downloadUrl: string;
  previewUrl: string;
}

interface SseEvent {
  event: string;
  data: string;
}

function parseSseBlock(raw: string): SseEvent | null {
  const lines = raw.split("\n");
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  return {
    event,
    data: dataLines.join("\n"),
  };
}

async function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const encoded = result.includes(",") ? result.split(",")[1] : result;
      resolve(encoded);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function requestJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || "Request failed");
  }
  if (payload.data === undefined) {
    throw new Error("Invalid response");
  }
  return payload.data;
}

function formatConversationTitle(item: ConversationItem): string {
  const title = item.title?.trim();
  if (title) {
    return title;
  }
  return "新对话";
}

function renderTextWithLatex(content: string) {
  const chunks = content.split(/(\$\$[\s\S]+?\$\$)/g);
  return chunks.map((chunk, index) => {
    if (chunk.startsWith("$$") && chunk.endsWith("$$")) {
      const latex = chunk.slice(2, -2);
      return (
        <span
          key={`${chunk}-${index}`}
          className="rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700"
        >
          {latex}
        </span>
      );
    }
    return (
      <span key={`${chunk}-${index}`} className="whitespace-pre-wrap">
        {chunk}
      </span>
    );
  });
}

export default function AppChatPage() {
  const params = useParams<{ appId: string }>();
  const router = useRouter();
  const appId = params.appId;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [attachments, setAttachments] = useState<UploadAttachment[]>([]);
  const [pendingAttachmentIds, setPendingAttachmentIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamAbortRef = useRef<AbortController | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );

  const filteredConversations = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return conversations;
    }
    return conversations.filter((item) =>
      formatConversationTitle(item).toLowerCase().includes(keyword)
    );
  }, [conversations, search]);

  const loadArtifacts = useCallback(
    async (conversationId: string) => {
      try {
        const data = await requestJson<ArtifactItem[]>(
          `/api/v1/conversations/${conversationId}/artifacts`
        );
        setArtifacts(data);
      } catch {
        setArtifacts([]);
      }
    },
    []
  );

  const loadMessages = useCallback(
    async (conversationId: string) => {
      const data = await requestJson<ChatMessage[]>(
        `/api/v1/conversations/${conversationId}/messages`
      );
      setMessages(data);
      await loadArtifacts(conversationId);
    },
    [loadArtifacts]
  );

  const loadConversations = useCallback(async () => {
    const payload = await requestJson<{
      items: ConversationItem[];
      nextCursor: string | null;
    }>(`/api/v1/conversations?limit=50`);

    const sorted = [...payload.items].sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    setConversations(sorted);
    return sorted;
  }, []);

  const createConversation = useCallback(async () => {
    const created = await requestJson<ConversationItem>("/api/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId,
      }),
    });
    const nextConversations = [created, ...conversations];
    setConversations(nextConversations);
    setActiveConversationId(created.id);
    setMessages([]);
    setArtifacts([]);
    setAttachments([]);
    setPendingAttachmentIds([]);
    setSuggestions([]);
    return created;
  }, [appId, conversations]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const loaded = await loadConversations();
        if (!mounted) {
          return;
        }
        const sameAppConversation = loaded.find((item) => item.appId === appId);
        if (sameAppConversation) {
          setActiveConversationId(sameAppConversation.id);
          await loadMessages(sameAppConversation.id);
        } else {
          const created = await createConversation();
          await loadMessages(created.id);
        }
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      streamAbortRef.current?.abort();
    };
  }, [appId, createConversation, loadConversations, loadMessages]);

  const handleSelectConversation = useCallback(
    async (conversationId: string) => {
      setActiveConversationId(conversationId);
      setShareUrl(null);
      setSuggestions([]);
      setAttachments([]);
      setPendingAttachmentIds([]);
      await loadMessages(conversationId);
    },
    [loadMessages]
  );

  const mutateConversation = useCallback(
    async (
      conversationId: string,
      body: Partial<Pick<ConversationItem, "title" | "pinned" | "status">>
    ) => {
      await requestJson<ConversationItem>(`/api/v1/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const loaded = await loadConversations();
      if (!loaded.find((item) => item.id === activeConversationId)) {
        setActiveConversationId(loaded[0]?.id ?? null);
      }
    },
    [activeConversationId, loadConversations]
  );

  const stopGeneration = useCallback(async () => {
    if (!activeConversationId || !streamingMessageId) {
      return;
    }
    streamAbortRef.current?.abort();
    setIsStreaming(false);
    setStreamingMessageId(null);
    try {
      await requestJson<{ result: string; stop_type: "hard" | "soft" }>(
        `/api/v1/conversations/${activeConversationId}/messages/${streamingMessageId}/stop`,
        { method: "POST" }
      );
    } catch {
      // Keep UI responsive even if stop endpoint fails.
    }
  }, [activeConversationId, streamingMessageId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId || !content.trim() || isStreaming) {
        return;
      }

      const userText = content.trim();
      const tempUserMessage: ChatMessage = {
        id: `temp-user-${Date.now()}`,
        role: "user",
        content: userText,
        createdAt: new Date().toISOString(),
      };
      const tempAssistantId = `temp-assistant-${Date.now()}`;
      const tempAssistant: ChatMessage = {
        id: tempAssistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, tempUserMessage, tempAssistant]);
      setInput("");
      setError(null);
      setSuggestions([]);
      setIsStreaming(true);
      setStreamingMessageId(tempAssistantId);

      const controller = new AbortController();
      streamAbortRef.current = controller;

      try {
        const response = await fetch(
          `/api/v1/conversations/${activeConversationId}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: userText,
              stream: true,
              attachmentIds: pendingAttachmentIds,
            }),
            signal: controller.signal,
          }
        );

        if (!response.ok || !response.body) {
          throw new Error("Failed to send message");
        }

        setPendingAttachmentIds([]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let resolvedAssistantId = tempAssistantId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          let boundaryIndex = buffer.indexOf("\n\n");
          while (boundaryIndex !== -1) {
            const rawBlock = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            boundaryIndex = buffer.indexOf("\n\n");

            const parsed = parseSseBlock(rawBlock);
            if (!parsed) {
              continue;
            }
            if (parsed.data === "[DONE]") {
              continue;
            }

            if (parsed.event === "agentif.metadata") {
              const payload = JSON.parse(parsed.data) as { messageId?: string };
              if (payload.messageId) {
                const nextId = payload.messageId;
                setMessages((prev) =>
                  prev.map((item) =>
                    item.id === resolvedAssistantId ? { ...item, id: nextId } : item
                  )
                );
                resolvedAssistantId = nextId;
                setStreamingMessageId(nextId);
              }
              continue;
            }

            if (parsed.event === "message.delta") {
              const payload = JSON.parse(parsed.data) as { chunk?: string };
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === resolvedAssistantId
                    ? { ...item, content: `${item.content ?? ""}${payload.chunk ?? ""}` }
                    : item
                )
              );
              continue;
            }

            if (parsed.event === "agentif.suggestions") {
              const payload = JSON.parse(parsed.data) as { suggestions?: string[] };
              setSuggestions(payload.suggestions ?? []);
              continue;
            }

            if (parsed.event === "message.done") {
              const payload = JSON.parse(parsed.data) as { content?: string };
              if (typeof payload.content === "string") {
                setMessages((prev) =>
                  prev.map((item) =>
                    item.id === resolvedAssistantId
                      ? {
                          ...item,
                          content: payload.content,
                        }
                      : item
                  )
                );
              }
            }
          }
        }

        await loadConversations();
        await loadArtifacts(activeConversationId);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Send message failed");
        }
      } finally {
        setIsStreaming(false);
        setStreamingMessageId(null);
      }
    },
    [activeConversationId, isStreaming, loadArtifacts, loadConversations, pendingAttachmentIds]
  );

  const handleUploadFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || !activeConversationId) {
        return;
      }
      const files = Array.from(fileList);
      const encodedFiles = await Promise.all(
        files.map(async (file) => ({
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          contentBase64: await toBase64(file),
        }))
      );

      const uploaded = await requestJson<UploadAttachment[]>(
        `/api/v1/conversations/${activeConversationId}/files`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: encodedFiles }),
        }
      );

      setAttachments((prev) => [...prev, ...uploaded]);
      setPendingAttachmentIds((prev) => [
        ...prev,
        ...uploaded.map((item) => item.id),
      ]);
    },
    [activeConversationId]
  );

  const createShareLink = useCallback(async () => {
    if (!activeConversationId) {
      return;
    }
    const payload = await requestJson<{ shareUrl: string }>(
      `/api/v1/conversations/${activeConversationId}/share`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireLogin: true }),
      }
    );
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    setShareUrl(`${baseUrl}${payload.shareUrl}`);
  }, [activeConversationId]);

  const submitHitl = useCallback(
    async (
      messageId: string,
      action: "confirm" | "select" | "approve" | "input",
      value: string | string[] | boolean
    ) => {
      if (!activeConversationId) {
        return;
      }
      await requestJson<ChatMessage>(
        `/api/v1/conversations/${activeConversationId}/messages/${messageId}/hitl-response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, value }),
        }
      );
      await loadMessages(activeConversationId);
    },
    [activeConversationId, loadMessages]
  );

  const sendFeedback = useCallback(
    async (messageId: string, rating: "like" | "dislike") => {
      await requestJson<unknown>(`/api/v1/messages/${messageId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
    },
    []
  );

  const copyMessage = useCallback(async (content: string | null) => {
    if (!content) {
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // Clipboard may be blocked by browser permission.
    }
  }, []);

  const editAndResend = useCallback(
    async (messageId: string, currentContent: string | null) => {
      if (!activeConversationId) {
        return;
      }
      const nextContent = window.prompt("Edit and resend", currentContent ?? "");
      if (nextContent === null || !nextContent.trim()) {
        return;
      }
      await requestJson<unknown>(
        `/api/v1/conversations/${activeConversationId}/messages/${messageId}/edit-resend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: nextContent.trim() }),
        }
      );
      await loadMessages(activeConversationId);
      await loadConversations();
    },
    [activeConversationId, loadConversations, loadMessages]
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (!activeConversationId) {
        return;
      }
      await requestJson<unknown>(
        `/api/v1/conversations/${activeConversationId}/messages/${messageId}/regenerate`,
        {
          method: "POST",
        }
      );
      await loadMessages(activeConversationId);
      await loadConversations();
    },
    [activeConversationId, loadConversations, loadMessages]
  );

  if (isLoading) {
    return (
      <main className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading chat workspace...
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="space-y-4 p-4 md:p-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Conversation Workspace</h1>
          <p className="text-sm text-muted-foreground">
            App: <span className="font-mono">{appId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/apps")}>
            Back to Apps
          </Button>
          <Button onClick={() => void createConversation()}>New Conversation</Button>
        </div>
      </section>

      {error ? (
        <section className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="space-y-2">
              {filteredConversations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleSelectConversation(item.id)}
                  className={`w-full rounded border p-2 text-left text-sm ${
                    item.id === activeConversationId ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{formatConversationTitle(item)}</span>
                    {item.pinned ? <span className="text-xs text-primary">Pinned</span> : null}
                  </div>
                  <div className="mt-2 flex gap-1 text-xs">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        void mutateConversation(item.id, { pinned: !item.pinned });
                      }}
                    >
                      {item.pinned ? "Unpin" : "Pin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        const title = window.prompt("Rename conversation", item.title ?? "");
                        if (title !== null) {
                          void mutateConversation(item.id, { title });
                        }
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        void mutateConversation(item.id, {
                          status: item.status === "archived" ? "active" : "archived",
                        });
                      }}
                    >
                      {item.status === "archived" ? "Unarchive" : "Archive"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(event) => {
                        event.stopPropagation();
                        void requestJson<unknown>(`/api/v1/conversations/${item.id}`, {
                          method: "DELETE",
                        }).then(async () => {
                          const loaded = await loadConversations();
                          const fallbackId = loaded.find((entry) => entry.appId === appId)?.id ?? loaded[0]?.id ?? null;
                          setActiveConversationId(fallbackId);
                          if (fallbackId) {
                            await loadMessages(fallbackId);
                          } else {
                            setMessages([]);
                          }
                        });
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">
                {activeConversation ? formatConversationTitle(activeConversation) : "No conversation"}
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void createShareLink()}>
                  Share
                </Button>
                <Button
                  variant="destructive"
                  disabled={!isStreaming}
                  onClick={() => void stopGeneration()}
                >
                  Stop
                </Button>
              </div>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded border bg-slate-50/50 p-3">
              {messages.map((item) => {
                const hitlPart = item.contentParts?.parts?.find((part) => part.type === "hitl");
                return (
                  <div
                    key={item.id}
                    className={`rounded p-3 text-sm ${
                      item.role === "assistant" ? "bg-white" : "bg-slate-100"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.role}</span>
                      {item.role === "assistant" ? (
                        <span className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copyMessage(item.content)}
                          >
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void regenerateMessage(item.id)}
                          >
                            Regenerate
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void sendFeedback(item.id, "like")}>
                            Like
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void sendFeedback(item.id, "dislike")}>
                            Dislike
                          </Button>
                        </span>
                      ) : (
                        <span className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void copyMessage(item.content)}
                          >
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void editAndResend(item.id, item.content)}
                          >
                            Edit Resend
                          </Button>
                        </span>
                      )}
                    </div>
                    <div>{renderTextWithLatex(item.content ?? "")}</div>
                    {hitlPart && hitlPart.type === "hitl" ? (
                      <div className="mt-3 rounded border bg-amber-50 p-3">
                        <p className="font-medium">{hitlPart.hitl.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {hitlPart.hitl.description ?? "Please respond to continue"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(hitlPart.hitl.options ?? []).map((option) => (
                            <Button
                              key={option.id}
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void submitHitl(item.id, hitlPart.hitl.action, option.id)
                              }
                            >
                              {option.label}
                            </Button>
                          ))}
                          {(hitlPart.hitl.options ?? []).length === 0 ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void submitHitl(item.id, hitlPart.hitl.action, true)}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void submitHitl(item.id, hitlPart.hitl.action, false)}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    size="sm"
                    variant="outline"
                    onClick={() => setInput(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your message..."
                className="min-h-28 w-full rounded border bg-background p-3 text-sm"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="text-xs text-muted-foreground">
                  <input
                    type="file"
                    multiple
                    className="block text-xs"
                    onChange={(event) => void handleUploadFiles(event.target.files)}
                  />
                </label>
                <Button disabled={!input.trim() || isStreaming} onClick={() => void sendMessage(input)}>
                  {isStreaming ? "Streaming..." : "Send"}
                </Button>
              </div>
              {attachments.length > 0 ? (
                <div className="rounded border bg-white p-2 text-xs">
                  <p className="font-medium">Uploaded files</p>
                  <ul className="mt-1 space-y-1">
                    {attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <a
                          href={attachment.downloadUrl}
                          className="text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {attachment.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-4">
            <section className="space-y-2">
              <h3 className="font-medium">Share</h3>
              {shareUrl ? (
                <p className="break-all rounded border bg-slate-50 p-2 text-xs">{shareUrl}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Create a read-only share link.</p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="font-medium">Artifacts</h3>
              <div className="space-y-2 text-sm">
                {artifacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No artifacts yet.</p>
                ) : (
                  artifacts.map((item) => (
                    <div key={item.id} className="rounded border bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate">{item.title}</p>
                        <span className="text-xs text-muted-foreground">
                          v{item.version}
                          {item.isDraft ? " draft" : ""}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        {item.isDraft ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              await requestJson<ArtifactItem>(`/api/v1/artifacts/${item.id}/save`, {
                                method: "POST",
                              });
                              if (activeConversationId) {
                                await loadArtifacts(activeConversationId);
                              }
                            }}
                          >
                            Save Version
                          </Button>
                        ) : null}
                        <a
                          href={`/api/v1/artifacts/${item.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
