import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { setConnectionState } from "@/lib/db";

export async function POST() {
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  const authDir = path.resolve(process.cwd(), "auth");
  fs.rmSync(authDir, { recursive: true, force: true });

  // Flag que start-bot.ts detecta para reiniciar limpio
  const restartFlag = path.resolve(process.cwd(), "data", ".restart");
  fs.mkdirSync(path.dirname(restartFlag), { recursive: true });
  fs.writeFileSync(restartFlag, "");

  return NextResponse.json({ ok: true });
}
