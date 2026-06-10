export type QuizOption = {
  id: string;
  label: string;
  description?: string;
  image?: string;
};

export type QuizStep =
  | {
      id: string;
      type: "single";
      title: string;
      subtitle?: string;
      options: QuizOption[];
    }
  | {
      id: string;
      type: "text" | "phone";
      title: string;
      subtitle?: string;
      placeholder: string;
      required?: boolean;
    };

type FunnelConfig = {
  brandName: string;
  logoUrl: string;
  leadEndpoint: string;

  // Pixel do Facebook: cole aqui o ID do seu Pixel (ex.: "1234567890").
  // Deixe vazio para desativar o rastreamento em ambiente de testes.
  facebookPixelId: string;

  // Checkout: link da plataforma (Hotmart/Kiwify/etc) onde a compra é feita.
  // É o destino do CTA principal. Deixe vazio para cair no WhatsApp.
  checkoutUrl: string;

  // WhatsApp usado como canal de DÚVIDAS (CTA secundário), não para pagar.
  whatsapp: {
    // Número em formato internacional, só dígitos: 55 + DDD + número.
    // CONFIRMAR o número público do bot. (Ex.: "5588992972504")
    number: string;
    // Mensagem pré-preenchida. {nome} é substituído pela resposta do lead.
    message: string;
  };

  texts: {
    next: string;
    submit: string;
    submitting: string;
    backLabel: string;
    required: string;
    analyzing: string;
    errorTitle: string;
    errorText: string;
  };

  // Tela de resultado: diagnóstico personalizado + oferta de venda.
  result: {
    // {nome} é substituído pela resposta do lead.
    headline: string;
    intro: string;
    // Frases montadas a partir das respostas (chave = id da opção escolhida).
    objetivoFeedback: Record<string, string>;
    desafioFeedback: Record<string, string>;
    // Linha do tempo: jornada projetada nos próximos 90 dias.
    timeline: {
      title: string;
      // Linha de abertura por objetivo (chave = id da opção).
      subtitleByObjetivo: Record<string, string>;
      steps: { period: string; text: string }[];
    };
    // Quebra de objeção: "será que funciona pra mim?".
    objections: {
      title: string;
      items: { q: string; a: string }[];
    };
    // Mecanismo em 3 passos.
    howItWorks: {
      title: string;
      steps: { title: string; text: string }[];
    };
    // Prova social: transformações reais de alunos.
    social: {
      title: string;
      subtitle: string;
      images: string[];
      disclaimer: string;
    };
    offer: {
      badge: string;
      title: string;
      valueAnchor: string;
      items: string[];
      bonusTitle: string;
      bonuses: string[];
      delivery: string;
      priceFrom: string;
      priceTo: string;
      discountLabel: string;
      ctaLabel: string;
      whatsappLabel: string;
      guarantee: string;
    };
  };

  steps: QuizStep[];
};

