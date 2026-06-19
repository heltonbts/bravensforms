import type { Metadata } from "next";
import { CONFIG, type QuizStep } from "@/lib/funnel-config";
import { getSessions, type Session } from "@/lib/db";
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
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const sessions = await getSessions();
  const total = sessions.length;

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

      {total === 0 ? (
        <div className="dash-empty">
          Ainda não há sessões registradas. Assim que alguém abrir o funil, os dados aparecem aqui.
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
