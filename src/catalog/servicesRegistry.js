export const serviceCategories = [
  {
    name: 'Imposto de Renda',
    slug: 'imposto-de-renda',
    services: [
      {
        name: 'Declaração de Imposto de Renda',
        shortName: 'Declaração de IR',
        slug: 'declaracao-imposto-de-renda',
        category: 'Imposto de Renda',
        categorySlug: 'imposto-de-renda',
        path: '/servicos/imposto-de-renda/declaracao-imposto-de-renda',
        description: 'Orientação e realização da declaração de Imposto de Renda.',
        status: 'planned',
        seo: {
          title: 'Declaração de Imposto de Renda | Resodi',
          description: 'Orientação para a declaração de Imposto de Renda.'
        }
      },
      {
        name: 'Resolver problemas na Malha Fina',
        shortName: 'Malha Fina',
        slug: 'malha-fina',
        category: 'Imposto de Renda',
        categorySlug: 'imposto-de-renda',
        path: '/servicos/imposto-de-renda/malha-fina',
        description: 'Ajuda para identificar pendências e resolver problemas relacionados à Malha Fina.',
        status: 'planned',
        seo: {
          title: 'Resolver problemas na Malha Fina | Resodi',
          description: 'Ajuda para identificar pendências relacionadas à Malha Fina.'
        }
      }
    ]
  },
  {
    name: 'MEI',
    slug: 'mei',
    services: [
      {
        name: 'Abertura de MEI',
        shortName: 'Abertura de MEI',
        slug: 'abertura-de-mei',
        category: 'MEI',
        categorySlug: 'mei',
        path: '/servicos/mei/abertura-de-mei',
        description: 'Auxílio para formalização e abertura do Microempreendedor Individual.',
        status: 'planned',
        seo: {
          title: 'Abertura de MEI | Resodi',
          description: 'Auxílio para formalização e abertura de MEI.'
        }
      },
      {
        name: 'Declaração Anual do MEI',
        shortName: 'Declaração Anual do MEI',
        slug: 'declaracao-anual-mei',
        category: 'MEI',
        categorySlug: 'mei',
        path: '/servicos/mei/declaracao-anual-mei',
        description: 'Auxílio para envio da Declaração Anual do MEI (DASN-SIMEI).',
        status: 'planned',
        seo: {
          title: 'Declaração Anual do MEI | Resodi',
          description: 'Auxílio para envio da Declaração Anual do MEI (DASN-SIMEI).'
        }
      },
      {
        name: 'Regularização do MEI',
        shortName: 'Regularização do MEI',
        slug: 'regularizacao-mei',
        category: 'MEI',
        categorySlug: 'mei',
        path: '/servicos/mei/regularizacao-mei',
        description: 'Ajuda para identificar pendências e regularizar a situação do MEI.',
        status: 'planned',
        seo: {
          title: 'Regularização do MEI | Resodi',
          description: 'Ajuda para identificar pendências e regularizar a situação do MEI.'
        }
      }
    ]
  },
  {
    name: 'Meu INSS',
    slug: 'meu-inss',
    services: [
      {
        name: 'Pedidos Online no Meu INSS',
        shortName: 'Pedidos no Meu INSS',
        slug: 'pedidos-online-inss',
        category: 'Meu INSS',
        categorySlug: 'meu-inss',
        path: '/servicos/meu-inss/pedidos-online-inss',
        description: 'Auxílio na realização de solicitações disponíveis pelos canais digitais do INSS.',
        status: 'planned',
        seo: {
          title: 'Pedidos Online no Meu INSS | Resodi',
          description: 'Auxílio para solicitações disponíveis nos canais digitais do INSS.'
        }
      }
    ]
  }
];

export const servicesRegistry = serviceCategories.flatMap((category) => category.services);