export const CONFIG: FunnelConfig = {
  brandName: "Nutrido Para Sempre",

  // Deixe vazio para usar apenas o nome da marca. Coloque a URL da logo se tiver.
  logoUrl: "",

  leadEndpoint: "/api/leads",

  // SUBSTITUA pelo ID do seu Pixel do Facebook.
  facebookPixelId: "",

  // SUBSTITUA pelo link do checkout (Hotmart/Kiwify/etc). Vazio = cai no WhatsApp.
  checkoutUrl: "",

  whatsapp: {
    // SUBSTITUA pelo número público do WhatsApp do bot (formato internacional).
    number: "5588992972504",
    message:
      "Oi! Fiz o quiz e quero GARANTIR minha dieta personalizada do Método Nutrido Para Sempre pela promoção de R$ 39,90. Meu nome é {nome}.",
  },

  texts: {
    next: "Continuar",
    submit: "Ver meu resultado",
    submitting: "Enviando...",
    backLabel: "Voltar",
    required: "Selecione ou preencha uma resposta para continuar.",
    analyzing: "Analisando suas respostas e montando seu plano...",
    errorTitle: "Não foi possível enviar",
    errorText: "Tente novamente em alguns instantes.",
  },

  result: {
    headline: "{nome}, seu plano personalizado está pronto para ser montado",
    intro: "Com base nas suas respostas, foi isso que identificamos:",
    objetivoFeedback: {
      emagrecer:
        "Seu foco é emagrecer com saúde — sem passar fome e sem dieta maluca.",
      "ganhar-massa":
        "Seu foco é ganhar massa muscular com a alimentação certa para evoluir.",
      reeducacao:
        "Você quer reeducação alimentar de verdade e dar adeus ao efeito sanfona.",
      saude: "Você quer mais disposição e saúde no seu dia a dia.",
    },
    desafioFeedback: {
      "nao-sei-comer":
        "Como você sente que não sabe o que comer, sua dieta vem com cada refeição definida — sem achismo.",
      "falta-tempo":
        "Como seu tempo é curto, montamos um plano prático, com opções rápidas e guia de compras pronto.",
      "dietas-genericas":
        "Cardápios genéricos não funcionaram porque não eram feitos pra você. O seu é 100% personalizado: seus gostos e sua rotina.",
      constancia:
        "Para resolver a falta de constância, você tem 1 mês de suporte e ajustes nos 7 primeiros dias — você não fica sozinho(a).",
    },
    timeline: {
      title: "Você já começa hoje mesmo",
      subtitleByObjetivo: {
        emagrecer: "Nada de esperar meses pra começar a emagrecer com saúde:",
        "ganhar-massa": "Nada de esperar meses pra começar a ganhar massa:",
        reeducacao: "Nada de esperar meses pra mudar sua alimentação:",
        saude: "Nada de esperar meses pra ter mais disposição:",
      },
      steps: [
        {
          period: "Hoje",
          text: "Você garante seu plano e preenche a anamnese com seus gostos e sua rotina.",
        },
        {
          period: "Em até 24h",
          text: "Sua dieta 100% personalizada chega direto no seu WhatsApp.",
        },
        {
          period: "Já nos primeiros dias",
          text: "Você sabe exatamente o que comer — sem improviso e sem cardápio genérico.",
        },
      ],
    },
    objections: {
      title: "Será que funciona pra mim?",
      items: [
        {
          q: "Tenho uma rotina muito corrida",
          a: "A dieta é montada pra caber na sua rotina, com opções práticas e rápidas.",
        },
        {
          q: "Já tentei de tudo e não funcionou",
          a: "Cardápios genéricos não funcionam. O seu é feito a partir dos seus gostos e da sua realidade.",
        },
        {
          q: "Não sei (ou não gosto de) cozinhar",
          a: "Você recebe o guia de compras e opções simples — nada de receita complicada.",
        },
        {
          q: "Tenho restrição ou alimentos que não gosto",
          a: "Você informa tudo na anamnese e a equipe monta respeitando suas restrições e preferências.",
        },
      ],
    },
    howItWorks: {
      title: "Como funciona",
      steps: [
        {
          title: "Você preenche a anamnese",
          text: "Conta seus gostos, sua rotina e seu objetivo no link que recebe após a compra.",
        },
        {
          title: "Nossa equipe monta sua dieta",
          text: "Um plano 100% personalizado, feito pra você — não é cardápio pronto da internet.",
        },
        {
          title: "Você recebe em até 24h",
          text: "A dieta chega no seu WhatsApp, com 1 mês de suporte e ajustes nos 7 primeiros dias.",
        },
      ],
    },
    social: {
      title: "Transformações reais de quem seguiu o plano",
      subtitle:
        "Alunos do Método Nutrido Para Sempre que mudaram a alimentação e a rotina.",
      images: [
        "/transformacoes/7.webp",
        "/transformacoes/1.webp",
        "/transformacoes/2.webp",
        "/transformacoes/3.webp",
        "/transformacoes/4.webp",
        "/transformacoes/5.webp",
        "/transformacoes/6.webp",
        "/transformacoes/8.webp",
        "/transformacoes/9.webp",
        "/transformacoes/10.webp",
      ],
      disclaimer:
        "Resultados variam de pessoa para pessoa e dependem do comprometimento individual.",
    },
    offer: {
      badge: "Promo de inauguração",
      title: "Método Nutrido Para Sempre",
      valueAnchor:
        "Plano feito sob medida pela nossa equipe — não é cardápio genérico de internet.",
      items: [
        "Dieta 100% personalizada, feita pela nossa equipe",
        "Guia de compras + materiais de apoio",
        "1 rodada de ajustes nos 7 primeiros dias",
        "Suporte por WhatsApp durante 30 dias",
      ],
      // SUGESTÃO de bônus — confirme/ajuste conforme o que vocês entregam de verdade.
      bonusTitle: "E ainda leva de bônus:",
      bonuses: [
        "Lista de substituições de alimentos",
        "Guia de receitas práticas",
        "Acesso ao grupo de acompanhamento",
      ],
      delivery:
        "Após o pagamento você recebe o link da anamnese, preenche e em até 24h sua dieta chega no WhatsApp.",
      priceFrom: "R$ 89,90",
      priceTo: "R$ 39,90",
      discountLabel: "-56%",
      ctaLabel: "Quero garantir por R$ 39,90",
      whatsappLabel: "Prefere tirar uma dúvida antes? Fale no WhatsApp",
      guarantee:
        "Compra 100% segura no checkout. Garantia de 7 dias — não gostou, devolvemos seu dinheiro.",
    },
  },

  steps: [
    {
      id: "objetivo",
      type: "single",
      title: "Qual é o seu principal objetivo hoje?",
      subtitle: "Sua dieta será montada a partir da sua resposta.",
      options: [
        {
          id: "emagrecer",
          label: "Emagrecer",
          description: "Perder peso de forma saudável e sustentável.",
        },
        {
          id: "ganhar-massa",
          label: "Ganhar massa muscular",
          description: "Definir e construir músculos com a alimentação certa.",
        },
        {
          id: "reeducacao",
          label: "Reeducação alimentar",
          description: "Criar hábitos que duram e parar com o efeito sanfona.",
        },
        {
          id: "saude",
          label: "Mais disposição e saúde",
          description: "Comer melhor para ter energia no dia a dia.",
        },
      ],
    },
    {
      id: "desafio",
      type: "single",
      title: "O que mais te atrapalha na alimentação?",
      subtitle: "Assim entendemos como te ajudar de verdade.",
      options: [
        {
          id: "nao-sei-comer",
          label: "Não sei o que comer",
          description: "Fico perdido(a) na hora de montar as refeições.",
        },
        {
          id: "falta-tempo",
          label: "Falta de tempo pra cozinhar",
          description: "Minha rotina é corrida e complica tudo.",
        },
        {
          id: "dietas-genericas",
          label: "Dietas genéricas não funcionam",
          description: "Já tentei cardápios prontos e não me adaptei.",
        },
        {
          id: "constancia",
          label: "Falta de constância",
          description: "Começo animado(a) mas não consigo manter.",
        },
      ],
    },
    {
      id: "momento",
      type: "single",
      title: "Quando você quer começar?",
      subtitle: "Sem compromisso — é só pra entender o seu momento.",
      options: [
        {
          id: "agora",
          label: "Quero começar agora",
          description: "Estou decidido(a) a mudar.",
        },
        {
          id: "em-breve",
          label: "Nas próximas semanas",
          description: "Quero me organizar primeiro.",
        },
        {
          id: "pesquisando",
          label: "Só pesquisando",
          description: "Ainda estou avaliando.",
        },
      ],
    },
    {
      id: "nome",
      type: "text",
      title: "Como podemos te chamar?",
      subtitle: "Vamos usar seu nome no atendimento.",
      placeholder: "Digite seu nome",
      required: true,
    },
    {
      id: "telefone",
      type: "phone",
      title: "Qual é o seu WhatsApp?",
      subtitle: "É por aqui que você recebe sua dieta personalizada.",
      placeholder: "(00) 00000-0000",
      required: true,
    },
  ],
};
