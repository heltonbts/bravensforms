// Desfecho do funil: lead qualificado (agenda) ou desqualificado (grupo).
export type Outcome = "qualificado" | "grupo";

export type QuizOption = {
  id: string;
  label: string;
  description?: string;
  // Se definido, selecionar esta opção encerra o quiz neste desfecho.
  // Sem outcome, a opção apenas avança para a próxima etapa.
  outcome?: Outcome;
};

type StepBase = {
  id: string;
  title: string;
  subtitle?: string;
  note?: string; // observação pequena exibida abaixo do conteúdo
};

export type QuizStep =
  | (StepBase & {
      type: "text" | "phone" | "email";
      placeholder: string;
      required?: boolean;
    })
  | (StepBase & { type: "single"; options: QuizOption[] });

type FunnelConfig = {
  brandName: string;
  logoUrl: string;
  leadEndpoint: string;

  // Pixel da Bravens Mídia. Deixe vazio até ter o ID certo para NÃO
  // disparar eventos no pixel de outro projeto.
  facebookPixelId: string;

  // Tela de capa (venda) — abre o funil.
  cover: {
    eyebrow: string;
    title: string;
    bullets: string[];
    highlight: string;
    cta: string;
  };

  texts: {
    next: string;
    backLabel: string;
    required: string;
    invalidEmail: string;
    invalidPhone: string;
    errorText: string;
    submitting: string;
  };

  steps: QuizStep[];

  // Tela final A — lead QUALIFICADO (agenda de reunião).
  qualified: {
    eyebrow: string;
    title: string;
    subtitle: string;
    // URL do Calendly / Cal.com (embed). Troque pela sua agenda real.
    calendarUrl: string;
    footnote: string;
  };

  // Tela final B — lead DESQUALIFICADO (grupo de WhatsApp).
  group: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
    // Link externo do grupo de WhatsApp. Troque pelo seu convite real.
    url: string;
  };
};

export const CONFIG: FunnelConfig = {
  brandName: "Bravens Mídia",
  logoUrl: "",
  leadEndpoint: "/api/leads",

  // Pixel da Bravens Mídia. Vem do env NEXT_PUBLIC_FB_PIXEL_ID (vazio = não dispara).
  facebookPixelId: process.env.NEXT_PUBLIC_FB_PIXEL_ID ?? "",

  cover: {
    eyebrow: "Marketing completo · Bravens Mídia",
    title: "Pare com o marketing amador e tenha a estrutura que o seu negócio precisa.",
    bullets: [
      "🎯 Tráfego pago que dá retorno (ROAS)",
      "🏪 Presença local pra loja física",
      "🌐 Site, landing page e CRM",
      "🎬 Social media, vídeo e conteúdo",
    ],
    highlight:
      "Exclusivo para empresas que já investem (ou estão dispostas a investir) NO MÍNIMO R$1.500/mês em mídia.",
    cta: "PRECISO DE ESPECIALISTAS →",
  },

  texts: {
    next: "Continuar",
    backLabel: "Voltar",
    required: "Preencha para continuar.",
    invalidEmail: "Digite um email válido para continuar.",
    invalidPhone: "Confirme seu WhatsApp com DDD para continuar.",
    errorText: "Não foi possível enviar. Tente novamente em alguns instantes.",
    submitting: "Enviando...",
  },

  steps: [
    {
      id: "nome",
      type: "text",
      title: "Qual seu nome e sobrenome?",
      placeholder: "Nome e sobrenome",
      required: true,
    },
    {
      id: "telefone",
      type: "phone",
      title: "Qual seu número do WhatsApp?",
      placeholder: "(00) 00000-0000",
      required: true,
    },
    {
      id: "instagram",
      type: "text",
      title: "Qual @ do Instagram da sua empresa?",
      subtitle: "Digite somente o user, sem o @ e sem espaços, por favor.",
      placeholder: "seuusuario",
      required: true,
    },
    {
      id: "email",
      type: "email",
      title: "Qual é o seu email?",
      placeholder: "voce@empresa.com",
      required: true,
    },
    {
      id: "experiencia",
      type: "single",
      title: "Você já investe em tráfego pago hoje?",
      options: [
        { id: "eu-mesmo", label: "Sim, eu mesmo faço/gerencio" },
        { id: "contratei", label: "Sim, contratei uma pessoa ou agência" },
        { id: "nunca", label: "Ainda não invisto" },
      ],
    },
    {
      id: "faturamento",
      type: "single",
      title: "Qual o faturamento médio mensal do seu negócio?",
      note: "Obs: O seu faturamento não influencia na nossa precificação.",
      options: [
        // Lead desqualificado: vai direto pro grupo de WhatsApp.
        { id: "ate-15k", label: "Menos de R$15.000", outcome: "grupo" },
        { id: "15-30k", label: "De R$15.000 a R$30.000" },
        { id: "30-50k", label: "De R$30.000 a R$50.000" },
        { id: "50-100k", label: "De R$50.000 a R$100.000" },
        { id: "100k-mais", label: "Acima de R$100.000" },
      ],
    },
    {
      id: "investir",
      type: "single",
      title:
        "Está disposto a investir pelo menos R$1.500/mês em mídia (anúncios), desconsiderando o valor da nossa mão de obra?",
      note:
        'Caso selecione que "não", não entraremos em contato pra te convencer do contrário. Nosso foco é em empresas que entendem a importância e o impacto de um marketing bem feito.',
      options: [
        {
          id: "sim",
          label: "✅ Sim! Preciso de tráfego profissional.",
          outcome: "qualificado",
        },
        {
          id: "nao",
          label: "❌ Não quero investir no meu negócio.",
          outcome: "grupo",
        },
      ],
    },
  ],

  qualified: {
    eyebrow: "Tudo certo, você foi selecionado 🎯",
    title: "Sessão estratégica de marketing — 30 minutos",
    subtitle:
      "Vamos entender seu negócio e montar o plano de marketing ideal. Escolha o melhor horário — fuso de Brasília (BRT).",
    // Agenda real (Calendly).
    calendarUrl: "https://calendly.com/hbatista-brasil/30min",
    footnote:
      "Não consegue agora? Recarregue a página para reabrir a agenda quando puder.",
  },

  group: {
    eyebrow: "Recebemos suas informações ✅",
    title: "👋 Antes de finalizar...",
    body: "Agora nosso time vai analisar suas informações com cuidado. Enquanto isso, você já pode entrar gratuitamente no nosso grupo de WhatsApp. Lá a gente compartilha insights de marketing, tráfego e vendas, com estratégias práticas atualizadas.",
    cta: "ENTRAR NO GRUPO GRATUITO 🔗",
    // Link real de convite do grupo de WhatsApp.
    url: "https://chat.whatsapp.com/LxIgN7vKmIi8PRdS9E37sd",
  },
};
