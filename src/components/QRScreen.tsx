"use client";

import { useEffect, useState } from "react";

interface StatusResponse {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qrPng?: string;
  phone?: string;
  updatedAt?: number;
}

interface Props {
  onConnected: (phone: string) => void;
}

export default function QRScreen({ onConnected }: Props) {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [firstSeen, setFirstSeen] = useState<number>(Date.now());

  useEffect(() => {
    setFirstSeen(Date.now());
    poll();
    const t = setInterval(poll, 2_000);
    return () => clearInterval(t);
  }, []);

  async function poll() {
    try {
      const res = await fetch("/api/connection/status");
      if (!res.ok) return;
      const json: StatusResponse = await res.json();
      setData(json);
      if (json.status === "connected" && json.phone) {
        onConnected(json.phone);
      }
    } catch {}
  }

  const elapsed = Math.floor((Date.now() - firstSeen) / 1000);
  const showBotError = !data?.qrPng && (data?.status === "disconnected" || !data) && elapsed > 10;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Agente WhatsApp</h1>
        <p className="text-gray-400 text-sm">Conecta tu número para comenzar</p>
      </div>

      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 flex flex-col items-center gap-5 min-w-72">
        {data?.qrPng ? (
          <>
            <img
              src={data.qrPng}
              alt="QR de WhatsApp"
              className="rounded-xl"
              width={280}
              height={280}
            />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="text-amber-300 text-sm">Esperando escaneo...</p>
            </div>
            <p className="text-gray-500 text-xs text-center">
              Abre WhatsApp en tu teléfono → Dispositivos vinculados → Vincular dispositivo
            </p>
          </>
        ) : data?.status === "connecting" ? (
          <>
            <div className="w-20 h-20 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <p className="text-blue-300 text-sm">Conectando...</p>
            </div>
          </>
        ) : showBotError ? (
          <>
            <div className="w-16 h-16 rounded-full bg-red-950 flex items-center justify-center text-red-400 text-2xl">!</div>
            <p className="text-red-400 text-sm text-center">
              No se puede conectar con el proceso bot.
            </p>
            <p className="text-gray-500 text-xs text-center">
              Asegúrate de que <code className="bg-gray-800 px-1 rounded">npm run start:bot</code> esté corriendo.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full border-4 border-gray-700 border-t-gray-400 animate-spin" />
            <p className="text-gray-400 text-sm">Esperando QR...</p>
          </>
        )}
      </div>

      <p className="text-gray-600 text-xs">
        El QR expira cada 20 segundos. Si caduca, se actualizará automáticamente.
      </p>
    </div>
  );
}
