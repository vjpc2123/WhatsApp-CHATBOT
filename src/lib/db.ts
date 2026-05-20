import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "messages.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
  last_message_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS connection_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
    NOT NULL DEFAULT 'disconnected',
  qr_string TEXT,
  phone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox(sent, created_at);
`);

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  created_at: number;
}

export interface ConversationWithPreview extends Conversation {
  last_message_preview: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

export interface ConnectionState {
  id: 1;
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface OutboxItem {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

// ─── Conversaciones ───────────────────────────────────────────────────────────

const stmtGetConvByPhone = db.prepare<[string], Conversation>(
  "SELECT * FROM conversations WHERE phone = ?"
);

const stmtInsertConv = db.prepare<[string, string | null], { lastInsertRowid: bigint }>(
  "INSERT INTO conversations (phone, name) VALUES (?, ?) RETURNING id"
);

const stmtUpdateConvName = db.prepare<[string, string]>(
  "UPDATE conversations SET name = ? WHERE phone = ?"
);

export function getOrCreateConversation(phone: string, name?: string): Conversation {
  const existing = stmtGetConvByPhone.get(phone);
  if (existing) {
    if (name && name !== existing.name) {
      stmtUpdateConvName.run(name, phone);
      existing.name = name;
    }
    return existing;
  }
  db.prepare("INSERT OR IGNORE INTO conversations (phone, name) VALUES (?, ?)").run(
    phone,
    name ?? null
  );
  return stmtGetConvByPhone.get(phone)!;
}

const stmtGetConvById = db.prepare<[number], Conversation>(
  "SELECT * FROM conversations WHERE id = ?"
);

export function getConversationById(id: number): Conversation | null {
  return stmtGetConvById.get(id) ?? null;
}

export function listConversations(): ConversationWithPreview[] {
  return db
    .prepare<[], ConversationWithPreview>(
      `SELECT c.*,
        (SELECT content FROM messages WHERE conversation_id = c.id
         ORDER BY created_at DESC LIMIT 1) AS last_message_preview
       FROM conversations c
       ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`
    )
    .all();
}

export function setMode(conversationId: number, mode: "AI" | "HUMAN"): void {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(mode, conversationId);
}

// ─── Mensajes ─────────────────────────────────────────────────────────────────

const insertMsgTx = db.transaction((conversationId: number, role: string, content: string) => {
  db.prepare(
    "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)"
  ).run(conversationId, role, content);
  db.prepare(
    "UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?"
  ).run(conversationId);
});

export function insertMessage(
  conversationId: number,
  role: "user" | "assistant" | "human",
  content: string
): void {
  insertMsgTx(conversationId, role, content);
}

const stmtGetMessages = db.prepare<[number, number], Message>(
  "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?"
);

export function getMessages(conversationId: number, limit = 50): Message[] {
  return stmtGetMessages.all(conversationId, limit);
}

export function getRecentHistory(conversationId: number, limit = 20): Message[] {
  const rows = db
    .prepare<[number, number], Message>(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .all(conversationId, limit);
  return rows.reverse();
}

// ─── Borrar conversación ──────────────────────────────────────────────────────

const deleteConvTx = db.transaction((id: number) => {
  db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
  db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(id);
  db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
});

export function deleteConversation(id: number): void {
  deleteConvTx(id);
}

// ─── Estado de conexión ───────────────────────────────────────────────────────

const stmtGetConnState = db.prepare<[], ConnectionState>(
  "SELECT * FROM connection_state WHERE id = 1"
);

export function getConnectionState(): ConnectionState {
  return stmtGetConnState.get()!;
}

export function setConnectionState(patch: {
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string?: string | null;
  phone?: string | null;
}): void {
  const current = getConnectionState();

  const qr =
    "qr_string" in patch ? patch.qr_string : current.qr_string;
  const phone =
    "phone" in patch ? patch.phone : current.phone;

  db.prepare(
    `UPDATE connection_state
     SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch()
     WHERE id = 1`
  ).run(patch.status, qr ?? null, phone ?? null);
}

// ─── Outbox ───────────────────────────────────────────────────────────────────

export function enqueueOutbox(
  conversationId: number,
  phone: string,
  content: string
): void {
  db.prepare(
    "INSERT INTO outbox (conversation_id, phone, content) VALUES (?, ?, ?)"
  ).run(conversationId, phone, content);
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return db
    .prepare<[number], OutboxItem>(
      "SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC LIMIT ?"
    )
    .all(limit);
}

export function markOutboxSent(id: number): void {
  db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?").run(id);
}

export default db;
