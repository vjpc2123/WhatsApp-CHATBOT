"use client";

interface Props {
  conversationId: number;
  mode: "AI" | "HUMAN";
  onChange: (mode: "AI" | "HUMAN") => void;
}

export default function ModeToggle({ conversationId, mode, onChange }: Props) {
  async function toggle() {
    const next = mode === "AI" ? "HUMAN" : "AI";
    await fetch(`/api/mode/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    onChange(next);
  }

  return (
    <button
      onClick={toggle}
      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
        mode === "AI"
          ? "bg-emerald-700 text-emerald-100 hover:bg-emerald-600"
          : "bg-amber-700 text-amber-100 hover:bg-amber-600"
      }`}
    >
      {mode === "AI" ? "Modo IA" : "Modo Humano"}
    </button>
  );
}
