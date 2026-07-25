import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { MessageCircle, X, Send, Trash2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { askAssistant, clearAssistantThread } from "@/lib/api-client";

/**
 * Parse source references like [property:uuid] into links.
 */
function parseSourceLinks(text) {
  const parts = [];
  let lastIndex = 0;
  const regex = /\[(property|analysis|outcome|lesson|follow_up|vacancy):([a-f0-9-]+)\]/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: "source", entityType: match[1], id: match[2] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

function getEntityLink(entityType, id) {
  switch (entityType) {
    case "property": return `/workspace/properties/${id}`;
    case "analysis": return `/workspace/analyses/${id}`;
    default: return null;
  }
}

function MessageContent({ text }) {
  const parts = parseSourceLinks(text);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === "text") return <span key={i}>{part.value}</span>;
        const link = getEntityLink(part.entityType, part.id);
        if (link) {
          return (
            <a
              key={i}
              href={link}
              className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
            >
              {part.entityType}:{part.id.slice(0, 8)}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          );
        }
        return (
          <Badge key={i} variant="outline" className="text-[10px] mx-0.5 py-0">
            {part.entityType}:{part.id.slice(0, 8)}
          </Badge>
        );
      })}
    </span>
  );
}

export default function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const askMutation = useMutation({
    mutationFn: (question) => askAssistant(question, threadId),
    onSuccess: (data) => {
      setThreadId(data.thread_id);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
          tools: data.tools_used,
        },
      ]);
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}`, error: true },
      ]);
    },
  });

  const handleSend = () => {
    const q = input.trim();
    if (!q || askMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    askMutation.mutate(q);
  };

  const handleClear = async () => {
    if (threadId) {
      try { await clearAssistantThread(threadId); } catch { /* ignore */ }
    }
    setMessages([]);
    setThreadId(null);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Floating button when closed
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center"
        title="Ask TrafficScout Assistant"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] flex flex-col rounded-xl border border-border bg-background shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">TrafficScout Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleClear}
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setOpen(false)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Ask me about your properties, analyses, outcomes, or lessons.
            </p>
            <div className="mt-3 space-y-1">
              {[
                "What properties do we have?",
                "Any overdue follow-ups?",
                "How accurate were our predictions?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="block w-full text-xs text-left px-3 py-1.5 rounded-md border border-border hover:bg-muted/50 transition-colors"
                  onClick={() => {
                    setInput(suggestion);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "text-sm",
              msg.role === "user" ? "text-right" : "text-left",
            )}
          >
            <div
              className={cn(
                "inline-block max-w-[85%] rounded-lg px-3 py-2 text-left",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : msg.error
                    ? "bg-destructive/10 text-destructive border border-destructive/20"
                    : "bg-muted",
              )}
            >
              {msg.role === "assistant" ? (
                <div className="whitespace-pre-wrap text-sm">
                  <MessageContent text={msg.content} />
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
              {msg.tools?.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {msg.tools.map((tool, j) => (
                    <Badge key={j} variant="outline" className="text-[10px] py-0">
                      {tool}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {askMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Searching data...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-3 py-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data..."
            className="text-sm h-9"
            disabled={askMutation.isPending}
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            disabled={!input.trim() || askMutation.isPending}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
