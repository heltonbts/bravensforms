import { NextRequest, NextResponse } from "next/server";
import { insertLead } from "@/lib/db";

type LeadPayload = {
  brandName?: string;
  answers?: Record<string, string>;
  submittedAt?: string;
};

export async function POST(request: NextRequest) {
  let payload: LeadPayload;

  try {
    payload = (await request.json()) as LeadPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.answers || typeof payload.answers !== "object") {
    return NextResponse.json({ error: "Missing answers" }, { status: 400 });
  }

  const id = crypto.randomUUID();

  try {
    await insertLead({
      id,
      brandName: payload.brandName ?? null,
      answers: payload.answers,
      submittedAt: payload.submittedAt ?? new Date().toISOString(),
      userAgent: request.headers.get("user-agent"),
      ip:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        request.headers.get("x-real-ip") ??
        null,
    });
  } catch (error) {
    console.error("lead insert failed", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
