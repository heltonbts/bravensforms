import { NextRequest, NextResponse } from "next/server";
import { sendServerEvent } from "@/lib/capi";

type ConversionBody = {
  event?: string;
  eventId?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  value?: number;
  currency?: string;
  actionSource?: "website" | "system_generated" | "phone_call" | "chat" | "other";
  // Só exigido para eventos que NÃO vêm do site (ex.: Purchase/venda fechada).
  secret?: string;
};

function cookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(header);
  return match?.[1];
}

export async function POST(request: NextRequest) {
  let body: ConversionBody;
  try {
    body = (await request.json()) as ConversionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.event) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  const actionSource = body.actionSource ?? "website";

  // Eventos do servidor (venda offline, etc.) exigem segredo, pra ninguém
  // injetar conversões falsas e "sujar" o aprendizado do Pixel.
  if (actionSource !== "website") {
    const expected = process.env.FB_CONVERSION_SECRET ?? "";
    if (!expected || body.secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cookieHeader = request.headers.get("cookie");

  await sendServerEvent({
    eventName: body.event,
    eventId: body.eventId,
    eventSourceUrl: request.headers.get("referer"),
    actionSource,
    email: body.email,
    phone: body.phone,
    firstName: body.firstName,
    lastName: body.lastName,
    value: body.value,
    currency: body.currency,
    clientIp:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null,
    clientUserAgent: request.headers.get("user-agent"),
    fbp: cookie(cookieHeader, "_fbp"),
    fbc: cookie(cookieHeader, "_fbc"),
  });

  return NextResponse.json({ ok: true });
}
