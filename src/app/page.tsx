"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CONFIG, type Outcome, type QuizStep } from "@/lib/funnel-config";

type Answers = Record<string, string>;
type Phase = "cover" | "quiz" | "qualificado" | "grupo";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function track(
  event: string,
  params?: Record<string, unknown>,
  eventId?: string,
) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    if (eventId) window.fbq("track", event, params, { eventID: eventId });
    else window.fbq("track", event, params);
  }
}

// Evento customizado (não otimizável) — usado só para relatório.
function trackCustom(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("trackCustom", event, params);
  }
}

function splitName(full: string) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

// Dispara a conversão NO NAVEGADOR (Pixel) e NO SERVIDOR (CAPI) com o MESMO
// event_id, pra o Facebook deduplicar. Garante entrega mesmo com bloqueador.
function fireConversion(
  event: string,
  data: Record<string, string>,
  extra: { value?: number; currency?: string } = {},
) {
  const eventId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());
  const { firstName, lastName } = splitName(data.nome ?? "");

  track(event, { content_name: CONFIG.brandName, ...extra }, eventId);

  fetch("/api/conversion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      eventId,
      email: data.email ?? "",
      phone: data.telefone ?? "",
      firstName,
      lastName,
      ...extra,
    }),
    keepalive: true,
  }).catch(() => {});
}

function buzz() {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(12);
  }
}

function ArrowLeftIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19 12H5m0 0 7 7M5 12l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m20 6-11 11-5-5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function applyPhoneMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Monta a URL do Calendly embutido, já com os dados do lead preenchidos.
function calendlyEmbedUrl(answers: Answers) {
  const url = new URL(CONFIG.qualified.calendarUrl);
  if (answers.nome) url.searchParams.set("name", answers.nome.trim());
  if (answers.email) url.searchParams.set("email", answers.email.trim());
  url.searchParams.set("hide_gdpr_banner", "1");
  if (typeof window !== "undefined") {
    url.searchParams.set("embed_domain", window.location.host);
    url.searchParams.set("embed_type", "Inline");
  }
  return url.toString();
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("cover");
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [message, setMessage] = useState("");
  const sessionIdRef = useRef("");

  const steps = CONFIG.steps;
  const step = steps[currentStep];

  function trackEvent(type: string, extra?: Record<string, unknown>) {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, type, ...extra }),
      keepalive: true,
    }).catch(() => {});
  }

  // Cria/recupera o ID da sessão e marca a entrada no funil.
  useEffect(() => {
    let id = sessionStorage.getItem("funnel_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("funnel_sid", id);
    }
    sessionIdRef.current = id;
    trackEvent("start", { stepIndex: -1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registra avanço de etapa no dashboard.
  useEffect(() => {
    if (phase === "quiz" && step) {
      trackEvent("step", { stepIndex: currentStep, stepId: step.id, answers });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, phase]);

  // Detecta quando o lead agenda de fato no Calendly (evento via postMessage).
  useEffect(() => {
    if (phase !== "qualificado") return;
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (
        data &&
        typeof data === "object" &&
        (data as { event?: string }).event === "calendly.event_scheduled"
      ) {
        // Sinal mais forte do funil: agendou de fato. Dispara Pixel + CAPI.
        fireConversion("Schedule", answers);
        trackEvent("schedule");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const progress =
    steps.length > 0 ? Math.round(((currentStep + 1) / steps.length) * 100) : 0;

  function startQuiz() {
    buzz();
    setCurrentStep(0);
    setPhase("quiz");
    track("StartQuiz");
  }

  function setAnswer(stepId: string, value: string) {
    setAnswers((current) => ({ ...current, [stepId]: value }));
  }

  function advance() {
    setMessage("");
    if (currentStep < steps.length - 1) {
      setCurrentStep((index) => index + 1);
    }
  }

  function goBack() {
    setMessage("");
    if (phase !== "quiz") return;
    if (currentStep === 0) {
      setPhase("cover");
      return;
    }
    setCurrentStep((index) => index - 1);
  }

  // Encerra o quiz num desfecho: salva o lead e abre a tela final.
  async function finishWith(outcome: Outcome, finalAnswers: Answers) {
    const withOutcome = { ...finalAnswers, outcome };
    setAnswers(withOutcome);
    setPhase(outcome);
    trackEvent("outcome", { outcome, answers: withOutcome });

    // Otimização: SÓ o lead qualificado conta como "Lead" pro Facebook, pra a
    // campanha aprender a trazer mais gente desse perfil (e não lead frio).
    // O desqualificado vira evento customizado só pra relatório.
    if (outcome === "qualificado") {
      fireConversion("Lead", withOutcome);
    } else {
      trackCustom("LeadDesqualificado", { content_name: CONFIG.brandName });
    }

    // Persiste o lead no banco (todos os contatos, qualificado ou não).
    try {
      await fetch(CONFIG.leadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: CONFIG.brandName,
          outcome,
          answers: withOutcome,
          submittedAt: new Date().toISOString(),
        }),
        keepalive: true,
      });
    } catch {
      // O lead já viu a tela final; o erro de rede não trava a experiência.
    }
  }

  // Seleção em etapa de escolha única: marca e ou avança ou encerra no desfecho.
  function pickSingle(
    stepDef: Extract<QuizStep, { type: "single" }>,
    optionId: string,
  ) {
    buzz();
    const next = { ...answers, [stepDef.id]: optionId };
    setAnswers(next);
    const option = stepDef.options.find((o) => o.id === optionId);
    setTimeout(() => {
      if (option?.outcome) {
        finishWith(option.outcome, next);
      } else {
        advance();
      }
    }, 240);
  }

  function handleFieldNext(event: FormEvent) {
    event.preventDefault();
    if (!step || step.type === "single") return;
    const value = (answers[step.id] ?? "").trim();

    if (value.length === 0) {
      setMessage(CONFIG.texts.required);
      return;
    }
    if (step.type === "phone" && value.replace(/\D/g, "").length < 10) {
      setMessage(CONFIG.texts.invalidPhone);
      return;
    }
    if (step.type === "email" && !EMAIL_RE.test(value)) {
      setMessage(CONFIG.texts.invalidEmail);
      return;
    }
    advance();
  }

  const leadName = (answers.nome ?? "").trim();
  const showProgress = phase === "quiz";

  return (
    <main className="page-shell">
      <section className="quiz-shell" aria-label={`${CONFIG.brandName}`}>
        <header className="quiz-header">
          <div className="header-row">
            <button
              className="back-button"
              type="button"
              onClick={goBack}
              disabled={phase !== "quiz"}
              aria-label={CONFIG.texts.backLabel}
              title={CONFIG.texts.backLabel}
            >
              <ArrowLeftIcon />
            </button>

            <div className="brand" aria-label={CONFIG.brandName}>
              {CONFIG.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="brand-logo" src={CONFIG.logoUrl} alt="" />
              ) : (
                <span className="brand-fallback" aria-hidden="true">
                  {CONFIG.brandName.slice(0, 1)}
                </span>
              )}
              <span>{CONFIG.brandName}</span>
            </div>

            <span aria-hidden="true" />
          </div>

          {showProgress ? (
            <div className="progress-bar" aria-label={`Progresso ${progress}%`}>
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
          ) : null}
        </header>

        {/* ===== Capa (venda) ===== */}
        {phase === "cover" ? (
          <div className="step-container">
            <p className="eyebrow">{CONFIG.cover.eyebrow}</p>
            <h1 className="step-title">{CONFIG.cover.title}</h1>

            <ul className="intro-bullets">
              {CONFIG.cover.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>

            <p className="cover-highlight">→ {CONFIG.cover.highlight}</p>

            <div className="actions">
              <button className="btn-primary" type="button" onClick={startQuiz}>
                {CONFIG.cover.cta}
              </button>
            </div>
          </div>
        ) : null}

        {/* ===== Etapas do quiz ===== */}
        {phase === "quiz" && step ? (
          <div className="step-container" key={step.id}>
            <h1 className="step-title">{step.title}</h1>
            {step.subtitle ? (
              <p className="step-subtitle">{step.subtitle}</p>
            ) : null}

            {step.type === "single" ? (
              <div className="options-grid" role="radiogroup">
                {step.options.map((option) => {
                  const isActive = answers[step.id] === option.id;
                  return (
                    <button
                      className={`quiz-card${isActive ? " active" : ""}`}
                      type="button"
                      key={option.id}
                      onClick={() => pickSingle(step, option.id)}
                      role="radio"
                      aria-checked={isActive}
                    >
                      <span className="quiz-card-main">
                        <span className="quiz-card-title">{option.label}</span>
                        {option.description ? (
                          <span className="quiz-card-description">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="quiz-card-indicator">
                        <CheckIcon />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <form className="form-block" onSubmit={handleFieldNext}>
                <input
                  className="form-input"
                  type={
                    step.type === "phone"
                      ? "tel"
                      : step.type === "email"
                        ? "email"
                        : "text"
                  }
                  inputMode={
                    step.type === "phone"
                      ? "tel"
                      : step.type === "email"
                        ? "email"
                        : "text"
                  }
                  autoComplete={
                    step.type === "phone"
                      ? "tel"
                      : step.type === "email"
                        ? "email"
                        : step.id === "nome"
                          ? "name"
                          : "off"
                  }
                  placeholder={step.placeholder}
                  required={step.required}
                  value={answers[step.id] ?? ""}
                  onChange={(event) =>
                    setAnswer(
                      step.id,
                      step.type === "phone"
                        ? applyPhoneMask(event.target.value)
                        : event.target.value,
                    )
                  }
                  autoFocus
                />
                <div className="actions">
                  <button className="btn-primary" type="submit">
                    {CONFIG.texts.next}
                  </button>
                </div>
              </form>
            )}

            {step.note ? <p className="step-note">{step.note}</p> : null}
            {message ? <p className="message">{message}</p> : null}
          </div>
        ) : null}

        {/* ===== Tela final A — lead QUALIFICADO (agenda) ===== */}
        {phase === "qualificado" ? (
          <div className="step-container">
            <p className="eyebrow">{CONFIG.qualified.eyebrow}</p>
            <h1 className="step-title">{CONFIG.qualified.title}</h1>
            <p className="step-subtitle">{CONFIG.qualified.subtitle}</p>

            <iframe
              className="calendar-embed"
              title="Agendar reunião"
              src={calendlyEmbedUrl(answers)}
            />

            <p className="cta-note">{CONFIG.qualified.footnote}</p>
          </div>
        ) : null}

        {/* ===== Tela final B — lead DESQUALIFICADO (grupo) ===== */}
        {phase === "grupo" ? (
          <div className="step-container">
            <p className="eyebrow">{CONFIG.group.eyebrow}</p>
            <h1 className="step-title">{CONFIG.group.title}</h1>
            <p className="step-subtitle">{CONFIG.group.body}</p>

            <div className="actions">
              <a
                className="btn-primary cta-final"
                href={CONFIG.group.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  track("Contact", { method: "whatsapp_group" });
                  trackEvent("groupclick");
                }}
              >
                {CONFIG.group.cta}
              </a>
            </div>

            {leadName ? (
              <p className="cta-note">Valeu, {leadName.split(" ")[0]}! 👊</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
