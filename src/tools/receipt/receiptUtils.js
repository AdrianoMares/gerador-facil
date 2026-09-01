const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function joinParts(parts) {
  return parts.filter(Boolean).join(' e ');
}

function groupToWords(number) {
  if (number === 100) return 'cem';

  const hundred = Math.floor(number / 100);
  const remainder = number % 100;
  const ten = Math.floor(remainder / 10);
  const unit = remainder % 10;

  if (remainder >= 10 && remainder < 20) {
    return joinParts([hundreds[hundred], teens[remainder - 10]]);
  }

  return joinParts([hundreds[hundred], tens[ten], units[unit]]);
}

function integerToWords(number) {
  if (number === 0) return 'zero';

  const groups = [
    { value: Math.floor(number / 1000000000), singular: 'bilhão', plural: 'bilhões' },
    { value: Math.floor(number / 1000000) % 1000, singular: 'milhão', plural: 'milhões' },
    { value: Math.floor(number / 1000) % 1000, singular: 'mil', plural: 'mil' },
    { value: number % 1000, singular: '', plural: '' }
  ];

  const writtenGroups = groups
    .filter(({ value }) => value > 0)
    .map(({ value, singular, plural }) => {
      if (singular === 'mil' && value === 1) return 'mil';
      const scale = value === 1 ? singular : plural;
      return `${groupToWords(value)}${scale ? ` ${scale}` : ''}`;
    });

  return writtenGroups.join(' e ');
}

export function amountToWordsBRL(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount >= 1000000000000) return '';

  const totalCents = Math.round(amount * 100);
  const reais = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const parts = [];

  if (reais > 0 || cents === 0) {
    parts.push(`${integerToWords(reais)} ${reais === 1 ? 'real' : 'reais'}`);
  }

  if (cents > 0) {
    parts.push(`${integerToWords(cents)} ${cents === 1 ? 'centavo' : 'centavos'}`);
  }

  return parts.join(' e ');
}

export function formatReceiptDate(value) {
  if (!value) return 'data não informada';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
}
