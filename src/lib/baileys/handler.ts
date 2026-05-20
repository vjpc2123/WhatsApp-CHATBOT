import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
} from "../db";
import { generateReply } from "../openrouter";

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
  // Chats 1:1: formato clásico @s.whatsapp.net o nuevo @lid (multi-dispositivo)
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@lid");
}

function phoneFromJid(jid: string): string {
  // Para @lid guardamos el JID completo como identificador único
  if (jid.endsWith("@lid")) return jid;
  return jid.replace("@s.whatsapp.net", "");
}

async function handleMessage(sock: WASocket, msg: WAMessage) {
  const remoteJid = msg.key.remoteJid ?? "";
  console.log(`[bot] MSG jid=${remoteJid} fromMe=${msg.key.fromMe} keys=${Object.keys(msg.message ?? {}).join(",")}`);

  if (msg.key.fromMe) return;

  if (!isDirectMessage(remoteJid)) return;

  // Extraer texto de todos los formatos posibles
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

  const convo = getOrCreateConversation(phone, pushName);
  insertMessage(convo.id, "user", text);

  const fresh = getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") {
    console.log(`[bot] Conversación ${convo.id} en modo HUMAN — sin respuesta automática`);
    return;
  }

  const history = getRecentHistory(convo.id, 20);
  console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);

  const start = Date.now();
  const reply = await generateReply(history);
  const elapsed = Date.now() - start;

  console.log(`[bot] LLM respondió en ${elapsed}ms: "${reply.slice(0, 80)}${reply.length > 80 ? "..." : ""}"`);

  insertMessage(convo.id, "assistant", reply);

  await sock.sendMessage(remoteJid, { text: reply });
  console.log(`[bot] → Enviado a ${phone}`);
}
