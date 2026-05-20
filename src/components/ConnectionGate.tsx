"use client";

import { useEffect, useState } from "react";
import QRScreen from "./QRScreen";
import DashboardHeader from "./DashboardHeader";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

type AppState = "loading" | "disconnected" | "connected";

export default function ConnectionGate() {
  const [appState, setAppState] = useState<AppState>("loading");
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Verificación inicial del estado de conexión
  useEffect(() => {
    checkConnection();
  }, []);

  // Polling de conversaciones cuando está conectado
  useEffect(() => {
    if (appState !== "connected") return;
    fetchConversations();
    const t = setInterval(fetchConversations, 2_000);
    return () => clearInterval(t);
  }, [appState]);

  async function checkConnection() {
    try {
      const res = await fetch("/api/connection/status");
      if (!res.ok) { setAppState("disconnected"); return; }
      const json = await res.json();
      if (json.status === "connected" && json.phone) {
        setConnectedPhone(json.phone);
        setAppState("connected");
      } else {
        setAppState("disconnected");
      }
    } catch {
      setAppState("disconnected");
    }
  }

  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) setConversations(await res.json());
    } catch {}
  }

  function handleConnected(phone: string) {
    setConnectedPhone(phone);
    setAppState("connected");
  }

  function handleDisconnected() {
    setConnectedPhone(null);
    setSelectedId(null);
    setConversations([]);
    setAppState("disconnected");
  }

  function handleModeChange(id: number, mode: "AI" | "HUMAN") {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, mode } : c))
    );
  }

  function handleDelete(id: number) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  if (appState === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="w-10 h-10 rounded-full border-4 border-gray-700 border-t-gray-400 animate-spin" />
      </div>
    );
  }

  if (appState === "disconnected") {
    return <QRScreen onConnected={handleConnected} />;
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <DashboardHeader phone={connectedPhone!} onDisconnect={handleDisconnected} />
      <div className="flex flex-1 min-h-0">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <main className="flex-1 flex min-w-0">
          {selected ? (
            <ConversationPanel
              conversation={selected}
              onModeChange={handleModeChange}
              onDelete={handleDelete}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-600 text-sm">
                {conversations.length === 0
                  ? "Las conversaciones aparecerán aquí cuando lleguen mensajes."
                  : "Selecciona una conversación para ver los mensajes."}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
