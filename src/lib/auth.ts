export const SESSION_COOKIE = "wa_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function hmac(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toBase64(sig);
}

export async function createSessionToken(username: string): Promise<string> {
  const secret = process.env.AUTH_SECRET ?? "default-secret";
  const payload = `${username}:${Math.floor(Date.now() / 1000)}`;
  const sig = await hmac(payload, secret);
  return `${btoa(payload)}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = process.env.AUTH_SECRET ?? "default-secret";
    const [encodedPayload, sig] = token.split(".");
    if (!encodedPayload || !sig) return false;
    const payload = atob(encodedPayload);
    const expected = await hmac(payload, secret);
    return expected === sig;
  } catch {
    return false;
  }
}
