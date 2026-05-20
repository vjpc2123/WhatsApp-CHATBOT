import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import qrcodeTerminal from "qrcode-terminal";
import { setConnectionState } from "../db";
import { setupMessageHandler } from "./handler";

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const logger = pino({ level: "silent" });

export interface BaileysHandle {
  sock: WASocket;
  shutdown: () => Promise<void>;
}

export let _handle: BaileysHandle | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export async function start(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // Siempre obtener la versión más nueva para evitar code 405
  let version: [number, number, number] | undefined;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log(`[bot] Versión WhatsApp Web: ${version.join(".")}`);
  } catch (err) {
    console.warn("[bot] No se pudo obtener última versión de Baileys:", err);
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.macOS("Desktop"), // crítico: fingerprint conocido, evita code 440
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  _handle = {
    sock,
    shutdown: async () => {
      try {
        await sock.logout();
      } catch {}
      try {
        sock.end(undefined);
      } catch {}
    },
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Nuevo QR disponible
    if (qr) {
      console.log("[bot] QR listo — escanea desde localhost:3000");
      qrcodeTerminal.generate(qr, { small: true });
      setConnectionState({ status: "qr", qr_string: qr, phone: null });
      return;
    }

    if (connection === "connecting") {
      const current = (await import("../db")).getConnectionState();
      // Solo avanzar a 'connecting' desde 'disconnected' — no degradar desde 'qr' o 'connected'
      if (current.status === "disconnected") {
        setConnectionState({ status: "connecting" });
      }
      return;
    }

    if (connection === "open") {
      const rawId = sock.user?.id ?? "";
      const phone = rawId.split(":")[0];
      console.log(`[bot] Conectado como ${phone}`);
      setConnectionState({ status: "connected", qr_string: null, phone });
      return;
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
        ?.statusCode;
      console.log(`[bot] Conexión cerrada, code=${code}`);

      if (code === DisconnectReason.loggedOut) {
        // Logout manual o desde el teléfono — no reconectar
        console.log("[bot] Sesión cerrada (401). Volviendo a estado desconectado.");
        setConnectionState({ status: "disconnected", qr_string: null, phone: null });
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        return;
      }

      // Para cualquier otro código NO modificamos el estado — mostramos "connected"
      // mientras reconecta transparentemente. Si necesita QR, el evento `qr` lo sobreescribirá.
      scheduleReconnect(code ?? 0);
    }
  });

  setupMessageHandler(sock);
}

function scheduleReconnect(code: number) {
  if (reconnectTimer) return;
  // Code 440 = connectionReplaced: justo después del pairing WhatsApp abre un WS definitivo
  // y kickea el de pairing. Reintentar muy rápido genera un loop. Esperar 15s.
  const delay = code === 440 ? 15_000 : 5_000;
  console.log(`[bot] Reconectando en ${delay / 1000}s...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (_handle) {
      try {
        _handle.sock.end(undefined);
      } catch {}
      _handle = null;
    }
    start().catch((err) => console.error("[bot] Error al reconectar:", err));
  }, delay);
}
