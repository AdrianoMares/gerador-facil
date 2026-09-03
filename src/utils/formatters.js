export function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value || 0));
}

const BRAZILIAN_AREA_CODES = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99'
]);

export function formatBrazilianPhone(value) {
  if (typeof value !== 'string') return value;
  const original = value;
  const trimmed = value.trim();
  if (!trimmed || !/^[+\d\s().-]+$/.test(trimmed)) return original;

  const hasCountryCode = trimmed.startsWith('+55');
  if (trimmed.startsWith('+') && !hasCountryCode) return original;

  const digits = trimmed.replace(/\D/g, '');
  const national = hasCountryCode ? digits.slice(2) : digits;
  if ((hasCountryCode && !digits.startsWith('55')) || ![10, 11].includes(national.length)) return original;

  const areaCode = national.slice(0, 2);
  const localNumber = national.slice(2);
  const validAreaCode = BRAZILIAN_AREA_CODES.has(areaCode);
  const validLocalNumber = national.length === 11
    ? /^9\d{8}$/.test(localNumber)
    : /^[2-5]\d{7}$/.test(localNumber);
  if (!validAreaCode || !validLocalNumber) return original;

  const formatted = national.length === 11
    ? `(${areaCode}) ${localNumber.slice(0, 5)}-${localNumber.slice(5)}`
    : `(${areaCode}) ${localNumber.slice(0, 4)}-${localNumber.slice(4)}`;
  return hasCountryCode ? `+55 ${formatted}` : formatted;
}
