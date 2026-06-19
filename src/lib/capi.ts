import crypto from "crypto";

// Conversions API (CAPI) do Facebook — envio de eventos pelo servidor.
// Tudo é no-op se as credenciais não estiverem configuradas, então o app
// funciona normalmente até você preencher o Pixel ID e o token.

const PIXEL_ID =
  process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? process.env.FB_PIXEL_ID ?? "";
const TOKEN = process.env.FB_CAPI_TOKEN ?? "";
const API_VERSION = "v21.0";
const TEST_CODE = process.env.FB_TEST_EVENT_CODE ?? "";

export function capiConfigured(): boolean {
  return Boolean(PIXEL_ID && TOKEN);
}

// Facebook exige email/nome em SHA-256, normalizados (minúsculo, sem espaço).
function hash(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// Telefone: só dígitos, com DDI. Assume Brasil (55) se vier sem.
function hashPhone(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  let digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length <= 11) digits = `55${digits}`;
  return crypto.createHash("sha256").update(digits).digest("hex");
}

export type ServerEventInput = {
  eventName: string;
  eventId?: string;
  eventSourceUrl?: string | null;
  actionSource?:
    | "website"
    | "system_generated"
    | "phone_call"
    | "chat"
    | "other";
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  value?: number;
  currency?: string;
  customData?: Record<string, unknown>;
};

export async function sendServerEvent(input: ServerEventInput): Promise<void> {
  if (!capiConfigured()) return; // sem credenciais → não faz nada

  const userData: Record<string, unknown> = {};
  const em = hash(input.email);
  const ph = hashPhone(input.phone);
  const fn = hash(input.firstName);
  const ln = hash(input.lastName);
  if (em) userData.em = em;
  if (ph) userData.ph = ph;
  if (fn) userData.fn = fn;
  if (ln) userData.ln = ln;
  if (input.clientIp) userData.client_ip_address = input.clientIp;
  if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
  if (input.fbp) userData.fbp = input.fbp;
  if (input.fbc) userData.fbc = input.fbc;

  const customData: Record<string, unknown> = { ...(input.customData ?? {}) };
  if (typeof input.value === "number") {
    customData.value = input.value;
    customData.currency = input.currency ?? "BRL";
  }

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: input.actionSource ?? "website",
        event_id: input.eventId,
        event_source_url: input.eventSourceUrl ?? undefined,
        user_data: userData,
        custom_data: Object.keys(customData).length ? customData : undefined,
      },
    ],
  };
  if (TEST_CODE) body.test_event_code = TEST_CODE;

  const url = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${TOKEN}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("CAPI event failed", input.eventName, await res.text());
    }
  } catch (error) {
    console.error("CAPI event error", input.eventName, error);
  }
}
