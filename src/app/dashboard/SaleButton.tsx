"use client";

import { useState } from "react";

type Props = {
  sessionId: string;
  sold: boolean;
  saleValue: number | null;
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

export function SaleButton({ sessionId, sold, saleValue }: Props) {
  const [done, setDone] = useState(sold);
  const [savedValue, setSavedValue] = useState<number | null>(saleValue);
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [warn, setWarn] = useState("");

  if (done) {
    return (
      <div className="dash-sale">
        <span className="dash-sold">
          💰 Venda registrada{savedValue != null ? ` · ${formatBRL(savedValue)}` : ""}
        </span>
        {warn ? <span className="dash-sale-warn">{warn}</span> : null}
      </div>
    );
  }

  async function fire() {
    const n = Number(value.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      setState("error");
      return;
    }
    setState("saving");
    setWarn("");
    try {
      const res = await fetch("/api/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, value: n }),
      });
      if (!res.ok) throw new Error("falhou");
      const data = (await res.json()) as { sentToFacebook?: boolean };
      setSavedValue(n);
      setDone(true);
      if (!data.sentToFacebook) {
        setWarn("Salvo, mas o Pixel/CAPI ainda não está configurado.");
      }
    } catch {
      setState("error");
    }
  }

  return (
    <div className="dash-sale">
      <input
        className="dash-sale-input"
        type="text"
        inputMode="decimal"
        placeholder="Valor (R$)"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (state === "error") setState("idle");
        }}
      />
      <button
        className="dash-sale-btn"
        type="button"
        onClick={fire}
        disabled={state === "saving"}
      >
        {state === "saving" ? "Enviando..." : "Disparar venda"}
      </button>
      {state === "error" ? (
        <span className="dash-sale-warn">Informe um valor válido.</span>
      ) : null}
    </div>
  );
}
