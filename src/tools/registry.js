export const toolsRegistry = [
  {
    name: 'Gerador de Recibo de Pagamento',
    shortName: 'Recibo',
    slug: 'gerador-de-recibo',
    path: '/ferramentas/gerador-de-recibo',
    category: 'Documentos',
    status: 'active',
    description: 'Crie recibos de pagamento em PDF de forma simples e rápida.',
    monetization: 'freemium',
    seo: {
      title: 'Gerador de Recibo de Pagamento Online em PDF',
      description: 'Crie recibos de pagamento online em poucos minutos e gere um PDF pronto para imprimir ou enviar.'
    }
  },
  {
    name: 'Gerador de Currículo',
    shortName: 'Currículo',
    slug: 'gerador-de-curriculo',
    path: '/ferramentas/gerador-de-curriculo',
    category: 'Carreira',
    status: 'active',
    description: 'Monte um currículo simples e profissional para baixar em PDF.',
    monetization: 'freemium',
    seo: {
      title: 'Gerador de Currículo Online em PDF',
      description: 'Crie seu currículo online com modelo simples e profissional para baixar em PDF.'
    }
  }
];

export const activeTools = toolsRegistry.filter((tool) => tool.status === 'active');
