import { currentYear } from '../config/currentYear.js';
import { getImpostoRendaAnnualConfig } from './impostoRendaAnnualConfig.js';

const malhaFinaPath = '/servicos/imposto-de-renda/malha-fina';

function annualSections(config, year) {
  if (!config) {
    return [{
      title: `Regras e prazos do Imposto de Renda ${year}`,
      className: 'service-cpf-alert',
      paragraphs: [
        `As regras, os limites e os prazos específicos da Declaração de Imposto de Renda ${year} ainda serão atualizados nesta página após a publicação oficial da Receita Federal.`,
        'Enquanto isso, você pode consultar as orientações gerais abaixo e reunir seus documentos. Não exibimos números de exercícios anteriores como se fossem atuais.'
      ]
    }];
  }

  const { obligation, deductions, lateFilingPenalty } = config;
  return [
    {
      title: `Prazo da Declaração de Imposto de Renda ${year}`,
      className: 'service-cpf-alert',
      paragraphs: [
        `O prazo regular da Declaração de Imposto de Renda ${year}, referente ao ano-calendário ${config.calendarYear}, foi de ${config.regularDeadline.startsAt} a ${config.regularDeadline.endsAt}. O prazo já terminou.`,
        'Quem estava obrigado e ainda não entregou pode transmitir a declaração em atraso, ficando sujeito à multa prevista pela Receita Federal.'
      ]
    },
    {
      title: `Quem precisa declarar Imposto de Renda ${year}?`,
      paragraphs: [
        `A obrigatoriedade considera os fatos ocorridos no ano-calendário ${config.calendarYear}. Segundo a Receita Federal, estão entre as hipóteses de obrigatoriedade:`
      ],
      bullets: [
        `Rendimentos tributáveis, como salários, aposentadoria e aluguéis, acima de ${obligation.taxableIncome}.`,
        `Rendimentos isentos, não tributáveis ou tributados exclusivamente na fonte acima de ${obligation.exemptIncome}.`,
        `Receita bruta de atividade rural acima de ${obligation.ruralRevenue}.`,
        `Intenção de compensar, em ${config.calendarYear} ou nos anos seguintes, prejuízos da atividade rural do próprio ano ou de anos anteriores.`,
        'Ganho de capital na venda de bens ou direitos sujeito ao imposto.',
        `Vendas em bolsas de valores, de mercadorias, de futuros e semelhantes cuja soma total tenha superado ${obligation.exchangeSales}.`,
        'Qualquer venda em bolsa com ganho líquido em operações day trade.',
        `Vendas de ações em operações comuns com ganho líquido quando a soma das vendas em algum mês tenha superado ${obligation.commonStockMonthlySales}.`,
        `Posse ou propriedade de bens e direitos em valor total acima de ${obligation.assets}.`,
        'Pessoa que passou à condição de residente no Brasil e permaneceu nessa situação em 31 de dezembro.',
        'Opção por declarar bens, direitos e obrigações de entidade controlada no exterior como se fossem detidos diretamente pela pessoa física; titularidade de trust; rendimentos de aplicações financeiras no exterior; compensação de perdas no exterior; ou lucros e dividendos de entidades no exterior, conforme as regras aplicáveis.',
        'Opção pela isenção do ganho de capital na venda de imóvel residencial com aplicação do produto da venda em outro imóvel residencial no País dentro do prazo legal.',
        'Demais hipóteses previstas pela Receita Federal.'
      ],
      links: [
        { to: malhaFinaPath, label: 'Veja como regularizar uma declaração não entregue ou retida na Malha Fina' }
      ]
    },
    {
      title: `Perdi o prazo do Imposto de Renda ${year}. E agora?`,
      paragraphs: [
        'Ainda é possível preparar e transmitir a declaração atrasada pelos canais disponibilizados pela Receita Federal. A multa se aplica a quem estava obrigado a declarar e entregou depois do prazo legal.',
        `A multa é calculada em ${lateFilingPenalty.monthlyRate} sobre o imposto devido apurado, ainda que já tenha sido pago. O valor mínimo é ${lateFilingPenalty.minimum} e o máximo é ${lateFilingPenalty.maximum}. A notificação e o DARF são gerados após a transmissão, junto do recibo, conforme as regras oficiais.`
      ],
      links: [
        { to: malhaFinaPath, label: 'Conheça o serviço para declaração pendente, CPF pendente ou Malha Fina' }
      ]
    },
    {
      title: `Deduções e desconto simplificado em ${year}`,
      paragraphs: [
        `No exercício ${year}, a dedução anual por dependente é de ${deductions.dependent}, o limite individual anual de despesas com educação é de ${deductions.education}, e o desconto simplificado corresponde a ${deductions.simplifiedRate} dos rendimentos tributáveis, limitado a ${deductions.simplifiedLimit}.`,
        'A melhor opção entre deduções legais e desconto simplificado depende das informações reais de cada contribuinte. Despesas só devem ser informadas quando atendem às regras e podem ser comprovadas.'
      ]
    },
    {
      title: `Novidades do Imposto de Renda ${year}`,
      paragraphs: ['Entre as novidades divulgadas oficialmente para este exercício estão:'],
      bullets: config.news
    },
    {
      title: `Lotes regulares de restituição em ${year}`,
      paragraphs: [
        `A Receita Federal programou quatro lotes regulares: ${config.refundSchedule.map(([lot, date]) => `${lot} em ${date}`).join('; ')}. O enquadramento em um lote depende do processamento da declaração, das prioridades legais e da ausência de pendências.`,
        'O cronograma não representa garantia de restituição nem de recebimento em uma data específica.'
      ]
    }
  ];
}

