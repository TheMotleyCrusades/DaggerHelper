import { createHmac, timingSafeEqual } from "node:crypto";

const SHARE_TOKEN_VERSION = 1;

type SharePayload = {
  v: number;
  characterId: number;
  exp: number | null;
};

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function secret() {
  return (
    process.env.SHARE_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "local-share-secret"
  );
}

function sign(payloadBase64: string) {
  return createHmac("sha256", secret()).update(payloadBase64).digest("base64url");
}

function serializePayload(payload: SharePayload) {
  return base64UrlEncode(JSON.stringify(payload));
}

function parsePayload(payloadBase64: string) {
  try {
    const parsed = JSON.parse(base64UrlDecode(payloadBase64)) as SharePayload;
    if (parsed.v !== SHARE_TOKEN_VERSION) return null;
    if (!Number.isInteger(parsed.characterId) || parsed.characterId <= 0) return null;
    if (parsed.exp !== null && (!Number.isInteger(parsed.exp) || parsed.exp <= 0)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createShareId(characterId: number, expiresInDays?: number | null) {
  const exp =
    typeof expiresInDays === "number" && expiresInDays > 0
      ? Date.now() + expiresInDays * 24 * 60 * 60 * 1000
      : null;

  const payloadBase64 = serializePayload({
    v: SHARE_TOKEN_VERSION,
    characterId,
    exp,
  });

  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function parseShareId(shareId: string) {
  const [payloadBase64, signature] = shareId.split(".");
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = sign(payloadBase64);
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  const payload = parsePayload(payloadBase64);
  if (!payload) return null;
  if (payload.exp !== null && Date.now() > payload.exp) return null;

  return payload;
}
