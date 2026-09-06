import { jsPDF } from 'jspdf';

const COLORS = {
  navy: [22, 59, 99],
  dark: [13, 39, 66],
  green: [46, 158, 111],
  muted: [91, 104, 118],
  line: [214, 221, 228]
};

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function amount(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function amountInWords(value) {
  const total = Math.round((Number(value) || 0) * 100);
  const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const group = (number) => {
    if (number === 100) return 'cem';
    const parts = [hundreds[Math.floor(number / 100)]];
    const rest = number % 100;
    if (rest >= 10 && rest < 20) parts.push(teens[rest - 10]);
    else parts.push(tens[Math.floor(rest / 10)], units[rest % 10]);
    return parts.filter(Boolean).join(' e ');
  };
  const integer = (number) => {
    if (number === 0) return 'zero';
    const groups = [
      [Math.floor(number / 1000000), 'milhão', 'milhões'],
      [Math.floor(number / 1000) % 1000, 'mil', 'mil'],
      [number % 1000, '', '']
    ];
    return groups.filter(([number]) => number).map(([number, singular, plural]) => {
      if (singular === 'mil' && number === 1) return 'mil';
      return `${group(number)}${singular ? ` ${number === 1 ? singular : plural}` : ''}`;
    }).join(' e ');
  };
  const reais = Math.floor(total / 100);
  const cents = total % 100;
  return `${integer(reais)} ${reais === 1 ? 'real' : 'reais'}${cents ? ` e ${integer(cents)} ${cents === 1 ? 'centavo' : 'centavos'}` : ''}`;
}

function receiptDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text(value))) return 'data não informada';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function resumePeriod(startDate, endDate, current) {
  const date = (value) => {
    if (!/^\d{4}-\d{2}$/.test(text(value))) return '';
    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '');
  };
  const start = date(startDate);
  const end = current ? 'Atual' : date(endDate);
  return [start, end].filter(Boolean).join(' - ');
}

function newPdf() {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: 'Documento Resodi', author: 'Resodi', creator: 'Resodi' });
  return pdf;
}

function setColor(pdf, color) {
  pdf.setTextColor(...color);
}

function asBuffer(pdf) {
  return Buffer.from(pdf.output('arraybuffer'));
}