function annualFaq(config, year) {
  if (!config) {
    return [
      [`Quem precisa declarar Imposto de Renda ${year}?`, 'As hipóteses e os limites específicos deste exercício serão publicados aqui depois da divulgação oficial da Receita Federal. Em geral, a obrigação depende de rendimentos, patrimônio, atividade rural, ganho de capital, bolsa, residência e situações no exterior.'],
      [`Qual é o prazo do Imposto de Renda ${year}?`, 'O prazo específico deste exercício será atualizado após a publicação oficial da Receita Federal.']
    ];
  }

  return [
    [`Quem precisa declarar Imposto de Renda ${year}?`, `Entre as hipóteses estão rendimentos tributáveis acima de ${config.obligation.taxableIncome}, rendimentos isentos ou exclusivos acima de ${config.obligation.exemptIncome}, atividade rural, patrimônio, ganho de capital, operações em bolsa, residência e situações no exterior. A lista completa depende das regras oficiais.`],
    [`Qual foi o prazo do Imposto de Renda ${year}?`, `O prazo regular foi de ${config.regularDeadline.startsAt} a ${config.regularDeadline.endsAt}.`],
    ['Perdi o prazo. Ainda posso declarar?', 'Sim. Quem não entregou pode transmitir a declaração em atraso. Se estava obrigado, fica sujeito à multa prevista pela Receita Federal.'],
    ['Qual é a multa por declarar Imposto de Renda atrasado?', `A multa é de ${config.lateFilingPenalty.monthlyRate} sobre o imposto devido, com mínimo de ${config.lateFilingPenalty.minimum} e máximo de ${config.lateFilingPenalty.maximum}.`],
    ['Quando recebo a restituição?', `Os quatro lotes regulares de ${year} foram programados para maio, junho, julho e agosto. O pagamento depende do processamento, das prioridades e da ausência de pendências.`]
  ];
}

