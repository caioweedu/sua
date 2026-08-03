"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ProfessorChat({ trilhaId }: { trilhaId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/professor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trilhaId, messages: next }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Erro inesperado.");
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${errText}` };
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
        scrollToBottom();
      }
    } catch {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "⚠️ Não consegui responder agora. Tente novamente.",
        };
        return copy;
      });
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-brand fixed bottom-6 right-6 shadow-lg"
      >
        🤖 Professor Virtual
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[70vh] max-h-[560px] w-[min(92vw,400px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ background: "var(--brand-color)", color: "var(--brand-fg)" }}
      >
        <span className="font-semibold">🤖 Professor Virtual</span>
        <button onClick={() => setOpen(false)} aria-label="Fechar" className="opacity-80 hover:opacity-100">
          ✕
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Olá! Sou o professor desta trilha. Tire suas dúvidas sobre o conteúdo. 😊
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-slate-100 text-slate-800"
                : "bg-slate-50 text-slate-700"
            }`}
          >
            {m.content || (busy ? "…" : "")}
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Pergunte algo sobre a trilha..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={busy}
          />
          <button className="btn-brand" onClick={send} disabled={busy || !input.trim()}>
            {busy ? "..." : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
