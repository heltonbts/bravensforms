import type { Metadata } from "next";
import { CONFIG, type QuizStep } from "@/lib/funnel-config";
import { getSessions, getAppointments, type Session } from "@/lib/db";
import { formatSlot } from "@/lib/scheduling";
import { SaleButton } from "./SaleButton";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | Bravens Mídia",
  robots: { index: false, follow: false },
};

const STEP_LABELS: Record<string, string> = {
  nome: "Nome",
  telefone: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
  experiencia: "Investe em marketing hoje",
  faturamento: "Faturamento mensal",
  investir: "Disposto a investir",
};

function labelForStep(step: QuizStep): string {
  return STEP_LABELS[step.id] ?? step.title;
}

// Converte a resposta crua (id de opção ou texto) em algo legível.
function answerDisplay(step: QuizStep, session: Session): string {
  const raw = session.answers[step.id];
  if (!raw) return "";
  if (step.type === "single") {
    const option = step.options.find((o) => o.id === raw);
    return option ? option.label : raw;
  }
  return raw; // texto / telefone / email / instagram
}

function outcomeBadge(session: Session): { label: string; kind: string } {
  if (session.outcome === "qualificado") {
    return {
      label: session.scheduled ? "Agendou reunião" : "Qualificado",
      kind: session.scheduled ? "checkout" : "offer",
    };
  }
  if (session.outcome === "grupo") {
    return {
      label: session.groupClicked ? "Entrou no grupo" : "Grupo (desqualificado)",
      kind: "step",
    };
  }
  const step = CONFIG.steps.find((s) => s.id === session.maxStepId);
  return { label: step ? labelForStep(step) : "Abriu o funil", kind: "step" };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", // fuso de Brasília (UTC-3); servidor roda em UTC
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Data (YYYY-MM-DD) da sessão no fuso de Brasília, pra comparar com os filtros.
function brasiliaDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
}

// Rótulo curto da origem (pra agrupar): utm_source, ou referrer, ou "Direto".
function sourceKey(session: Session): string {
  const utm = session.utm ?? {};
  if (utm.utm_source) return utm.utm_source.toLowerCase();
  if (utm.fbclid) return "facebook (clique)";
  if (utm.gclid) return "google (clique)";
  if (utm.ttclid) return "tiktok (clique)";
  if (utm.referrer) return utm.referrer.toLowerCase();
  return "direto / sem utm";
}

// Detalhe da campanha de um lead (source / medium / campaign).
function sourceDetail(session: Session): string {
  const utm = session.utm ?? {};
  const parts = [utm.utm_source, utm.utm_medium, utm.utm_campaign].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  if (utm.referrer) return `ref: ${utm.referrer}`;
  return "Direto / sem UTM";
}

