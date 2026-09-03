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
        status: 'draft',
        seo: {
          title: 'Declaração Anual do MEI (DASN-SIMEI) Online',
          description: 'Faça sua Declaração Anual do MEI (DASN-SIMEI) com atendimento online. A Resodi auxilia na preparação, envio e conclusão da declaração.'
        },
        detail: {
          eyebrow: 'MEI',
          technicalName: 'DASN-SIMEI',
          intro: 'A Declaração Anual do MEI informa o faturamento bruto obtido no ano anterior e, quando aplicável, se houve empregado. A Resodi presta atendimento online para auxiliar na preparação e transmissão da declaração.',
          sections: [
            {
              title: 'O que é a Declaração Anual do MEI',
              paragraphs: ['A DASN-SIMEI é a declaração anual em que o MEI informa à Receita Federal a receita bruta obtida no ano anterior e se houve contratação de empregado, quando aplicável. É uma obrigação anual do MEI.']
            },
            {
              title: 'Quem precisa entregar',
              paragraphs: ['O MEI deve apresentar a declaração relativa ao ano anterior. A declaração MEI também deve ser transmitida quando não houve faturamento no período.']
            },
            {
              title: 'Prazo',
              paragraphs: ['O prazo regular da DASN-SIMEI é até 31 de maio do ano seguinte ao período declarado. Declarações em atraso também podem ser transmitidas e podem gerar multa conforme as regras vigentes; o valor mínimo previsto atualmente é de R$ 50,00.']
            }
          ],
          included: [
            'Orientação inicial sobre a declaração.',
            'Conferência básica das informações fornecidas.',
            'Preparação da DASN-SIMEI.',
            'Transmissão da declaração.',
            'Confirmação da entrega.',
            'Envio do comprovante ou recibo da declaração ao cliente.'
          ],
          excluded: [
            'Regularização de débitos e parcelamentos.',
            'Desenquadramento do MEI.',
            'Correção de outras obrigações ou contabilidade retroativa.',
            'Problemas cadastrais e situações complexas identificadas durante a análise.'
          ],
          steps: [
            'O cliente contrata o serviço.',
            'O pagamento é confirmado.',
            'A Resodi entra em contato pelos dados informados na contratação.',
            'São solicitadas somente as informações necessárias ao caso.',
            'A declaração é preparada e transmitida.',
            'O cliente recebe a confirmação e o comprovante da conclusão.'
          ],
          requestedInformation: [
            'CNPJ e dados básicos do MEI.',
            'Faturamento bruto do ano anterior.',
            'Separação do faturamento por tipo de atividade, quando necessária.',
            'Informação sobre existência de empregado no período.',
            'Informações sobre abertura, baixa ou alterações do MEI, quando relevantes.',
            'Acesso autenticado a serviços governamentais, quando necessário.',
            'Outras informações identificadas durante a análise.'
          ],
          faq: [
            ['O que é a DASN-SIMEI?', 'É a declaração anual em que o MEI informa a receita bruta do ano anterior e, quando aplicável, a contratação de empregado.'],
            ['Quem precisa entregar a Declaração Anual do MEI?', 'O MEI deve transmitir a declaração relativa ao ano anterior.'],
            ['Preciso declarar mesmo sem faturamento?', 'Sim. A declaração anual de faturamento deve ser enviada mesmo quando não houve faturamento no período.'],
            ['Qual é o prazo da Declaração Anual do MEI?', 'O prazo regular é até 31 de maio do ano seguinte ao período declarado.'],
            ['Posso entregar a declaração atrasada?', 'Sim. A transmissão em atraso é possível e pode gerar multa conforme as regras vigentes.'],
            ['Preciso enviar documentos no momento da contratação?', 'Não. As informações necessárias serão orientadas durante o atendimento, conforme o caso.'],
            ['A Resodi precisa da minha senha Gov.br?', 'A Resodi não armazena senhas nem códigos de autenticação. Quando um acesso autenticado for necessário, o procedimento será orientado durante o atendimento.'],
            ['A Resodi é um site do Governo?', 'Não. A Resodi é uma empresa privada de serviços digitais e não possui vínculo com órgãos públicos.'],
            ['A declaração oficial é gratuita?', 'Sim. A transmissão pode ser feita gratuitamente pelos canais oficiais. A Resodi cobra pelo atendimento, orientação, preparação e execução do serviço para o cliente.']
          ]
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

export function findServiceBySlugs(categorySlug, serviceSlug) {
  return servicesRegistry.find((service) => (
    service.categorySlug === categorySlug
    && service.slug === serviceSlug
    && service.detail
    && service.status !== 'planned'
  ));
}