export function renderReceiptPdf(payload, { variant = 'final' } = {}) {
  if (variant !== 'final' && variant !== 'watermarked') throw new Error('INVALID_PDF_VARIANT');
  const pdf = newPdf();
  const width = pdf.internal.pageSize.getWidth();
  const margin = 22;
  const usable = width - margin * 2;

  setColor(pdf, COLORS.navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('COMPROVANTE DE PAGAMENTO', margin, 27);
  pdf.setFontSize(28);
  pdf.text('RECIBO', margin, 40);
  pdf.setDrawColor(...COLORS.green);
  pdf.setLineWidth(1.2);
  pdf.line(margin, 46, width - margin, 46);

  pdf.setFillColor(...COLORS.navy);
  pdf.roundedRect(width - margin - 55, 20, 55, 22, 2, 2, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('VALOR', width - margin - 50, 28);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text(amount(payload?.amount), width - margin - 50, 36);

  setColor(pdf, COLORS.dark);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  const statement = `Recebi de ${text(payload?.payerName, 'nome de quem pagou')}${text(payload?.payerDocument) ? ` (CPF/CNPJ ${text(payload.payerDocument)})` : ''}, a importância de ${amount(payload?.amount)} (${amountInWords(payload?.amount)}).`;
  const statementLines = pdf.splitTextToSize(statement, usable);
  pdf.text(statementLines, margin, 64, { lineHeightFactor: 1.55 });
  const descriptionY = 64 + statementLines.length * 6.5 + 10;
  pdf.setFillColor(244, 246, 248);
  pdf.roundedRect(margin, descriptionY - 7, usable, 25, 2, 2, 'F');
  setColor(pdf, COLORS.muted);
  pdf.setFontSize(9);
  pdf.text('REFERENTE A', margin + 6, descriptionY);
  setColor(pdf, COLORS.dark);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  const description = pdf.splitTextToSize(text(payload?.description, 'Descrição do pagamento'), usable - 12);
  pdf.text(description.slice(0, 2), margin + 6, descriptionY + 7, { lineHeightFactor: 1.3 });

  const locationY = descriptionY + 36;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(`${text(payload?.city, 'Cidade')}, ${receiptDate(text(payload?.date))}.`, margin, locationY);
  const signatureY = Math.max(locationY + 45, 185);
  pdf.setDrawColor(...COLORS.line);
  pdf.setLineWidth(0.4);
  pdf.line(width / 2 - 35, signatureY, width / 2 + 35, signatureY);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(text(payload?.recipientName, 'Nome de quem recebeu'), width / 2, signatureY + 7, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const document = text(payload?.recipientDocument);
  if (document) pdf.text(`CPF/CNPJ ${document}`, width / 2, signatureY + 13, { align: 'center' });
  pdf.text('Assinatura do recebedor', width / 2, signatureY + (document ? 20 : 15), { align: 'center' });

  if (variant === 'watermarked') {
    pdf.setTextColor(22, 59, 99, 0.12);
    pdf.setFontSize(38);
    pdf.text('PRÉVIA RESODI', width / 2, 145, { align: 'center', angle: 35 });
  }
  return asBuffer(pdf);
}

function resumeHeader(pdf, personal) {
  const width = pdf.internal.pageSize.getWidth();
  pdf.setFillColor(...COLORS.navy);
  pdf.rect(0, 0, width, 43, 'F');
  pdf.setFillColor(...COLORS.green);
  pdf.rect(0, 0, 5, 43, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(23);
  pdf.text(text(personal?.fullName, 'Nome completo'), 18, 20);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.text(text(personal?.professionalTitle, 'Título profissional'), 18, 28);
  pdf.setFontSize(9);
  const contact = [text(personal?.phone), text(personal?.email), text(personal?.location)].filter(Boolean).join('  |  ');
  if (contact) pdf.text(contact, 18, 36);
}

function ensureSpace(pdf, y, needed) {
  const height = pdf.internal.pageSize.getHeight();
  if (y + needed <= height - 18) return y;
  pdf.addPage();
  return 20;
}

function sectionTitle(pdf, title, y) {
  setColor(pdf, COLORS.navy);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text(title.toUpperCase(), 18, y);
  pdf.setDrawColor(...COLORS.green);
  pdf.setLineWidth(0.6);
  pdf.line(18, y + 3, 192, y + 3);
  return y + 10;
}

function writeLines(pdf, value, x, y, width, options = {}) {
  const lines = pdf.splitTextToSize(text(value), width);
  pdf.text(lines, x, y, { lineHeightFactor: options.lineHeightFactor || 1.35 });
  return y + lines.length * (options.lineHeight || 4.8);
}

export function renderResumePdf(payload, { variant = 'final' } = {}) {
  if (variant !== 'final' && variant !== 'watermarked') throw new Error('INVALID_PDF_VARIANT');
  const pdf = newPdf();
  const personal = payload?.personal && typeof payload.personal === 'object' ? payload.personal : {};
  resumeHeader(pdf, personal);
  let y = 55;

  if (text(payload?.professionalSummary)) {
    y = ensureSpace(pdf, y, 28);
    y = sectionTitle(pdf, 'Resumo profissional', y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    setColor(pdf, COLORS.dark);
    y = writeLines(pdf, payload.professionalSummary, 18, y, 174) + 7;
  }

  const experiences = list(payload?.experiences);
  if (experiences.length) {
    y = ensureSpace(pdf, y, 25);
    y = sectionTitle(pdf, 'Experiência profissional', y);
    for (const experience of experiences) {
      const activities = list(experience?.activities).map((item) => text(item?.description)).filter(Boolean);
      const preview = [text(experience?.role), text(experience?.company), resumePeriod(experience?.startDate, experience?.endDate, experience?.current), ...activities].join(' ');
      y = ensureSpace(pdf, y, Math.min(48, pdf.splitTextToSize(preview, 174).length * 5 + 12));
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      setColor(pdf, COLORS.dark);
      pdf.text(text(experience?.role, 'Cargo'), 18, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      setColor(pdf, COLORS.navy);
      pdf.text(text(experience?.company, 'Empresa'), 18, y + 5);
      pdf.setFontSize(9);
      setColor(pdf, COLORS.muted);
      const period = resumePeriod(experience?.startDate, experience?.endDate, experience?.current);
      if (period) pdf.text(period, 192, y, { align: 'right' });
      y += 12;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      setColor(pdf, COLORS.dark);
      for (const activity of activities) {
        const lines = pdf.splitTextToSize(`• ${activity}`, 168);
        y = ensureSpace(pdf, y, lines.length * 4.7 + 2);
        pdf.text(lines, 22, y, { lineHeightFactor: 1.3 });
        y += lines.length * 4.7 + 1.5;
      }
      y += 5;
    }
  }

  const education = list(payload?.education);
  if (education.length) {
    y = ensureSpace(pdf, y, 25);
    y = sectionTitle(pdf, 'Formação acadêmica', y);
    for (const item of education) {
      y = ensureSpace(pdf, y, 18);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); setColor(pdf, COLORS.dark);
      pdf.text(text(item?.course, 'Formação'), 18, y);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); setColor(pdf, COLORS.muted);
      pdf.text(text(item?.institution, 'Instituição'), 18, y + 5);
      const period = resumePeriod(item?.startDate, item?.endDate);
      if (period) pdf.text(period, 192, y, { align: 'right' });
      y += 12;
    }
  }

  const courses = list(payload?.courses);
  if (courses.length) {
    y = ensureSpace(pdf, y, 25);
    y = sectionTitle(pdf, 'Cursos complementares', y);
    for (const item of courses) {
      y = ensureSpace(pdf, y, 16);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); setColor(pdf, COLORS.dark);
      pdf.text(text(item?.name, 'Curso'), 18, y);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); setColor(pdf, COLORS.muted);
      const detail = [text(item?.institution), resumePeriod(item?.completionDate)].filter(Boolean).join(' - ');
      if (detail) pdf.text(detail, 18, y + 5);
      y += 11;
    }
  }

  const skills = list(payload?.skills).map((item) => text(item?.name)).filter(Boolean);
  if (skills.length) {
    y = ensureSpace(pdf, y, 25);
    y = sectionTitle(pdf, 'Habilidades', y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); setColor(pdf, COLORS.dark);
    writeLines(pdf, skills.join('  •  '), 18, y, 174);
  }

  if (variant === 'watermarked') {
    pdf.setTextColor(22, 59, 99, 0.12); pdf.setFontSize(38);
    pdf.text('PRÉVIA RESODI', 105, 145, { align: 'center', angle: 35 });
  }
  return asBuffer(pdf);
}

export function renderDocumentPdf(serviceType, payload, options) {
  if (serviceType === 'receipt') return { filename: 'recibo-resodi.pdf', content: renderReceiptPdf(payload, options) };
  if (serviceType === 'resume') return { filename: 'curriculo-resodi.pdf', content: renderResumePdf(payload, options) };
  throw new Error('UNSUPPORTED_DOCUMENT');
}