type DashboardSearchParams = {
  from?: string;
  to?: string;
  status?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const sp = await searchParams;
  // Por padrão a página já abre filtrada em "hoje" (fuso de Brasília). Quando o
  // parâmetro vem vazio (ex.: "Ver tudo"), respeita a string vazia e mostra tudo.
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const from = sp.from ?? today;
  const to = sp.to ?? today;
  const status = sp.status ?? "";

  const allSessions = await getSessions();
  // Agenda: próximas reuniões marcadas (independe do filtro de período).
  const upcoming = await getAppointments({ upcomingOnly: true });

  // Aplica os filtros: intervalo de dias (fuso de Brasília) e situação no funil.
  const sessions = allSessions.filter((s) => {
    const day = brasiliaDate(s.updatedAt);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (status === "finalizou" && s.outcome === null) return false;
    if (status === "grupo" && !s.groupClicked) return false;
    return true;
  });

  const total = sessions.length;
  const hasFilter = Boolean(from || to || status);

  const qualificados = sessions.filter((s) => s.outcome === "qualificado").length;
  const agendaram = sessions.filter((s) => s.scheduled).length;
  const grupo = sessions.filter((s) => s.outcome === "grupo").length;
  const vendas = sessions.filter((s) => s.sold).length;
  const receita = sessions.reduce((sum, s) => sum + (s.saleValue ?? 0), 0);

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const brl = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Perguntas de escolha única: base da distribuição de respostas.
  const choiceSteps = CONFIG.steps.filter(
    (s): s is Extract<QuizStep, { type: "single" }> => s.type === "single",
  );

  // Etapas mostradas no detalhe de cada pessoa (tudo, menos o nome no topo).
  const detailSteps = CONFIG.steps.filter((s) => s.id !== "nome");

  // Agrupa por origem do tráfego: entradas, qualificados e vendas por fonte.
  const sourceMap = new Map<
    string,
    { total: number; qualificados: number; vendas: number; receita: number }
  >();
  for (const s of sessions) {
    const key = sourceKey(s);
    const row =
      sourceMap.get(key) ?? { total: 0, qualificados: 0, vendas: 0, receita: 0 };
    row.total += 1;
    if (s.outcome === "qualificado") row.qualificados += 1;
    if (s.sold) {
      row.vendas += 1;
      row.receita += s.saleValue ?? 0;
    }
    sourceMap.set(key, row);
  }
  const sources = [...sourceMap.entries()].sort((a, b) => b[1].total - a[1].total);

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <main className="dash">
      <div className="dash-head">
        <h1>Dashboard do Funil</h1>
        <span className="dash-sub">
          {CONFIG.brandName} · atualiza a cada carregamento
        </span>
      </div>

      <form className="dash-filters" method="get">
        <label className="dash-filter">
          <span>De</span>
          <input type="date" name="from" defaultValue={from} max={to || undefined} />
        </label>
        <label className="dash-filter">
          <span>Até</span>
          <input type="date" name="to" defaultValue={to} min={from || undefined} />
        </label>
        <label className="dash-filter">
          <span>Mostrar</span>
          <select name="status" defaultValue={status}>
            <option value="">Todas as pessoas</option>
            <option value="finalizou">Só quem finalizou o funil</option>
            <option value="grupo">Só quem entrou no grupo</option>
          </select>
        </label>
        <button type="submit" className="dash-filter-btn">
          Filtrar
        </button>
        <a href="/dashboard" className="dash-filter-clear">
          Hoje
        </a>
        <a href="/dashboard?from=&to=" className="dash-filter-clear">
          Ver tudo
        </a>
      </form>

      <section className="dash-agenda">
        <h2 className="dash-section-title">
          Minha agenda · próximas reuniões ({upcoming.length})
        </h2>
        {upcoming.length === 0 ? (
          <p className="dash-agenda-empty">
            Nenhuma reunião marcada no momento. Quando um lead qualificado agendar,
            ela aparece aqui.
          </p>
        ) : (
          <ul className="dash-agenda-list">
            {upcoming.map((appt) => (
              <li className="dash-agenda-item" key={appt.id}>
                <span className="dash-agenda-when">{formatSlot(appt.slot)}</span>
                <span className="dash-agenda-who">
                  {appt.name ?? "Sem nome"}
                  {appt.phone ? ` · ${appt.phone}` : ""}
                  {appt.instagram ? ` · @${appt.instagram}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {total === 0 ? (
        <div className="dash-empty">
          {hasFilter
            ? "Nenhuma pessoa encontrada com esses filtros. Ajuste o período ou a situação."
            : "Ainda não há sessões registradas. Assim que alguém abrir o funil, os dados aparecem aqui."}
        </div>
      ) : (
        <>
          <section className="dash-kpis">
            <div className="dash-kpi">
              <span className="dash-kpi-label">Entraram no funil</span>
              <span className="dash-kpi-value">{total}</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Qualificados</span>
              <span className="dash-kpi-value">{qualificados}</span>
              <span className="dash-kpi-extra">{pct(qualificados)}% dos que entraram</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Agendaram reunião</span>
              <span className="dash-kpi-value">{agendaram}</span>
              <span className="dash-kpi-extra">{pct(agendaram)}% dos que entraram</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Foram pro grupo</span>
              <span className="dash-kpi-value">{grupo}</span>
              <span className="dash-kpi-extra">{pct(grupo)}% dos que entraram</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Vendas</span>
              <span className="dash-kpi-value">{vendas}</span>
              <span className="dash-kpi-extra">{pct(vendas)}% dos que entraram</span>
            </div>
            <div className="dash-kpi">
              <span className="dash-kpi-label">Receita</span>
              <span className="dash-kpi-value">{brl(receita)}</span>
              <span className="dash-kpi-extra">enviada como Purchase</span>
            </div>
          </section>

          <h2 className="dash-section-title">Origem do tráfego</h2>
          <section className="dash-funnel">
            {sources.map(([key, row]) => {
              const percent = total > 0 ? Math.round((row.total / total) * 100) : 0;
              return (
                <div className="dash-stage" key={key}>
                  <span className="dash-stage-fill" style={{ width: `${percent}%` }} />
                  <span className="dash-stage-row">
                    <span className="dash-stage-label">{key}</span>
                    <span className="dash-stage-meta">
                      <span className="dash-stage-count">{row.total}</span> · {percent}%
                      {" · "}
                      {row.qualificados} qualif.
                      {row.vendas > 0 ? ` · ${row.vendas} venda(s) (${brl(row.receita)})` : ""}
                    </span>
                  </span>
                </div>
              );
            })}
          </section>

          <h2 className="dash-section-title">Respostas por pergunta</h2>
          <section className="dash-questions">
            {choiceSteps.map((step) => {
              const answered = sessions.filter((s) => s.answers[step.id]).length;
              return (
                <div className="dash-question" key={step.id}>
                  <div className="dash-question-head">
                    <span className="dash-question-title">{step.title}</span>
                    <span className="dash-question-meta">{answered} responderam</span>
                  </div>
                  <div className="dash-funnel">
                    {step.options.map((option) => {
                      const count = sessions.filter(
                        (s) => s.answers[step.id] === option.id,
                      ).length;
                      const percent =
                        answered > 0 ? Math.round((count / answered) * 100) : 0;
                      return (
                        <div className="dash-stage" key={option.id}>
                          <span
                            className="dash-stage-fill"
                            style={{ width: `${percent}%` }}
                          />
                          <span className="dash-stage-row">
                            <span className="dash-stage-label">{option.label}</span>
                            <span className="dash-stage-meta">
                              <span className="dash-stage-count">{count}</span> · {percent}%
                            </span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          <h2 className="dash-section-title">Pessoas ({total})</h2>
          <section className="dash-people">
            {sorted.map((session) => {
              const stage = outcomeBadge(session);
              return (
                <article className="dash-person" key={session.id}>
                  <div className="dash-person-head">
                    <div>
                      <span className="dash-person-name">{session.name ?? "Sem nome"}</span>
                      <span className="dash-person-meta">
                        {session.phone ?? "sem WhatsApp"}
                        {session.instagram ? ` · @${session.instagram}` : ""}
                        {" · "}
                        {formatDate(session.updatedAt)}
                      </span>
                      <span className="dash-person-source">📍 {sourceDetail(session)}</span>
                      {session.scheduledAt ? (
                        <span className="dash-person-slot">
                          🗓️ Reunião: {formatSlot(session.scheduledAt)}
                        </span>
                      ) : null}
                    </div>
                    <div className="dash-person-tags">
                      <span className={`dash-badge is-${stage.kind}`}>{stage.label}</span>
                      {session.sold ? (
                        <span className="dash-badge is-checkout">Cliente</span>
                      ) : null}
                    </div>
                  </div>

                  <SaleButton
                    sessionId={session.id}
                    sold={session.sold}
                    saleValue={session.saleValue}
                  />

                  <dl className="dash-answers">
                    {detailSteps.map((step) => {
                      const value = answerDisplay(step, session);
                      if (!value) return null;
                      return (
                        <div className="dash-answer" key={step.id}>
                          <dt className="dash-answer-q">{labelForStep(step)}</dt>
                          <dd className="dash-answer-a">{value}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
