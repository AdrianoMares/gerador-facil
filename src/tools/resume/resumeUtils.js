export function formatResumePeriod(startDate, endDate, current = false) {
  const formatMonth = (value) => {
    if (!value) return '';
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return value;
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' })
      .format(new Date(year, month - 1, 1))
      .replace('.', '');
  };

  const start = formatMonth(startDate);
  const end = current ? 'Atual' : formatMonth(endDate);

  if (!start && !end) return '';
  return [start || 'Início não informado', end || 'Fim não informado'].join(' — ');
}
