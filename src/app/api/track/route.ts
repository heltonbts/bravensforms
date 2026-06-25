import { NextRequest, NextResponse } from "next/server";
import { upsertSession, type Outcome } from "@/lib/db";

type TrackType =
  | "start"
  | "step"
  | "lead"
  | "outcome"
  | "schedule"
  | "groupclick";

type TrackPayload = {
  sessionId?: string;
  type?: TrackType;
  stepIndex?: number;
  stepId?: string;
  outcome?: Outcome;
  answers?: Record<string, string>;
  utm?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  let payload: TrackPayload;

  try {
    payload = (await request.json()) as TrackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.sessionId || !payload.type) {
    return NextResponse.json({ error: "Missing sessionId/type" }, { status: 400 });
  }

  try {
    await upsertSession({
      id: payload.sessionId,
      type: payload.type,
      stepIndex: typeof payload.stepIndex === "number" ? payload.stepIndex : -1,
      stepId: payload.stepId ?? null,
      outcome: payload.outcome ?? null,
      answers: payload.answers ?? {},
      utm: payload.utm ?? {},
      userAgent: request.headers.get("user-agent"),
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        null,
    });
  } catch (error) {
    console.error("track upsert failed", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
