const impostoRendaAnnualConfigs = {
  2026: {
    exerciseYear: 2026,
    calendarYear: 2025,
    regularDeadline: {
      startsAt: '23 de março de 2026',
      endsAt: '29 de maio de 2026'
    },
    obligation: {
      taxableIncome: 'R$ 35.584,00',
      exemptIncome: 'R$ 200.000,00',
      ruralRevenue: 'R$ 177.920,00',
      exchangeSales: 'R$ 40.000,00',
      commonStockMonthlySales: 'R$ 20.000,00',
      assets: 'R$ 800.000,00'
    },
    lateFilingPenalty: {
      monthlyRate: '1% por mês-calendário ou fração',
      minimum: 'R$ 165,74',
      maximum: '20% do imposto devido'
    },
    deductions: {
      dependent: 'R$ 2.275,08',
      education: 'R$ 3.561,50',
      simplifiedRate: '20%',
      simplifiedLimit: 'R$ 16.754,34'
    },
    refundSchedule: [
      ['1º lote', '29 de maio de 2026'],
      ['2º lote', '30 de junho de 2026'],
      ['3º lote', '31 de julho de 2026'],
      ['4º lote', '31 de agosto de 2026']
    ],
    news: [
      'Novos limites de obrigatoriedade para rendimentos tributáveis e atividade rural.',
      'Inclusão do campo autodeclarado de raça/cor.',
      'Possibilidade de uso do nome civil ou social no preenchimento.',
      'Otimização da captação de informações de dependentes na declaração pré-preenchida.',
      'Nova crítica de transmissão para débito automático com informação bancária incompleta.',
      'Novos recursos e alertas no Meu Imposto de Renda, inclusive para renda variável e chave Pix CPF.',
      'Pagamento das restituições em quatro lotes regulares.'
    ],
    officialSources: [
      'https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf/obrigacao/quem',
      'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/novidades',
      'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/multa',
      'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/declaracao-pre-preenchida',
      'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/restituicao/lotes',
      'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2025'
    ]
  }
};

export function getImpostoRendaAnnualConfig(year) {
  const config = impostoRendaAnnualConfigs[year];
  return config?.exerciseYear === year ? config : null;
}
