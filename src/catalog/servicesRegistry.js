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
        name: 'Malha Fina do Imposto de Renda',
        shortName: 'Malha Fina',
        slug: 'malha-fina',
        category: 'Imposto de Renda',
        categorySlug: 'imposto-de-renda',
        path: '/servicos/imposto-de-renda/malha-fina',
        description: 'Análise de pendências e auxílio na regularização da declaração de Imposto de Renda retida na Malha Fina.',
        priceCents: 10000,
        priceSuffix: 'por ano/declaração',
        status: 'draft',
        seo: {
          title: 'Malha Fina do Imposto de Renda: Análise e Regularização',
          description: 'Caiu na Malha Fina do Imposto de Renda? A Resodi analisa as pendências e auxilia na retificação, comprovação e regularização da declaração.'
        },
        checkout: {
          productCode: 'malha_fina_ir'
        },
        detail: {
          eyebrow: 'Imposto de Renda',
          heroTitle: 'Malha Fina do Imposto de Renda',
          intro: 'Caiu na malha fina? A Resodi analisa as pendências da sua declaração, identifica o que precisa ser corrigido ou comprovado e auxilia na regularização do seu Imposto de Renda.',
          purchaseTitle: 'Análise e Regularização da Malha Fina',
          purchaseDescription: 'Atendimento online para análise de uma declaração referente a um exercício.',
          sections: [
            {
              title: 'Caiu na malha fina? Entenda o que aconteceu',
              paragraphs: [
                'Quando uma declaração de Imposto de Renda é enviada, a Receita Federal cruza os dados informados pelo contribuinte com informações recebidas de empresas, instituições financeiras, planos de saúde e outras fontes.',
                'Quando são encontradas divergências, inconsistências ou informações que precisam de comprovação, a declaração pode ficar retida para uma análise mais detalhada — situação conhecida como malha fiscal ou malha fina.',
                'Cair na malha fina não significa necessariamente que toda a declaração esteja errada. Dependendo da pendência, pode ser necessário corrigir uma informação ou apresentar documentos que comprovem o que foi declarado.'
              ],
              image: {
                src: '/images/servicos/malha-fina/como-funciona-malha-fina-imposto-de-renda.svg',
                alt: 'Como funciona a Malha Fina do Imposto de Renda'
              }
            },
            {
              title: 'Como saber se caiu na malha fina?',
              paragraphs: [
                'A situação da declaração pode ser consultada no serviço Meu Imposto de Renda. Quando existem pendências de malha, o sistema permite identificar os pontos que fizeram a declaração ficar retida para análise.',
                'Se você encontrou uma pendência e não sabe como resolver, a Resodi pode analisar o caso e orientar o procedimento adequado para aquela declaração.'
              ],
              cta: {
                title: 'Sua declaração está com pendência?',
                text: 'Contrate a análise da Malha Fina e descubra quais são os próximos passos para regularizar a declaração.',
                buttonLabel: 'Contratar análise'
              }
            },
            {
              title: 'Por que uma declaração pode cair na malha fina?',
              paragraphs: ['Existem diferentes motivos para uma declaração ficar retida. Entre as situações que podem gerar pendência estão:'],
              bullets: [
                'Divergências entre rendimentos declarados e informações de fontes pagadoras.',
                'Omissão ou diferença de valores de rendimentos.',
                'Despesas médicas e outras deduções que precisam de conferência ou comprovação.',
                'Informações relacionadas a dependentes.',
                'Pensão alimentícia declarada em desacordo com as regras aplicáveis.',
                'Dados divergentes enviados por empresas, bancos, planos de saúde ou outras fontes.',
                'Erros de preenchimento ou informações incompletas na declaração.',
                'Necessidade de apresentação de documentos que comprovem informações declaradas.'
              ]
            },
            {
              title: 'Como sair da malha fina?',
              paragraphs: [
                'A solução depende do motivo da pendência. Quando existe erro, omissão ou informação incompleta, pode ser possível transmitir uma declaração retificadora com os dados corretos.',
                'Quando as informações declaradas estão corretas, pode ser necessário reunir e apresentar documentos que comprovem os dados informados. Em situações mais complexas, o procedimento pode exigir uma análise específica antes de qualquer medida.',
                'A Resodi avalia a pendência apresentada e auxilia no caminho aplicável ao caso, sem prometer prazo ou resultado que dependa da análise da Receita Federal.'
              ],
              image: {
                src: '/images/servicos/malha-fina/como-sair-malha-fina-regularizar-imposto-de-renda.svg',
                alt: 'Como sair da Malha Fina e regularizar o Imposto de Renda'
              },
              cta: {
                title: 'Precisa regularizar sua declaração?',
                text: 'A análise custa R$ 100,00 por ano/declaração e inclui o atendimento necessário para identificar o procedimento aplicável.',
                buttonLabel: 'Contratar serviço'
              }
            }
          ],
          included: [
            'Análise inicial da pendência apresentada na Malha Fina.',
            'Conferência das informações fornecidas pelo cliente.',
            'Identificação do possível motivo da retenção da declaração.',
            'Orientação sobre os documentos e informações necessários ao caso.',
            'Preparação de declaração retificadora, quando aplicável.',
            'Auxílio no procedimento de correção da pendência, quando aplicável.',
            'Auxílio na apresentação de documentos, quando o procedimento for aplicável ao caso.',
            'Retorno ao cliente sobre o procedimento realizado e os próximos passos identificados.'
          ],
          excluded: [
            'Defesa administrativa complexa ou impugnação de lançamento.',
            'Recursos contra autuações, notificações ou decisões fiscais.',
            'Representação jurídica ou demandas judiciais.',
            'Processos fiscais que exijam atuação especializada fora de uma regularização comum.',
            'Regularização de outras declarações ou exercícios não incluídos na contratação.'
          ],
          steps: [
            'O cliente contrata o serviço referente a um ano/declaração.',
            'O pagamento é confirmado.',
            'A Resodi entra em contato pelos dados informados na contratação.',
            'São solicitadas as informações necessárias para identificar e analisar a pendência.',
            'A Resodi realiza a correção, orientação ou preparação de documentos aplicável ao caso.',
            'O cliente recebe o retorno sobre o procedimento realizado e os próximos passos, quando existirem.'
          ],
          afterStepsCta: {
            title: 'Quer ajuda para resolver a Malha Fina?',
            text: 'Faça a contratação online e receba as instruções para iniciarmos a análise da sua declaração.',
            buttonLabel: 'Contratar agora'
          },
          requestedInformation: [
            'Cópia da declaração de Imposto de Renda referente ao exercício analisado.',
            'Recibo de entrega da declaração, quando disponível.',
            'Informação ou print da pendência apresentada no Meu Imposto de Renda.',
            'Informes de rendimentos relacionados à pendência.',
            'Comprovantes de despesas, deduções ou pagamentos relacionados à divergência.',
            'Documentos de dependentes ou outras informações relacionadas ao caso, quando necessários.',
            'Outros documentos ou informações identificados durante a análise.'
          ],
          transparency: {
            paragraphs: [
              'A Resodi é uma empresa privada de serviços digitais e não possui vínculo com a Receita Federal, Gov.br ou outros órgãos públicos.',
              'A consulta de pendências, a retificação da declaração e outros procedimentos oficiais também podem ser realizados diretamente pelos canais disponibilizados pelo Governo. O valor cobrado pela Resodi corresponde ao atendimento, análise, orientação e execução dos procedimentos contratados para o cliente.'
            ]
          },
          seoSections: [
            {
              title: 'Declaração retida na malha fina: o que fazer?',
              paragraphs: [
                'O primeiro passo é identificar exatamente qual pendência foi apontada. A declaração pode ter sido separada para análise por divergência de dados, informação incompleta ou necessidade de comprovação.',
                'Depois de identificar o motivo, é possível avaliar se o caminho é corrigir a declaração, apresentar documentos ou aguardar uma etapa de processamento. Enquanto a declaração permanece retida na malha, eventual restituição vinculada a ela pode ficar aguardando a conclusão da análise.'
              ],
              cta: {
                title: 'Não sabe o que fazer depois de cair na malha fina?',
                text: 'A Resodi analisa a pendência e orienta o procedimento aplicável à sua declaração.',
                buttonLabel: 'Solicitar análise'
              }
            },
            {
              title: 'Posso corrigir uma declaração que caiu na malha fina?',
              paragraphs: [
                'Em muitos casos, sim. Quando a pendência decorre de erro, omissão ou informação incorreta e ainda é permitido retificar a declaração, uma declaração retificadora pode ser utilizada para corrigir os dados.',
                'A possibilidade de retificação depende da situação concreta da declaração. Por isso, a análise da pendência deve ocorrer antes de qualquer alteração.'
              ]
            },
            {
              title: 'Minha declaração está correta. E agora?',
              paragraphs: [
                'Se os dados informados estão corretos, a solução pode não ser uma retificação. Dependendo da pendência, pode ser necessário comprovar as informações apresentadas com documentos e seguir o procedimento indicado pela Receita Federal.',
                'O objetivo da análise é justamente identificar qual caminho faz sentido antes de alterar uma declaração que pode estar correta.'
              ]
            }
          ],
          faq: [
            ['O que é a Malha Fina do Imposto de Renda?', 'É a análise mais detalhada de uma declaração que apresentou divergência, inconsistência ou informação que precisa ser verificada ou comprovada.'],
            ['Como saber se caí na malha fina?', 'A situação da declaração e as pendências podem ser consultadas no serviço Meu Imposto de Renda.'],
            ['Caí na malha fina. O que fazer?', 'Primeiro é necessário identificar o motivo da pendência. Dependendo do caso, pode ser necessário retificar a declaração, apresentar documentos ou seguir outro procedimento indicado pela Receita.'],
            ['Como sair da malha fina?', 'Não existe uma única solução. O procedimento depende da pendência encontrada e pode envolver correção da declaração, comprovação de informações ou outra providência aplicável.'],
            ['Quanto tempo demora para sair da malha fina?', 'Não há um prazo que a Resodi possa garantir. O processamento e a decisão final dependem da Receita Federal e da situação específica da declaração.'],
            ['Posso receber a restituição enquanto a declaração está na malha fina?', 'A restituição relacionada à declaração pode ficar aguardando enquanto a análise da malha não for concluída.'],
            ['É possível fazer uma declaração retificadora?', 'Em muitos casos, sim, quando existe erro ou omissão e a situação ainda permite a retificação. Antes de alterar a declaração, é importante identificar a pendência.'],
            ['O valor de R$ 100,00 cobre mais de um ano?', 'Não. O valor de R$ 100,00 corresponde à análise e ao atendimento de uma declaração referente a um exercício. Se houver pendências em mais de um ano, cada declaração corresponde a uma contratação.'],
            ['A Resodi garante que minha declaração sairá da malha fina?', 'Não. A Resodi presta o serviço de análise, orientação e execução dos procedimentos aplicáveis. A análise e o processamento final da declaração são de responsabilidade da Receita Federal.'],
            ['A Resodi precisa da minha senha Gov.br?', 'A Resodi não armazena senhas nem códigos de autenticação. Quando um acesso autenticado for necessário, o procedimento será orientado durante o atendimento.'],
            ['A Resodi é da Receita Federal?', 'Não. A Resodi é uma empresa privada de serviços digitais e não possui vínculo com a Receita Federal ou outro órgão público.']
          ],
          finalCta: {
            title: 'Resolva a pendência da sua declaração com orientação',
            text: 'Contrate a análise da Malha Fina por R$ 100,00 por ano/declaração e receba as instruções para começarmos o atendimento.',
            buttonLabel: 'Contratar serviço'
          }
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
        priceCents: 10000,
        status: 'active',
        seo: {
          title: 'Declaração Anual do MEI (DASN-SIMEI) Online',
          description: 'Faça sua Declaração Anual do MEI (DASN-SIMEI) com atendimento online. A Resodi auxilia na preparação, envio e conclusão da declaração.'
        },
        checkout: {
          productCode: 'declaracao_anual_mei'
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
