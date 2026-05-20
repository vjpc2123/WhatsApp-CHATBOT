"use client";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface Props {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function relativeTime(unix: number | null): string {
  if (!unix) return "";
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

export default function ConversationList({ conversations, selectedId, onSelect }: Props) {
  return (
    <aside className="w-72 flex-shrink-0 border-r border-gray-800 flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Conversaciones
        </h2>
      </div>
      {conversations.length === 0 && (
        <p className="text-gray-500 text-sm p-4">Sin conversaciones aún.</p>
      )}
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors ${
            selectedId === c.id ? "bg-gray-800" : ""
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">
              {c.name ?? c.phone}
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                c.mode === "AI"
                  ? "bg-emerald-900 text-emerald-300"
                  : "bg-amber-900 text-amber-300"
              }`}
            >
              {c.mode}
            </span>
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-xs text-gray-500 truncate flex-1">
              {c.last_message_preview ?? c.phone}
            </p>
            <span className="text-[10px] text-gray-600 ml-2 flex-shrink-0">
              {relativeTime(c.last_message_at)}
            </span>
          </div>
        </button>
      ))}
    </aside>
  );
}
