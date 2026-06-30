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
    footnote: string;
  };

  // Regras da agenda própria (sem Calendly). Horários em fuso de Brasília.
  scheduling: {
    durationMinutes: number; // duração de cada reunião / passo entre horários
    // Dias da semana liberados (0 = domingo ... 6 = sábado).
    weekdays: number[];
    startHour: number; // primeiro horário do dia (ex.: 9 = 09:00)
    endHour: number; // horário em que o último slot precisa terminar (ex.: 18)
    daysAhead: number; // quantos dias à frente abrir a agenda
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
    eyebrow: "Tráfego para restaurantes · Bravens Mídia",
    title: "🍕 Dono de restaurante, aumente seu faturamento com tráfego especializado em foodservice.",
    bullets: [
      "🛵 Cozinha movimentada todos os dias",
      "🏆 Método validado",
      "📱 Fortaleça seu cardápio digital próprio",
      "💸 R$1MM/mês faturados pelos nossos clientes",
    ],
    highlight:
      "Exclusivo para donos de restaurante que querem faturar mais e aumentar o número de pedidos.",
    cta: "QUERO VENDER MAIS →",
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
      subtitle: "Digite somente o nome de usuário, sem o @ e sem espaços, por favor.",
      placeholder: "seuusuario",
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
      note: "Fica tranquilo: isso não interfere no valor do nosso serviço. É só pra entender o momento do seu negócio.",
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
        "Recomendamos um investimento a partir de R$1.000 por mês em anúncios. Esse valor se alinha ao seu orçamento atual?",
      note: "Esse investimento não inclui o valor da nossa mão de obra.",
      options: [
        {
          id: "sim",
          label: "Sim! Estou pronto para elevar o meu restaurante ao próximo nível 🚀",
          outcome: "qualificado",
        },
        {
          id: "nao",
          label: "Infelizmente esse não é o momento",
          outcome: "grupo",
        },
      ],
    },
  ],

  qualified: {
    eyebrow: "Tudo certo, você foi selecionado 🎯",
    title: "Sessão estratégica de marketing (30 minutos)",
    subtitle:
      "Vamos entender seu negócio e montar o plano de marketing ideal. Escolha o melhor horário no fuso de Brasília (BRT).",
    footnote:
      "Não consegue agora? Recarregue a página para reabrir a agenda quando puder.",
  },

  scheduling: {
    durationMinutes: 30,
    // Segunda a sábado (1..6). Domingo (0) fica de fora.
    weekdays: [1, 2, 3, 4, 5, 6],
    startHour: 9,
    endHour: 18, // último horário começa às 17:30 (termina às 18:00)
    daysAhead: 14,
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
