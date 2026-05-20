"use client";

interface Props {
  phone: string;
  onDisconnect: () => void;
}

export default function DashboardHeader({ phone, onDisconnect }: Props) {
  async function handleDisconnect() {
    if (!confirm("¿Desconectar el número? Tendrás que escanear el QR nuevamente.")) return;
    await fetch("/api/connection/disconnect", { method: "POST" });
    onDisconnect();
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-gray-800 bg-gray-900 flex-shrink-0">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm font-semibold text-gray-200">+{phone}</span>
        <span className="text-xs text-gray-500">conectado</span>
      </div>
      <button
        onClick={handleDisconnect}
        className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
      >
        Desconectar
      </button>
    </header>
  );
}
