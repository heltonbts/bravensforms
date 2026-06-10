"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG } from "@/lib/funnel-config";

type Answers = Record<string, string>;
type SubmitState = "idle" | "submitting" | "success" | "error";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function track(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", event, params);
  }
}

function buildWhatsappUrl(name: string) {
  const message = CONFIG.whatsapp.message.replace("{nome}", name.trim());
  return `https://wa.me/${CONFIG.whatsapp.number}?text=${encodeURIComponent(message)}`;
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

export default function Home() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [resultReady, setResultReady] = useState(false);
  const sessionIdRef = useRef("");

  // Envia um evento de sessão para o backend (rastreio do funil no dashboard).
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
    trackEvent("start", { stepIndex: 0, stepId: CONFIG.steps[0]?.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Registra a etapa mais avançada + as respostas já coletadas até aqui.
  useEffect(() => {
    trackEvent("step", {
      stepIndex: currentStep,
      stepId: CONFIG.steps[currentStep]?.id,
      answers,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // "Analisando respostas" antes de revelar o diagnóstico + oferta.
  useEffect(() => {
    if (submitState === "success") {
      setResultReady(false);
      const timer = setTimeout(() => setResultReady(true), 1600);
      return () => clearTimeout(timer);
    }
  }, [submitState]);

  const step = CONFIG.steps[currentStep];
  const isLastStep = currentStep === CONFIG.steps.length - 1;
  const progress = useMemo(
    () => Math.round(((currentStep + 1) / CONFIG.steps.length) * 100),
    [currentStep],
  );

  const currentAnswer = answers[step.id] ?? "";
  const canContinue = currentAnswer.trim().length > 0;

  // Resultado personalizado montado a partir das respostas do quiz.
  const leadName = (answers.nome ?? "").trim();
  const objetivoText = CONFIG.result.objetivoFeedback[answers.objetivo ?? ""] ?? "";
  const desafioText = CONFIG.result.desafioFeedback[answers.desafio ?? ""] ?? "";
  // CTA principal vai pro checkout; se não houver, cai no WhatsApp.
  const ctaHref = CONFIG.checkoutUrl || whatsappUrl;
  const timelineSubtitle =
    CONFIG.result.timeline.subtitleByObjetivo[answers.objetivo ?? ""] ?? "";

  function updateAnswer(stepId: string, value: string) {
    setMessage("");
    setSubmitState("idle");
    setAnswers((current) => ({ ...current, [stepId]: value }));
  }

  function goBack() {
    if (currentStep === 0 || submitState === "submitting") return;
    setMessage("");
    setSubmitState("idle");
    setCurrentStep((index) => index - 1);
  }

  async function submitLead(finalAnswers: Answers) {
    setSubmitState("submitting");

    const response = await fetch(CONFIG.leadEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandName: CONFIG.brandName,
        answers: finalAnswers,
        submittedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error("Lead request failed");
    }

    track("Lead", { content_name: "Método Nutrido Para Sempre" });
    trackEvent("result", { answers: finalAnswers });
    setWhatsappUrl(buildWhatsappUrl(finalAnswers.nome ?? ""));
    setSubmitState("success");
  }

  async function handleNext(event?: FormEvent) {
    event?.preventDefault();

    if (!canContinue) {
      setMessage(CONFIG.texts.required);
      return;
    }

    if (!isLastStep) {
      setCurrentStep((index) => index + 1);
      return;
    }

    try {
      await submitLead(answers);
    } catch {
      setSubmitState("error");
      setMessage(CONFIG.texts.errorText);
    }
  }

  return (
    <main className="page-shell">
      <section className="quiz-shell" aria-label={`${CONFIG.brandName} Quiz`}>
        <header className="quiz-header">
          <div className="header-row">
            <button
              className="back-button"
              type="button"
              onClick={goBack}
              disabled={currentStep === 0 || submitState === "submitting"}
              aria-label={CONFIG.texts.backLabel}
              title={CONFIG.texts.backLabel}
            >
              <ArrowLeftIcon />
            </button>

            <div className="brand" aria-label={CONFIG.brandName}>
              {CONFIG.logoUrl ? (
                // Personalize a logo em CONFIG.logoUrl.
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

          <div className="progress-bar" aria-label={`Progresso ${progress}%`}>
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </header>

        {submitState === "success" ? (
          resultReady ? (
            <div className="step-container result-screen">
              <p className="eyebrow">Seu resultado</p>
              <h1 className="step-title">
                {CONFIG.result.headline.replace("{nome}", leadName)}
              </h1>
              <p className="step-subtitle">{CONFIG.result.intro}</p>

              <ul className="diagnosis">
                {objetivoText ? <li>{objetivoText}</li> : null}
                {desafioText ? <li>{desafioText}</li> : null}
              </ul>

              <section className="timeline" aria-label={CONFIG.result.timeline.title}>
                <h2 className="block-title">{CONFIG.result.timeline.title}</h2>
                {timelineSubtitle ? (
                  <p className="block-subtitle">{timelineSubtitle}</p>
                ) : null}
                <ol className="timeline-list">
                  {CONFIG.result.timeline.steps.map((tstep) => (
                    <li className="timeline-item" key={tstep.period}>
                      <span className="timeline-period">{tstep.period}</span>
                      <span className="timeline-text">{tstep.text}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="social-proof" aria-label={CONFIG.result.social.title}>
                <h2 className="social-title">{CONFIG.result.social.title}</h2>
                <p className="social-subtitle">{CONFIG.result.social.subtitle}</p>
                <div className="social-track">
                  {CONFIG.result.social.images.map((src) => (
                    <figure className="social-item" key={src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="social-img" src={src} alt="Transformação de aluno" loading="lazy" />
                    </figure>
                  ))}
                </div>
                <p className="social-disclaimer">{CONFIG.result.social.disclaimer}</p>
              </section>

              <section className="objections" aria-label={CONFIG.result.objections.title}>
                <h2 className="block-title">{CONFIG.result.objections.title}</h2>
                <ul className="objection-list">
                  {CONFIG.result.objections.items.map((obj) => (
                    <li className="objection-item" key={obj.q}>
                      <span className="objection-q">{obj.q}</span>
                      <span className="objection-a">{obj.a}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="how-it-works" aria-label={CONFIG.result.howItWorks.title}>
                <h2 className="block-title">{CONFIG.result.howItWorks.title}</h2>
                <ol className="how-list">
                  {CONFIG.result.howItWorks.steps.map((hstep, index) => (
                    <li className="how-item" key={hstep.title}>
                      <span className="how-num" aria-hidden="true">
                        {index + 1}
                      </span>
                      <span className="how-main">
                        <span className="how-title">{hstep.title}</span>
                        <span className="how-text">{hstep.text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <div className="offer-card">
                <span className="offer-badge">{CONFIG.result.offer.badge}</span>
                <h2 className="offer-title">{CONFIG.result.offer.title}</h2>
                <p className="offer-anchor">{CONFIG.result.offer.valueAnchor}</p>
                <ul className="offer-items">
                  {CONFIG.result.offer.items.map((item) => (
                    <li key={item}>
                      <span className="offer-check" aria-hidden="true">
                        <CheckIcon />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                {CONFIG.result.offer.bonuses.length > 0 ? (
                  <div className="offer-bonus">
                    <span className="offer-bonus-title">
                      {CONFIG.result.offer.bonusTitle}
                    </span>
                    <ul className="offer-bonus-list">
                      {CONFIG.result.offer.bonuses.map((bonus) => (
                        <li key={bonus}>🎁 {bonus}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <p className="offer-delivery">{CONFIG.result.offer.delivery}</p>
                <div className="offer-price">
                  <span className="offer-price-col">
                    <span className="offer-price-from">{CONFIG.result.offer.priceFrom}</span>
                    <span className="offer-price-to">{CONFIG.result.offer.priceTo}</span>
                  </span>
                  {CONFIG.result.offer.discountLabel ? (
                    <span className="offer-discount">{CONFIG.result.offer.discountLabel}</span>
                  ) : null}
                </div>
                {ctaHref ? (
                  <a
                    className="btn-primary"
                    href={ctaHref}
                    onClick={() => {
                      track("InitiateCheckout");
                      trackEvent("checkout");
                    }}
                  >
                    {CONFIG.result.offer.ctaLabel}
                  </a>
                ) : null}
                <p className="offer-guarantee">{CONFIG.result.offer.guarantee}</p>
                {whatsappUrl ? (
                  <a
                    className="offer-whatsapp"
                    href={whatsappUrl}
                    onClick={() => {
                      track("Contact");
                      trackEvent("whatsapp");
                    }}
                  >
                    {CONFIG.result.offer.whatsappLabel}
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="step-container analyzing-screen" role="status">
              <div className="spinner" aria-hidden="true" />
              <p className="analyzing-text">{CONFIG.texts.analyzing}</p>
            </div>
          )
        ) : (
        <div className="step-container" key={step.id}>
          <p className="eyebrow">
            Etapa {currentStep + 1} de {CONFIG.steps.length}
          </p>
          <h1 className="step-title">{step.title}</h1>
          {step.subtitle ? <p className="step-subtitle">{step.subtitle}</p> : null}

          {step.type === "single" ? (
            <>
              <div className="options-grid" role="radiogroup" aria-label={step.title}>
                {step.options.map((option) => {
                  const isActive = currentAnswer === option.id;

                  return (
                    <button
                      className={`quiz-card${option.image ? " has-media" : ""}${
                        isActive ? " active" : ""
                      }`}
                      type="button"
                      key={option.id}
                      onClick={() => updateAnswer(step.id, option.id)}
                      role="radio"
                      aria-checked={isActive}
                    >
                      {option.image ? (
                        // Personalize imagens das opções em CONFIG.steps[].options[].image.
                        <img className="quiz-card-media" src={option.image} alt="" />
                      ) : null}
                      <span className="quiz-card-main">
                        <span className="quiz-card-title">{option.label}</span>
                        {option.description ? (
                          <span className="quiz-card-description">{option.description}</span>
                        ) : null}
                      </span>
                      <span className="quiz-card-indicator">
                        <CheckIcon />
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="actions">
                <button
                  className="btn-primary"
                  type="button"
                  onClick={() => handleNext()}
                  disabled={submitState === "submitting"}
                >
                  {isLastStep ? CONFIG.texts.submit : CONFIG.texts.next}
                </button>
              </div>
            </>
          ) : (
            <form className="form-block" onSubmit={handleNext}>
              <input
                className="form-input"
                type={step.type === "phone" ? "tel" : "text"}
                inputMode={step.type === "phone" ? "tel" : "text"}
                autoComplete={step.type === "phone" ? "tel" : "name"}
                placeholder={step.placeholder}
                required={step.required}
                value={currentAnswer}
                onChange={(event) =>
                  updateAnswer(
                    step.id,
                    step.type === "phone" ? applyPhoneMask(event.target.value) : event.target.value,
                  )
                }
              />

              <div className="actions">
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={submitState === "submitting"}
                >
                  {submitState === "submitting"
                    ? CONFIG.texts.submitting
                    : isLastStep
                      ? CONFIG.texts.submit
                      : CONFIG.texts.next}
                </button>
              </div>
            </form>
          )}

          {message ? <p className="message">{message}</p> : null}

          {submitState === "error" ? (
            <div className="result-panel" role="alert">
              <h2>{CONFIG.texts.errorTitle}</h2>
              <p>{CONFIG.texts.errorText}</p>
            </div>
          ) : null}
        </div>
        )}
      </section>
    </main>
  );
}
