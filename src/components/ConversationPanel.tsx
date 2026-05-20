"use client";

import { useState, useEffect, useRef } from "react";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";

interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
}

interface Props {
  conversation: Conversation;
  onModeChange: (id: number, mode: "AI" | "HUMAN") => void;
  onDelete: (id: number) => void;
}

export default function ConversationPanel({ conversation, onModeChange, onDelete }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"AI" | "HUMAN">(conversation.mode);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMode(conversation.mode);
    fetchMessages();
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchMessages() {
    const res = await fetch(`/api/messages/${conversation.id}`);
    if (res.ok) setMessages(await res.json());
  }

  // Polling cada 2 segundos
  useEffect(() => {
    const t = setInterval(fetchMessages, 2_000);
    return () => clearInterval(t);
  }, [conversation.id]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    await fetch(`/api/messages/${conversation.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setDraft("");
    setSending(false);
    await fetchMessages();
  }

  async function handleDelete() {
    if (!confirm(`¿Borrar la conversación con ${conversation.name ?? conversation.phone}? Esta acción no se puede deshacer.`))
      return;
    await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    onDelete(conversation.id);
  }

  function handleModeChange(newMode: "AI" | "HUMAN") {
    setMode(newMode);
    onModeChange(conversation.id, newMode);
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* Header del panel */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 bg-gray-900 flex-shrink-0">
        <div>
          <p className="font-semibold text-sm">{conversation.name ?? conversation.phone}</p>
          <p className="text-xs text-gray-500">{conversation.phone}</p>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle
            conversationId={conversation.id}
            mode={mode}
            onChange={handleModeChange}
          />
          <button
            onClick={handleDelete}
            className="text-xs px-3 py-1 rounded-lg border border-gray-700 text-red-400 hover:bg-red-950 hover:border-red-800 transition-colors"
          >
            Borrar
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
        {messages.length === 0 && (
          <p className="text-gray-600 text-sm text-center mt-10">Sin mensajes aún.</p>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            createdAt={m.created_at}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-gray-800 p-4 bg-gray-900">
        {mode === "AI" ? (
          <p className="text-xs text-gray-500 text-center py-2">
            El bot responde automáticamente en modo IA.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Escribe un mensaje como humano..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors"
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
