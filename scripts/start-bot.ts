// env-loader DEBE ser el primer import — ES modules hoistean todos los imports,
// y los módulos que leen process.env en su top-level necesitan que esto se ejecute primero.
import "./env-loader";

import path from "node:path";
import fs from "node:fs";
import { start, _handle } from "../src/lib/baileys/client";
import { getPendingOutbox, markOutboxSent } from "../src/lib/db";

const RESTART_FLAG = path.resolve(process.cwd(), "data", ".restart");
const AUTH_DIR = path.resolve(process.cwd(), "auth");

console.log("[bot] Iniciando agente WhatsApp...");
start().catch((err) => {
  console.error("[bot] Error fatal al iniciar:", err);
  process.exit(1);
});

// ─── Outbox poller — envía mensajes humanos del dashboard cada 2s ─────────────
async function processOutbox() {
  // _handle es exportado desde client.ts y apunta al socket activo
  const { _handle: handle } = await import("../src/lib/baileys/client");
  if (!handle) return;

  const pending = getPendingOutbox(20);
  for (const item of pending) {
    try {
      // phone puede ser "18291234567" (@s.whatsapp.net) o "161465000525833@lid"
      const jid = item.phone.includes("@") ? item.phone : `${item.phone}@s.whatsapp.net`;
      await handle.sock.sendMessage(jid, {
        text: item.content,
      });
      markOutboxSent(item.id);
      console.log(`[bot] → Outbox enviado a ${item.phone}: "${item.content.slice(0, 60)}"`);
    } catch (err) {
      console.warn(`[bot] Outbox falló para ${item.phone}:`, err);
    }
  }
}

setInterval(() => {
  processOutbox().catch((err) =>
    console.warn("[bot] Error en outbox poller:", err)
  );
}, 2_000);

// ─── Restart flag watcher ─────────────────────────────────────────────────────
setInterval(async () => {
  if (!fs.existsSync(RESTART_FLAG)) return;

  console.log("[bot] Flag de restart detectado — reiniciando sesión...");
  try { fs.unlinkSync(RESTART_FLAG); } catch {}

  const { _handle: handle } = await import("../src/lib/baileys/client");
  if (handle) {
    try { await handle.shutdown(); } catch {}
  }

  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}

  start().catch((err) => console.error("[bot] Error al reiniciar:", err));
}, 1_000);
