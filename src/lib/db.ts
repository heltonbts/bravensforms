import { neon } from "@neondatabase/serverless";

export type Session = {
  id: string;
  startedAt: string;
  updatedAt: string;
  maxStepIndex: number;
  maxStepId: string | null;
  reachedResult: boolean;
  checkoutClicked: boolean;
  whatsappClicked: boolean;
  answers: Record<string, string>;
  name: string | null;
  phone: string | null;
};

const sql = neon(process.env.DATABASE_URL ?? "");

let schemaReady: Promise<void> | null = null;

// Cria as tabelas uma única vez por processo (idempotente).
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id text PRIMARY KEY,
          started_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          max_step_index int NOT NULL DEFAULT -1,
          max_step_id text,
          reached_result boolean NOT NULL DEFAULT false,
          checkout_clicked boolean NOT NULL DEFAULT false,
          whatsapp_clicked boolean NOT NULL DEFAULT false,
          answers jsonb NOT NULL DEFAULT '{}'::jsonb,
          name text,
          phone text,
          user_agent text,
          ip text
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS leads (
          id text PRIMARY KEY,
          brand_name text,
          answers jsonb NOT NULL DEFAULT '{}'::jsonb,
          submitted_at timestamptz NOT NULL DEFAULT now(),
          user_agent text,
          ip text
        )
      `;
    })().catch((error) => {
      schemaReady = null; // permite nova tentativa se falhar
      throw error;
    });
  }
  return schemaReady;
}

type UpsertInput = {
  id: string;
  type: "start" | "step" | "result" | "checkout" | "whatsapp";
  stepIndex: number;
  stepId: string | null;
  answers: Record<string, string>;
  userAgent: string | null;
  ip: string | null;
};

export async function upsertSession(input: UpsertInput): Promise<void> {
  await ensureSchema();
  const name = input.answers.nome ?? null;
  const phone = input.answers.telefone ?? null;

  await sql`
    INSERT INTO sessions (
      id, max_step_index, max_step_id, reached_result, checkout_clicked,
      whatsapp_clicked, answers, name, phone, user_agent, ip, updated_at
    )
    VALUES (
      ${input.id}, ${input.stepIndex}, ${input.stepId},
      ${input.type === "result"}, ${input.type === "checkout"},
      ${input.type === "whatsapp"}, ${JSON.stringify(input.answers)}::jsonb,
      ${name}, ${phone}, ${input.userAgent}, ${input.ip}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      max_step_index = GREATEST(sessions.max_step_index, EXCLUDED.max_step_index),
      max_step_id = COALESCE(EXCLUDED.max_step_id, sessions.max_step_id),
      reached_result = sessions.reached_result OR EXCLUDED.reached_result,
      checkout_clicked = sessions.checkout_clicked OR EXCLUDED.checkout_clicked,
      whatsapp_clicked = sessions.whatsapp_clicked OR EXCLUDED.whatsapp_clicked,
      answers = sessions.answers || EXCLUDED.answers,
      name = COALESCE(EXCLUDED.name, sessions.name),
      phone = COALESCE(EXCLUDED.phone, sessions.phone),
      updated_at = now()
  `;
}

type LeadInput = {
  id: string;
  brandName: string | null;
  answers: Record<string, string>;
  submittedAt: string;
  userAgent: string | null;
  ip: string | null;
};

export async function insertLead(input: LeadInput): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO leads (id, brand_name, answers, submitted_at, user_agent, ip)
    VALUES (
      ${input.id}, ${input.brandName}, ${JSON.stringify(input.answers)}::jsonb,
      ${input.submittedAt}, ${input.userAgent}, ${input.ip}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getSessions(): Promise<Session[]> {
  await ensureSchema();
  const rows = (await sql`
    SELECT id, started_at, updated_at, max_step_index, max_step_id,
           reached_result, checkout_clicked, whatsapp_clicked, answers, name, phone
    FROM sessions
    ORDER BY updated_at DESC
  `) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    startedAt: new Date(row.started_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    maxStepIndex: Number(row.max_step_index),
    maxStepId: (row.max_step_id as string | null) ?? null,
    reachedResult: Boolean(row.reached_result),
    checkoutClicked: Boolean(row.checkout_clicked),
    whatsappClicked: Boolean(row.whatsapp_clicked),
    answers: (row.answers as Record<string, string>) ?? {},
    name: (row.name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
  }));
}