export function buildDeclaracaoImpostoRendaDetail(year = currentYear) {
  const annualConfig = getImpostoRendaAnnualConfig(year);

  return {
    eyebrow: 'Imposto de Renda',
    heroTitle: `Declaração de Imposto de Renda ${year}`,
    intro: `Precisa fazer a Declaração de Imposto de Renda ${year}, conferir documentos ou entregar o IRPF em atraso? A Resodi auxilia na preparação, revisão e transmissão da declaração com atendimento online.`,
    purchaseTitle: `Preparação da Declaração de Imposto de Renda ${year}`,
    purchaseDescription: 'Atendimento privado para preparar, conferir e transmitir uma declaração referente a um exercício. A contratação online será disponibilizada em breve.',
    sections: [
      {
        title: 'O que é a Declaração de Imposto de Renda?',
        paragraphs: [
          'A Declaração de Ajuste Anual reúne rendimentos, pagamentos, bens, direitos, dívidas e outras informações da pessoa física referentes ao ano-calendário. Com esses dados, são apurados o imposto devido, valores já pagos e eventual saldo a restituir ou a pagar.',
          'A obrigação e o conteúdo variam conforme a situação de cada contribuinte. Salários, aposentadorias, aluguéis, investimentos, dependentes, despesas e alterações patrimoniais podem influenciar o preenchimento.'
        ]
      },
      ...annualSections(annualConfig, year),
      {
        title: 'Quem não precisa declarar?',
        paragraphs: [
          'Em regra, quem não se enquadra em nenhuma hipótese de obrigatoriedade não precisa apresentar declaração. A pessoa informada corretamente como dependente na declaração de outra normalmente não entrega uma declaração própria, salvo se deixou de ser dependente ao longo do ano e passou a se enquadrar em alguma obrigação.',
          'Mesmo sem estar obrigada, uma pessoa pode entregar voluntariamente, por exemplo quando teve imposto retido e a declaração apura valor a restituir. Cada situação deve ser conferida individualmente.'
        ]
      },
      {
        title: 'Como fazer a Declaração de Imposto de Renda?',
        paragraphs: ['A declaração oficial pode ser preparada e transmitida pelos canais disponibilizados pela Receita Federal. O processo costuma seguir estas etapas:'],
        bullets: [
          'Reunir informações e documentos do período.',
          'Conferir rendimentos recebidos e impostos retidos.',
          'Informar dependentes, quando aplicável.',
          'Conferir despesas dedutíveis e seus comprovantes.',
          'Declarar bens, direitos, dívidas e investimentos aplicáveis.',
          'Verificar e corrigir as informações importadas pela declaração pré-preenchida.',
          'Comparar as formas de tributação disponíveis.',
          'Revisar e transmitir a declaração.',
          'Guardar a declaração e o recibo de entrega.'
        ],
        image: {
          src: '/images/servicos/declaracao-imposto-renda/como-fazer-declaracao-imposto-renda.svg',
          alt: 'Etapas para fazer a declaração de Imposto de Renda: reunir documentos, conferir dados, informar deduções e patrimônio, revisar, transmitir e guardar o recibo'
        }
      },
      {
        title: 'Como funciona a declaração pré-preenchida?',
        paragraphs: [
          'A declaração pré-preenchida importa informações existentes nas bases oficiais, como rendimentos, deduções, bens, direitos, dívidas e ônus. Os dados podem vir da declaração anterior e de informações prestadas por fontes pagadoras, instituições financeiras, serviços médicos e outras fontes.',
          'Para utilizar essa modalidade, a Receita exige conta Gov.br de nível Prata ou Ouro. Mesmo com os campos importados, o contribuinte continua responsável por conferir, corrigir, incluir ou excluir informações. A pré-preenchida facilita o trabalho, mas não elimina riscos de erro.'
        ]
      },
      {
        title: 'Quais documentos preciso para declarar Imposto de Renda?',
        paragraphs: ['Os documentos variam conforme a situação de cada contribuinte. Conforme o caso, podem ser necessários:'],
        bullets: [
          'Dados pessoais e CPF do titular e dos dependentes.',
          'Informes de rendimentos de salários, aposentadorias, bancos, corretoras e outras fontes.',
          'Informações de aluguéis recebidos ou pagos.',
          'Documentos de bens e direitos, incluindo compras e vendas.',
          'Comprovantes de despesas médicas, educação, previdência e pensão, quando aplicáveis.',
          'Informações de atividade rural, operações financeiras e ativos ou rendimentos no exterior, quando aplicáveis.',
          'Cópia da declaração anterior e recibo de entrega, quando disponíveis.',
          'Outros documentos necessários à situação apresentada.'
        ]
      },
      {
        title: 'Deduções legais, dependentes e despesas',
        paragraphs: [
          'As deduções legais podem incluir dependentes, despesas médicas, educação, contribuições previdenciárias e outras situações previstas nas regras fiscais. Cada item tem condições próprias, e algumas despesas possuem limites enquanto outras dependem de comprovação específica.',
          'O desconto simplificado substitui as deduções legais por um desconto calculado sobre os rendimentos tributáveis, até o limite do exercício. A opção mais adequada só pode ser identificada depois de preencher e conferir as informações reais.'
        ]
      },
      {
        title: 'Como funciona a restituição do Imposto de Renda?',
        paragraphs: [
          'Depois do cálculo, a declaração pode resultar em imposto a restituir, imposto a pagar ou ausência de saldo. A restituição ocorre quando o processamento reconhece que houve pagamento de imposto superior ao devido.',
          'A Resodi não garante restituição, valor ou data de pagamento. O resultado depende das informações reais, das regras fiscais e do processamento da Receita Federal. Se a declaração ficar retida em malha, o pagamento pode permanecer temporariamente impedido.'
        ],
        links: [{ to: malhaFinaPath, label: 'Entenda o atendimento para declaração retida na Malha Fina' }]
      },
      {
        title: 'E se houver imposto a pagar?',
        paragraphs: [
          'Quando a apuração resulta em imposto a pagar, a declaração informa o saldo e as opções disponíveis conforme as regras do exercício. DARFs, tributos, multas e encargos são de responsabilidade do contribuinte e não estão incluídos no preço do serviço.',
          'A Resodi orienta sobre o resultado apurado, sem prometer redução de imposto ou adotar informações que não correspondam à realidade.'
        ]
      },
      {
        title: 'Atendimento privado para preparar e transmitir o IRPF',
        paragraphs: [
          'A Resodi presta um serviço privado de apoio ao contribuinte. Analisamos as informações fornecidas, orientamos sobre documentos, preparamos o preenchimento, revisamos os dados e auxiliamos na transmissão pelos canais oficiais.',
          'A responsabilidade pela veracidade e integridade das informações permanece com o contribuinte, e o processamento final depende da Receita Federal.'
        ],
        image: {
          src: '/images/servicos/declaracao-imposto-renda/quem-precisa-declarar-imposto-renda.svg',
          alt: 'Resumo dos temas que exigem verificar a obrigação de declarar Imposto de Renda: rendimentos, patrimônio, atividade rural, ganho de capital, bolsa e exterior'
        }
      }
    ],
    included: [
      'Orientação inicial sobre a declaração.',
      'Análise das informações fornecidas e orientação sobre documentos.',
      'Conferência dos informes de rendimentos.',
      'Preenchimento da declaração e inclusão dos rendimentos aplicáveis.',
      'Inclusão dos bens, direitos, dívidas e investimentos aplicáveis.',
      'Análise das deduções informadas e conferência dos dependentes.',
      'Conferência da declaração pré-preenchida, quando utilizada.',
      'Revisão antes da transmissão.',
      'Transmissão da declaração pelos canais oficiais aplicáveis.',
      'Entrega da declaração e do recibo ao cliente.',
      'Orientação sobre eventual imposto a pagar ou restituição apurada.'
    ],
    excluded: [
      'Defesa em fiscalização, impugnação, recurso ou processo administrativo.',
      'Processo judicial ou representação jurídica.',
      'Regularização posterior de Malha Fina.',
      'Planejamento tributário complexo.',
      'Apuração empresarial ou contábil que não pertença ao IRPF comum.',
      'Regularização de exercícios adicionais sem a contratação correspondente.',
      'Tributos, DARFs, multas e encargos de responsabilidade do contribuinte.',
      'Garantia de restituição, redução de imposto, aprovação da Receita ou ausência de Malha Fina.'
    ],
    steps: [
      'O cliente solicita o atendimento referente a uma declaração e um exercício.',
      'Após a disponibilização da contratação, o pagamento é confirmado.',
      'A Resodi entra em contato e orienta o envio seguro das informações necessárias.',
      'Os documentos e dados são analisados e as pendências de informação são esclarecidas.',
      'A declaração é preparada e conferida com o cliente.',
      'A transmissão é realizada pelo canal oficial aplicável.',
      'O cliente recebe a declaração, o recibo e a orientação sobre o resultado apurado.'
    ],
    requestedInformation: [
      'Dados pessoais necessários ao preenchimento.',
      'Informes de rendimentos e de instituições financeiras.',
      'Documentos de bens, direitos, dívidas, dependentes e despesas aplicáveis.',
      'Informações sobre aluguéis, previdência, pensão, atividade rural, investimentos e exterior, quando houver.',
      'Declaração e recibo do exercício anterior, quando disponíveis.',
      'Outros documentos identificados como necessários durante a análise.'
    ],
    transparency: {
      paragraphs: [
        'A Resodi é uma empresa privada de serviços digitais e não possui vínculo com a Receita Federal, Gov.br ou outros órgãos públicos.',
        'A declaração oficial pode ser preparada e transmitida gratuitamente pelos canais da Receita Federal. O valor cobrado pela Resodi corresponde ao atendimento privado, preparação, conferência e execução do serviço.',
        'O resultado depende das informações apresentadas pelo contribuinte, das regras fiscais aplicáveis e do processamento da Receita Federal.'
      ]
    },
    seoSections: [
      {
        title: 'Posso declarar anos anteriores?',
        paragraphs: [
          'É possível preparar declarações de exercícios anteriores pelos meios disponibilizados para cada ano. Cada exercício tem regras, programa e documentos próprios.',
          'O preço informado nesta página corresponde a uma declaração por ano. Exercícios adicionais e regularizações posteriores exigem análise e contratação correspondentes.'
        ],
        links: [{ to: malhaFinaPath, label: 'Veja o serviço de regularização de pendências do Imposto de Renda' }]
      },
      {
        title: 'Segurança no atendimento do Imposto de Renda',
        paragraphs: [
          'A Resodi não armazena senha Gov.br, códigos de autenticação ou códigos 2FA. Quando um acesso autenticado for necessário, o cliente recebe orientação para realizar o procedimento de forma segura.',
          'Documentos e informações devem ser compartilhados somente pelos canais indicados durante o atendimento.'
        ]
      }
    ],
    faq: [
      ...annualFaq(annualConfig, year),
      ['Como fazer a declaração de Imposto de Renda?', 'Reúna os documentos, confira rendimentos, dependentes, despesas, patrimônio e investimentos, revise a forma de tributação, transmita pelos canais oficiais e guarde o recibo.'],
      ['Quais documentos preciso para declarar?', 'Depende da sua situação. Podem ser necessários informes de rendimentos, documentos bancários e de investimentos, bens, dependentes, despesas, declaração anterior e comprovantes específicos.'],
      ['O que é declaração pré-preenchida?', 'É uma modalidade que importa dados já existentes nas bases oficiais. O contribuinte continua responsável por conferir, corrigir, incluir e excluir informações.'],
      ['Preciso de conta Gov.br?', 'A conta Gov.br Prata ou Ouro é necessária para usar a declaração pré-preenchida e determinados recursos autenticados dos canais oficiais.'],
      ['O que posso deduzir no Imposto de Renda?', 'As regras podem permitir deduções como dependentes, despesas médicas, educação e previdência, conforme condições e limites aplicáveis.'],
      ['Despesas médicas podem ser deduzidas?', 'Podem ser dedutíveis quando se enquadram nas regras, pertencem às pessoas permitidas e possuem documentação idônea. Cada despesa precisa ser conferida.'],
      ['Gastos com educação podem ser deduzidos?', 'Alguns gastos de instrução podem ser dedutíveis dentro das categorias e do limite anual aplicável. Cursos livres, idiomas e materiais, por exemplo, não se tornam dedutíveis apenas por serem educacionais.'],
      ['Quem pode ser dependente?', 'A legislação define as pessoas e condições permitidas. Além do vínculo, é preciso conferir idade, guarda, rendimentos e eventual inclusão em outra declaração.'],
      ['Como saber se tenho restituição?', 'Somente o preenchimento com os dados reais permite apurar se haverá restituição, imposto a pagar ou nenhum saldo.'],
      ['A Resodi garante restituição?', 'Não. A restituição depende dos dados reais, das regras fiscais e do processamento da Receita Federal.'],
      ['Tenho imposto a pagar. O que acontece?', 'A declaração apresenta o saldo apurado e as formas de pagamento disponíveis pelas regras do exercício. Tributos e DARFs são responsabilidade do contribuinte.'],
      ['Posso declarar anos anteriores?', 'Sim, observando os meios, regras e documentos do exercício correspondente. Cada declaração/ano exige contratação própria.'],
      ['O que acontece se cair na Malha Fina?', 'É preciso identificar a pendência e verificar se o caso exige correção, documentos ou acompanhamento. A regularização posterior não faz parte automaticamente deste serviço.'],
      ['A Resodi é a Receita Federal?', 'Não. A Resodi é uma empresa privada e não possui vínculo com a Receita Federal, Gov.br ou outros órgãos públicos.'],
      ['O ano da página é atualizado automaticamente?', 'Sim. O nome público, o título principal e o SEO usam o ano corrente automaticamente. Números anuais só aparecem quando existe uma configuração validada para o mesmo exercício.']
    ]
  };
}

export const declaracaoImpostoRendaDetail = buildDeclaracaoImpostoRendaDetail();
