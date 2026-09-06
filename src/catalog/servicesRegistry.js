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
        description: 'Regularização de pendências do Imposto de Renda, incluindo CPF Pendente de Regularização, declaração não entregue e declaração retida na Malha Fina.',
        priceCents: 10000,
        priceSuffix: 'por ano/declaração',
        status: 'draft',
        seo: {
          title: 'Malha Fina e CPF Pendente de Regularização | Resodi',
          description: 'CPF Pendente de Regularização, Erro 04 ou declaração na Malha Fina? A Resodi identifica a pendência do IR e auxilia na regularização.'
        },
        checkout: {
          productCode: 'malha_fina_ir'
        },
        detail: {
          eyebrow: 'Imposto de Renda',
          heroTitle: 'Malha Fina do Imposto de Renda',
          intro: 'CPF Pendente de Regularização, Erro 04 ou declaração com pendências? A Resodi identifica a origem do problema e auxilia na regularização do seu Imposto de Renda, seja por declaração não entregue, informação divergente ou retenção para análise.',
          purchaseTitle: 'Regularização de Malha Fina e Pendências do IR',
          purchaseDescription: 'Atendimento online para identificar e regularizar a pendência de uma declaração referente a um exercício.',
          sections: [
            {
              title: 'CPF Pendente de Regularização, Erro 04 ou Malha Fina?',
              paragraphs: [
                'Muitas pessoas descobrem que existe um problema no Imposto de Renda quando consultam o CPF e encontram a situação Pendente de Regularização ou o chamado Erro 04 em algumas consultas. Outras percebem a pendência ao verificar que uma declaração enviada ficou retida para análise.',
                'Para fins deste serviço, a Resodi trata essas situações em uma única frente de atendimento: Malha Fina e Regularização do Imposto de Renda. Primeiro identificamos qual declaração ou exercício está causando a pendência e depois aplicamos o procedimento adequado ao caso.',
                'A origem pode ser uma declaração obrigatória que não foi entregue, uma declaração transmitida com dados divergentes ou uma declaração que precisa de correção ou comprovação. O importante é identificar a causa antes de tomar qualquer medida.'
              ],
              image: {
                src: '/images/servicos/malha-fina/como-funciona-malha-fina-imposto-de-renda.svg',
                alt: 'Como funciona a Malha Fina e a regularização de pendências do Imposto de Renda'
              }
            },
            {
              title: 'Como saber se existe pendência no Imposto de Renda?',
              paragraphs: [
                'A pendência pode aparecer em uma consulta da situação cadastral do CPF, com a indicação Pendente de Regularização, ou nos serviços do Meu Imposto de Renda, onde é possível verificar declarações não entregues, pendências e situações que exigem atenção.',
                'Você não precisa saber exatamente qual é o problema antes de contratar. A análise da Resodi começa justamente pela identificação da declaração ou exercício que precisa ser regularizado.'
              ],
              cta: {
                title: 'Seu CPF está Pendente de Regularização?',
                text: 'Contrate a análise e nós identificamos qual pendência do Imposto de Renda precisa ser resolvida.',
                buttonLabel: 'Contratar análise'
              }
            },
            {
              title: 'Situações que este serviço pode atender',
              paragraphs: ['A regularização pode envolver diferentes situações relacionadas ao Imposto de Renda. Entre as mais comuns estão:'],
              bullets: [
                'Declaração de Imposto de Renda obrigatória que não foi entregue.',
                'Declaração entregue em atraso ou necessidade de regularizar um exercício anterior.',
                'CPF com situação Pendente de Regularização relacionada ao Imposto de Renda.',
                'Declaração enviada com divergências entre rendimentos e informações de fontes pagadoras.',
                'Omissão ou diferença de valores de rendimentos.',
                'Despesas médicas e outras deduções que precisam de conferência ou comprovação.',
                'Informações relacionadas a dependentes ou pensão alimentícia.',
                'Dados divergentes enviados por empresas, bancos, planos de saúde ou outras fontes.',
                'Erros de preenchimento ou informações incompletas na declaração.',
                'Necessidade de retificação ou apresentação de documentos para comprovar informações declaradas.'
              ]
            },
            {
              title: 'Como sair da Malha Fina ou regularizar o CPF pendente?',
              paragraphs: [
                'O procedimento depende da origem da pendência. Se a obrigação não foi entregue, pode ser necessário preparar e transmitir a declaração que está faltando. Se a declaração já foi enviada, pode ser necessário corrigir informações por meio de uma declaração retificadora.',
                'Quando os dados declarados estão corretos, a solução pode envolver a reunião e apresentação de documentos que comprovem as informações. Em situações mais complexas, o caso pode exigir uma análise específica antes de qualquer alteração.',
                'A Resodi identifica o caminho aplicável e auxilia na regularização correspondente ao exercício contratado, sem prometer prazo ou resultado que dependa da análise da Receita Federal.'
              ],
              image: {
                src: '/images/servicos/malha-fina/como-sair-malha-fina-regularizar-imposto-de-renda.svg',
                alt: 'Como sair da Malha Fina e regularizar CPF Pendente de Regularização'
              },
              cta: {
                title: 'Precisa regularizar o Imposto de Renda?',
                text: 'O atendimento custa R$ 100,00 por ano/declaração e inclui a análise necessária para identificar o procedimento aplicável.',
                buttonLabel: 'Contratar serviço'
              }
            }
          ],
          included: [
            'Análise inicial da pendência relacionada ao Imposto de Renda.',
            'Identificação do exercício ou declaração que precisa ser regularizado.',
            'Conferência das informações fornecidas pelo cliente.',
            'Orientação sobre os documentos e informações necessários ao caso.',
            'Preparação e transmissão de declaração em atraso, quando aplicável ao exercício contratado.',
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
            'São solicitadas as informações necessárias para identificar a origem da pendência.',
            'A Resodi realiza a declaração em atraso, retificação, orientação ou preparação de documentos aplicável ao caso.',
            'O cliente recebe o retorno sobre o procedimento realizado e os próximos passos, quando existirem.'
          ],
          afterStepsCta: {
            title: 'Quer regularizar a pendência do seu Imposto de Renda?',
            text: 'Faça a contratação online e receba as instruções para iniciarmos a análise da sua situação.',
            buttonLabel: 'Contratar agora'
          },
          requestedInformation: [
            'Print ou informação da situação Pendente de Regularização apresentada na consulta do CPF, quando disponível.',
            'Informação ou print da pendência apresentada no Meu Imposto de Renda, quando disponível.',
            'Cópia da declaração de Imposto de Renda referente ao exercício analisado, quando já tiver sido entregue.',
            'Recibo de entrega da declaração, quando disponível.',
            'Informes de rendimentos relacionados ao exercício.',
            'Comprovantes de despesas, deduções ou pagamentos relacionados à divergência.',
            'Documentos de dependentes ou outras informações relacionadas ao caso, quando necessários.',
            'Outros documentos ou informações identificados durante a análise.'
          ],
          transparency: {
            paragraphs: [
              'A Resodi é uma empresa privada de serviços digitais e não possui vínculo com a Receita Federal, Gov.br ou outros órgãos públicos.',
              'A consulta de pendências, a entrega de declarações, a retificação e outros procedimentos oficiais também podem ser realizados diretamente pelos canais disponibilizados pelo Governo. O valor cobrado pela Resodi corresponde ao atendimento, análise, orientação e execução dos procedimentos contratados para o cliente.'
            ]
          },
          seoSections: [
            {
              title: 'CPF Pendente de Regularização: o que fazer?',
              paragraphs: [
                'Ao encontrar o CPF com a situação Pendente de Regularização, o primeiro passo é identificar qual obrigação ou declaração do Imposto de Renda está relacionada à pendência. Em muitos casos, o contribuinte só descobre o problema ao consultar o próprio CPF.',
                'Depois de identificar o exercício, é possível verificar se existe declaração não entregue, informação que precisa ser corrigida ou outra pendência relacionada ao processamento do Imposto de Renda.'
              ],
              cta: {
                title: 'Encontrou CPF Pendente de Regularização?',
                text: 'A Resodi identifica a origem da pendência e auxilia na regularização do exercício correspondente.',
                buttonLabel: 'Regularizar CPF'
              }
            },
            {
              title: 'Declaração retida na Malha Fina: o que fazer?',
              paragraphs: [
                'Quando uma declaração já foi entregue e apresenta divergência, informação incompleta ou necessidade de comprovação, é preciso identificar exatamente qual ponto está impedindo o processamento normal.',
                'Depois dessa análise, o caminho pode ser corrigir a declaração, apresentar documentos ou acompanhar uma etapa de processamento. Enquanto a declaração permanece retida, eventual restituição vinculada a ela pode ficar aguardando a conclusão da análise.'
              ]
            },
            {
              title: 'Não entreguei o Imposto de Renda. Este serviço também atende?',
              paragraphs: [
                'Sim. Para fins do atendimento da Resodi, a regularização de uma declaração obrigatória não entregue faz parte da mesma frente de Malha Fina e Regularização do Imposto de Renda.',
                'Depois de identificar qual exercício está pendente, a Resodi pode preparar e transmitir a declaração correspondente, desde que o caso esteja dentro do escopo de uma regularização comum.'
              ]
            },
            {
              title: 'Minha declaração foi entregue, mas tem dados divergentes. E agora?',
              paragraphs: [
                'Quando a declaração já foi transmitida, a análise verifica se existe erro, omissão ou diferença de informação. Se houver algo a corrigir e a situação permitir, uma declaração retificadora pode ser utilizada.',
                'Se os dados estiverem corretos, pode ser necessário comprovar as informações apresentadas com documentos e seguir o procedimento indicado para aquela pendência.'
              ]
            }
          ],
          faq: [
            ['O que é a Malha Fina do Imposto de Renda?', 'É uma expressão usada para situações em que existem pendências relacionadas à declaração do Imposto de Renda. Na Resodi, o serviço de Malha Fina também atende pendências de regularização ligadas a declarações não entregues ou com divergências.'],
            ['CPF Pendente de Regularização é atendido por este serviço?', 'Sim. Para fins do serviço da Resodi, CPF Pendente de Regularização relacionado ao Imposto de Renda entra na mesma frente de Malha Fina e Regularização do IR.'],
            ['O que significa Erro 04 na consulta do CPF?', 'O chamado Erro 04 aparece em algumas consultas associado a uma pendência de regularização. A Resodi verifica qual declaração ou exercício do Imposto de Renda está relacionado ao problema antes de realizar qualquer procedimento.'],
            ['Não entreguei a declaração do Imposto de Renda. Posso contratar?', 'Sim. Se a pendência estiver relacionada a uma declaração obrigatória não entregue, o serviço pode incluir a preparação e transmissão do exercício contratado.'],
            ['Entreguei a declaração, mas existem dados divergentes. Este serviço atende?', 'Sim. A análise pode identificar a necessidade de retificação, correção de informação ou apresentação de documentos, conforme o caso.'],
            ['Como saber qual ano está pendente?', 'A análise verifica as informações disponíveis na consulta do CPF e nos serviços relacionados ao Imposto de Renda para identificar qual exercício precisa de atenção.'],
            ['Como sair da Malha Fina?', 'Não existe uma única solução. O procedimento pode envolver entrega de declaração faltante, retificação, comprovação de informações ou outra providência aplicável ao exercício.'],
            ['Quanto tempo demora para regularizar?', 'Não há um prazo que a Resodi possa garantir. O processamento e a decisão final dependem da Receita Federal e da situação específica da declaração.'],
            ['Posso receber a restituição enquanto a declaração está na Malha Fina?', 'A restituição relacionada à declaração pode ficar aguardando enquanto a análise da pendência não for concluída.'],
            ['O valor de R$ 100,00 cobre mais de um ano?', 'Não. O valor de R$ 100,00 corresponde à análise e ao atendimento de uma declaração referente a um exercício. Se houver pendências em mais de um ano, cada declaração corresponde a uma contratação.'],
            ['A Resodi garante que meu CPF será regularizado?', 'Não. A Resodi presta o serviço de análise, orientação e execução dos procedimentos aplicáveis. O processamento final e a situação oficial dependem da Receita Federal.'],
            ['A Resodi precisa da minha senha Gov.br?', 'A Resodi não armazena senhas nem códigos de autenticação. Quando um acesso autenticado for necessário, o procedimento será orientado durante o atendimento.'],
            ['A Resodi é da Receita Federal?', 'Não. A Resodi é uma empresa privada de serviços digitais e não possui vínculo com a Receita Federal ou outro órgão público.']
          ],
          finalCta: {
            title: 'Regularize sua pendência do Imposto de Renda com orientação',
            text: 'Contrate o serviço por R$ 100,00 por ano/declaração e receba as instruções para começarmos a análise da sua situação.',
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
        status: 'draft',
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
