import { NextRequest, NextResponse } from "next/server";
import { markSale } from "@/lib/db";
import { capiConfigured, sendServerEvent } from "@/lib/capi";

// Disparado pelo dashboard (protegido por Basic Auth no middleware).
// Marca a venda no banco e envia o Purchase pela Conversions API, casando
// pelo email/telefone do lead — é isso que ensina o Pixel quem compra.

type SaleBody = {
  sessionId?: string;
  value?: number;
  currency?: string;
};

function splitName(full: string | null) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export async function POST(request: NextRequest) {
  let body: SaleBody;
  try {
    body = (await request.json()) as SaleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const value = Number(body.value);
  if (!body.sessionId || !Number.isFinite(value) || value <= 0) {
    return NextResponse.json(
      { error: "sessionId e value (> 0) são obrigatórios" },
      { status: 400 },
    );
  }

  let session;
  try {
    session = await markSale({ sessionId: body.sessionId, value });
  } catch (error) {
    console.error("markSale failed", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const { firstName, lastName } = splitName(session.name);
  await sendServerEvent({
    eventName: "Purchase",
    // 1 venda por sessão → event_id estável evita contar duas vezes.
    eventId: `sale-${session.id}`,
    actionSource: "system_generated",
    email: session.email,
    phone: session.phone,
    firstName,
    lastName,
    value,
    currency: body.currency ?? "BRL",
  });

  return NextResponse.json({ ok: true, sentToFacebook: capiConfigured() });
}
