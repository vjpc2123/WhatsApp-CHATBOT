import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
} from "../db";
import { generateReply } from "../openrouter";

// Tiempo de espera antes de responder. Si el usuario envía más mensajes
// dentro de este intervalo, el contador se reinicia y se responde todo junto.
const DEBOUNCE_MS = 50_000;

// Map conversationId → timer pendiente
const pendingDebounce = new Map<number, ReturnType<typeof setTimeout>>();

export function setupMessageHandler(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    console.log(`[bot] messages.upsert type=${type} count=${messages.length}`);
    for (const msg of messages) {
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[bot] Error procesando mensaje:", err);
      }
    }
  });
}

function isDirectMessage(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");
}

function phoneFromJid(jid: string): string {
  if (jid.endsWith("@lid")) return jid;
  return jid.replace("@s.whatsapp.net", "");
}

async function handleMessage(sock: WASocket, msg: WAMessage) {
  const remoteJid = msg.key.remoteJid ?? "";
  console.log(`[bot] MSG jid=${remoteJid} fromMe=${msg.key.fromMe} keys=${Object.keys(msg.message ?? {}).join(",")}`);

  if (msg.key.fromMe) return;
  if (!isDirectMessage(remoteJid)) return;

  const text =
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    msg.message?.ephemeralMessage?.message?.conversation ??
    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.text ??
    null;

  if (!text) {
    console.log(`[bot] Sin texto — keys: ${JSON.stringify(Object.keys(msg.message ?? {}))}`);
    return;
  }

  const phone = phoneFromJid(remoteJid);
  const pushName = msg.pushName ?? undefined;

  console.log(`[bot] ← Mensaje de ${phone} (${pushName ?? "sin nombre"}): "${text}"`);

  // Guardar el mensaje en DB inmediatamente
  const convo = getOrCreateConversation(phone, pushName);
  insertMessage(convo.id, "user", text);

  // Verificar modo
  const fresh = getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") {
    console.log(`[bot] Conversación ${convo.id} en modo HUMAN — sin respuesta automática`);
    return;
  }

  // Debounce: reiniciar timer si ya había uno pendiente
  const existing = pendingDebounce.get(convo.id);
  if (existing) {
    clearTimeout(existing);
    console.log(`[bot] Timer reiniciado para conversación ${convo.id} (${phone})`);
  } else {
    console.log(`[bot] Esperando ${DEBOUNCE_MS / 1000}s antes de responder a ${phone}...`);
  }

  const timer = setTimeout(async () => {
    pendingDebounce.delete(convo.id);
    await respondToConversation(sock, convo.id, remoteJid, phone);
  }, DEBOUNCE_MS);

  pendingDebounce.set(convo.id, timer);
}

async function respondToConversation(
  sock: WASocket,
  conversationId: number,
  remoteJid: string,
  phone: string
) {
  // Re-verificar modo al momento de responder (pudo cambiar durante el debounce)
  const conv = getConversationById(conversationId);
  if (!conv || conv.mode !== "AI") {
    console.log(`[bot] Conversación ${conversationId} cambió a HUMAN durante el debounce — sin respuesta`);
    return;
  }

  // Obtener todo el historial reciente incluyendo los mensajes acumulados
  const history = getRecentHistory(conversationId, 30);
  console.log(`[bot] Respondiendo a ${phone} con contexto de ${history.length} mensajes...`);

  const start = Date.now();
  const reply = await generateReply(history);
  const elapsed = Date.now() - start;

  console.log(`[bot] LLM respondió en ${elapsed}ms: "${reply.slice(0, 80)}${reply.length > 80 ? "..." : ""}"`);

  insertMessage(conversationId, "assistant", reply);
  await sock.sendMessage(remoteJid, { text: reply });
  console.log(`[bot] → Enviado a ${phone}`);
}
