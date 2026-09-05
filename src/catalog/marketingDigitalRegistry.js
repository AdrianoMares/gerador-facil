export const marketingDigitalCategories = [
  {
    name: 'Criação de Sites',
    slug: 'criacao-de-sites',
    services: [
      {
        name: 'Criação de Site Simples',
        shortName: 'Site Simples',
        slug: 'site-simples',
        category: 'Criação de Sites',
        categorySlug: 'criacao-de-sites',
        path: '/marketing-digital/criacao-de-sites/site-simples',
        description: 'Criação de site simples com estrutura de 1 a 4 páginas.',
        priceCents: 10000,
        status: 'planned',
        seo: {
          title: 'Criação de Site Simples | Resodi',
          description: 'Criação de site simples com 1 a 4 páginas.'
        }
      },
      {
        name: 'Criação de Site Grande',
        shortName: 'Site Grande',
        slug: 'site-grande',
        category: 'Criação de Sites',
        categorySlug: 'criacao-de-sites',
        path: '/marketing-digital/criacao-de-sites/site-grande',
        description: 'Criação de site com estrutura de 5 a 20 páginas.',
        priceCents: 50000,
        status: 'planned',
        seo: {
          title: 'Criação de Site Grande | Resodi',
          description: 'Criação de site com 5 a 20 páginas.'
        }
      },
      {
        name: 'Site — Pacote Completo',
        shortName: 'Pacote Completo',
        slug: 'site-pacote-completo',
        category: 'Criação de Sites',
        categorySlug: 'criacao-de-sites',
        path: '/marketing-digital/criacao-de-sites/site-pacote-completo',
        description: 'Projeto completo com site, logo, estrutura de marketing, cadastro de produtos, configuração inicial de tráfego pago e demais itens definidos no escopo.',
        priceCents: 500000,
        status: 'planned',
        seo: {
          title: 'Site Pacote Completo | Resodi',
          description: 'Pacote completo para criação e estruturação de presença digital.'
        }
      }
    ]
  },
  {
    name: 'Loja Virtual',
    slug: 'loja-virtual',
    services: [
      {
        name: 'Loja Virtual com até 20 Produtos',
        shortName: 'E-commerce até 20 produtos',
        slug: 'ecommerce-ate-20-produtos',
        category: 'Loja Virtual',
        categorySlug: 'loja-virtual',
        path: '/marketing-digital/loja-virtual/ecommerce-ate-20-produtos',
        description: 'Criação de loja virtual com estrutura inicial para até 20 produtos.',
        priceCents: 100000,
        status: 'planned',
        seo: {
          title: 'Criação de Loja Virtual até 20 Produtos | Resodi',
          description: 'Criação de loja virtual com até 20 produtos.'
        }
      },
      {
        name: 'Loja Virtual com mais de 20 Produtos',
        shortName: 'E-commerce acima de 20 produtos',
        slug: 'ecommerce-mais-de-20-produtos',
        category: 'Loja Virtual',
        categorySlug: 'loja-virtual',
        path: '/marketing-digital/loja-virtual/ecommerce-mais-de-20-produtos',
        description: 'Criação de loja virtual para projetos com mais de 20 produtos.',
        priceCents: 200000,
        status: 'planned',
        seo: {
          title: 'Criação de Loja Virtual com mais de 20 Produtos | Resodi',
          description: 'Criação de loja virtual para catálogos com mais de 20 produtos.'
        }
      },
      {
        name: 'Melhoria de Design de Loja Virtual',
        shortName: 'Melhoria de Design',
        slug: 'melhoria-design-loja-virtual',
        category: 'Loja Virtual',
        categorySlug: 'loja-virtual',
        path: '/marketing-digital/loja-virtual/melhoria-design-loja-virtual',
        description: 'Ajustes visuais e melhorias de apresentação em loja virtual existente.',
        priceCents: 20000,
        status: 'planned',
        seo: {
          title: 'Melhoria de Design de Loja Virtual | Resodi',
          description: 'Melhorias visuais e de apresentação para lojas virtuais.'
        }
      }
    ]
  },
  {
    name: 'Tráfego Pago',
    slug: 'trafego-pago',
    services: [
      {
        name: 'Anúncios de Tráfego Pago',
        shortName: 'Tráfego Pago',
        slug: 'anuncios-trafego-pago',
        category: 'Tráfego Pago',
        categorySlug: 'trafego-pago',
        path: '/marketing-digital/trafego-pago/anuncios-trafego-pago',
        description: 'Criação e configuração de campanha no Meta Ads ou Google Ads.',
        priceCents: 20000,
        priceSuffix: 'por campanha',
        status: 'planned',
        seo: {
          title: 'Anúncios de Tráfego Pago | Resodi',
          description: 'Criação e configuração de campanhas no Meta Ads ou Google Ads.'
        }
      }
    ]
  },
  {
    name: 'ERP e Gestão',
    slug: 'erp-e-gestao',
    services: [
      {
        name: 'Configuração Básica de ERP',
        shortName: 'Configuração de ERP',
        slug: 'configuracao-basica-erp',
        category: 'ERP e Gestão',
        categorySlug: 'erp-e-gestao',
        path: '/marketing-digital/erp-e-gestao/configuracao-basica-erp',
        description: 'Configuração inicial de ERP conforme o escopo e os recursos disponíveis no sistema utilizado.',
        priceCents: 50000,
        status: 'planned',
        seo: {
          title: 'Configuração Básica de ERP | Resodi',
          description: 'Configuração inicial de ERP para organização da operação digital.'
        }
      }
    ]
  }
];

export const marketingDigitalRegistry = marketingDigitalCategories.flatMap((category) => category.services);
