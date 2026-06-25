import { neon } from "@neondatabase/serverless";

export type Outcome = "qualificado" | "grupo";

export type Session = {
  id: string;
  startedAt: string;
  updatedAt: string;
  maxStepIndex: number;
  maxStepId: string | null;
  outcome: Outcome | null;
  scheduled: boolean;
  groupClicked: boolean;
  sold: boolean;
  saleValue: number | null;
  utm: Record<string, string>;
  answers: Record<string, string>;
  name: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
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
          outcome text,
          scheduled boolean NOT NULL DEFAULT false,
          group_clicked boolean NOT NULL DEFAULT false,
          sold boolean NOT NULL DEFAULT false,
          sale_value numeric,
          utm jsonb NOT NULL DEFAULT '{}'::jsonb,
          answers jsonb NOT NULL DEFAULT '{}'::jsonb,
          name text,
          phone text,
          email text,
          instagram text,
          user_agent text,
          ip text
        )
      `;
      // Migração p/ bancos que já tinham a tabela antes destas colunas.
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sold boolean NOT NULL DEFAULT false`;
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS sale_value numeric`;
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS utm jsonb NOT NULL DEFAULT '{}'::jsonb`;
      await sql`
        CREATE TABLE IF NOT EXISTS leads (
          id text PRIMARY KEY,
          brand_name text,
          outcome text,
          utm jsonb NOT NULL DEFAULT '{}'::jsonb,
          answers jsonb NOT NULL DEFAULT '{}'::jsonb,
          submitted_at timestamptz NOT NULL DEFAULT now(),
          user_agent text,
          ip text
        )
      `;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm jsonb NOT NULL DEFAULT '{}'::jsonb`;
    })().catch((error) => {
      schemaReady = null; // permite nova tentativa se falhar
      throw error;
    });
  }
  return schemaReady;
}

type TrackType =
  | "start"
  | "step"
  | "lead"
  | "outcome"
  | "schedule"
  | "groupclick";

type UpsertInput = {
  id: string;
  type: TrackType;
  stepIndex: number;
  stepId: string | null;
  outcome: Outcome | null;
  answers: Record<string, string>;
  utm: Record<string, string>;
  userAgent: string | null;
  ip: string | null;
};

export async function upsertSession(input: UpsertInput): Promise<void> {
  await ensureSchema();
  const name = input.answers.nome ?? null;
  const phone = input.answers.telefone ?? null;
  const email = input.answers.email ?? null;
  const instagram = input.answers.instagram ?? null;
  const outcome = input.type === "outcome" ? input.outcome : null;

  await sql`
    INSERT INTO sessions (
      id, max_step_index, max_step_id, outcome, scheduled, group_clicked,
      utm, answers, name, phone, email, instagram, user_agent, ip, updated_at
    )
    VALUES (
      ${input.id}, ${input.stepIndex}, ${input.stepId}, ${outcome},
      ${input.type === "schedule"}, ${input.type === "groupclick"},
      ${JSON.stringify(input.utm)}::jsonb,
      ${JSON.stringify(input.answers)}::jsonb,
      ${name}, ${phone}, ${email}, ${instagram},
      ${input.userAgent}, ${input.ip}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      max_step_index = GREATEST(sessions.max_step_index, EXCLUDED.max_step_index),
      max_step_id = COALESCE(EXCLUDED.max_step_id, sessions.max_step_id),
      outcome = COALESCE(EXCLUDED.outcome, sessions.outcome),
      scheduled = sessions.scheduled OR EXCLUDED.scheduled,
      group_clicked = sessions.group_clicked OR EXCLUDED.group_clicked,
      -- Atribuição de primeiro toque: mantém o UTM da primeira visita.
      utm = CASE WHEN sessions.utm = '{}'::jsonb THEN EXCLUDED.utm ELSE sessions.utm END,
      answers = sessions.answers || EXCLUDED.answers,
      name = COALESCE(EXCLUDED.name, sessions.name),
      phone = COALESCE(EXCLUDED.phone, sessions.phone),
      email = COALESCE(EXCLUDED.email, sessions.email),
      instagram = COALESCE(EXCLUDED.instagram, sessions.instagram),
      updated_at = now()
  `;
}

type LeadInput = {
  id: string;
  brandName: string | null;
  outcome: Outcome | null;
  answers: Record<string, string>;
  utm: Record<string, string>;
  submittedAt: string;
  userAgent: string | null;
  ip: string | null;
};

export async function insertLead(input: LeadInput): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO leads (id, brand_name, outcome, utm, answers, submitted_at, user_agent, ip)
    VALUES (
      ${input.id}, ${input.brandName}, ${input.outcome},
      ${JSON.stringify(input.utm)}::jsonb,
      ${JSON.stringify(input.answers)}::jsonb,
      ${input.submittedAt}, ${input.userAgent}, ${input.ip}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    startedAt: new Date(row.started_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
    maxStepIndex: Number(row.max_step_index),
    maxStepId: (row.max_step_id as string | null) ?? null,
    outcome: (row.outcome as Outcome | null) ?? null,
    scheduled: Boolean(row.scheduled),
    groupClicked: Boolean(row.group_clicked),
    sold: Boolean(row.sold),
    saleValue: row.sale_value == null ? null : Number(row.sale_value),
    utm: (row.utm as Record<string, string>) ?? {},
    answers: (row.answers as Record<string, string>) ?? {},
    name: (row.name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    instagram: (row.instagram as string | null) ?? null,
  };
}

const SESSION_COLS = `
  id, started_at, updated_at, max_step_index, max_step_id,
  outcome, scheduled, group_clicked, sold, sale_value,
  utm, answers, name, phone, email, instagram
`;

export async function getSessions(): Promise<Session[]> {
  await ensureSchema();
  const rows = (await sql.query(
    `SELECT ${SESSION_COLS} FROM sessions ORDER BY updated_at DESC`,
  )) as Record<string, unknown>[];
  return rows.map(mapSession);
}

// Marca a venda de um lead e devolve a sessão atualizada (com email/telefone
// pra disparar o Purchase na CAPI). Não mexe em updated_at pra não reordenar.
export async function markSale(input: {
  sessionId: string;
  value: number | null;
}): Promise<Session | null> {
  await ensureSchema();
  const rows = (await sql.query(
    `UPDATE sessions SET sold = true, sale_value = $1
     WHERE id = $2 RETURNING ${SESSION_COLS}`,
    [input.value, input.sessionId],
  )) as Record<string, unknown>[];
  return rows.length ? mapSession(rows[0]) : null;
}
