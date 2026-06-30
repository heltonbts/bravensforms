import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { bookAppointment, getTakenSlots } from "@/lib/db";

// Lista de horários já reservados, pra agenda esconder os ocupados.
export async function GET() {
  try {
    const taken = await getTakenSlots();
    return NextResponse.json({ taken });
  } catch (error) {
    console.error("schedule list failed", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}

type SchedulePayload = {
  sessionId?: string;
  slot?: string; // ISO/UTC do horário escolhido
  answers?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  let payload: SchedulePayload;
  try {
    payload = (await request.json()) as SchedulePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slotMs = payload.slot ? Date.parse(payload.slot) : NaN;
  if (!payload.sessionId || !payload.slot || Number.isNaN(slotMs)) {
    return NextResponse.json(
      { error: "Missing sessionId/slot" },
      { status: 400 },
    );
  }
  if (slotMs <= Date.now()) {
    return NextResponse.json({ error: "Horário no passado" }, { status: 400 });
  }

  const answers = payload.answers ?? {};
  try {
    const result = await bookAppointment({
      id: randomUUID(),
      sessionId: payload.sessionId,
      slot: new Date(slotMs).toISOString(),
      name: answers.nome ?? null,
      phone: answers.telefone ?? null,
      instagram: answers.instagram ?? null,
      answers,
    });

    if (result.conflict) {
      return NextResponse.json(
        { error: "Esse horário acabou de ser reservado." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("schedule book failed", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
