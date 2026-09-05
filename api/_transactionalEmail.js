import { createHash } from 'node:crypto';

const RESEND_API_URL = 'https://api.resend.com/emails';
const EMAIL_FROM = 'Resodi <atendimento@resodi.com.br>';
const EMAIL_REPLY_TO = 'atendimento@resodi.com.br';
const RESEND_TIMEOUT_MS = 12_000;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatCurrency(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

function formatDate(date) {
  const [year, month, day] = String(date).split('-');
  return `${day}/${month}/${year}`;
}

function emailLayout(content) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F4F6F8;font-family:Arial,sans-serif;color:#0D2742"><div style="max-width:600px;margin:0 auto;padding:32px 20px"><div style="background:#FFFFFF;border:1px solid #dce3e9;border-radius:14px;padding:28px"><h1 style="margin:0 0 20px;color:#163B63;font-size:24px">Resodi</h1>${content}<p style="margin:28px 0 0;color:#526a7d;font-size:14px">Resolva serviços digitais.</p></div></div></body></html>`;
}

function safeErrorCode(error) {
  const code = typeof error?.code === 'string' ? error.code : error?.message;
  return /^[A-Z0-9_]{1,80}$/.test(code || '') ? code : 'EMAIL_DELIVERY_FAILED';
}

async function claim(backend, orderId, emailType) {
  const { data, error } = await backend.rpc('claim_transactional_email', {
    p_order_id: orderId,
    p_email_type: emailType
  });
  if (error) throw new Error('EMAIL_CLAIM_FAILED');
  return data === true;
}

async function complete(backend, orderId, emailType, success, errorCode = null) {
  const { data, error } = await backend.rpc('complete_transactional_email', {
    p_order_id: orderId,
    p_email_type: emailType,
    p_success: success,
    p_error_code: errorCode
  });
  if (error || data !== true) throw new Error('EMAIL_STATE_FAILED');
}

export async function deliverTransactionalEmail({
  backend,
  orderId,
  emailType,
  to,
  subject,
  html,
  fetchImpl = fetch,
  env = process.env,
  logError = console.error
}) {
  let claimed = false;
  try {
    claimed = await claim(backend, orderId, emailType);
    if (!claimed) return { sent: false, skipped: true };
    if (!env.RESEND_API_KEY) throw Object.assign(new Error('EMAIL_NOT_CONFIGURED'), { code: 'EMAIL_NOT_CONFIGURED' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
    let response;
    try {
      response = await fetchImpl(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `resodi-${emailType}-${createHash('sha256').update(orderId).digest('hex').slice(0, 32)}`
        },
        body: JSON.stringify({ from: EMAIL_FROM, reply_to: EMAIL_REPLY_TO, to: [to], subject, html }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok || response.status < 200 || response.status >= 300) {
      throw Object.assign(new Error('RESEND_REJECTED'), { code: `RESEND_HTTP_${response.status}` });
    }
    await complete(backend, orderId, emailType, true);
    return { sent: true, skipped: false };
  } catch (error) {
    const errorCode = safeErrorCode(error);
    if (claimed) {
      try {
        await complete(backend, orderId, emailType, false, errorCode);
      } catch {
        // The payment flow must remain successful even if email state persistence is unavailable.
      }
    }
    logError('Transactional email failed', { emailType, code: errorCode });
    return { sent: false, skipped: false };
  }
}

export function boletoGeneratedEmail({ serviceName, amountCents, dueDate, digitableLine, publicUrl }) {
  const safeUrl = escapeHtml(publicUrl);
  return {
    subject: 'Seu boleto da Resodi foi gerado',
    html: emailLayout(`<h2 style="font-size:20px">Seu boleto foi gerado</h2><p><strong>Serviço:</strong> ${escapeHtml(serviceName)}</p><p><strong>Valor:</strong> ${escapeHtml(formatCurrency(amountCents))}</p><p><strong>Vencimento:</strong> ${escapeHtml(formatDate(dueDate))}</p><p><strong>Linha digitável:</strong><br><span style="word-break:break-all">${escapeHtml(digitableLine)}</span></p><p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;background:#163B63;color:#FFFFFF;text-decoration:none;padding:13px 20px;border-radius:8px;font-weight:bold">Acessar meu pedido</a></p>`)
  };
}

export function servicePaymentConfirmedEmail({ serviceName }) {
  return {
    subject: 'Pagamento confirmado',
    html: emailLayout(`<h2 style="font-size:20px">Sua solicitação foi recebida</h2><p>Seu pagamento do serviço <strong>${escapeHtml(serviceName)}</strong> foi confirmado e sua solicitação já foi registrada. Em breve, você receberá neste e-mail as instruções para dar continuidade ao serviço.</p>`)
  };
}

export async function sendServicePaymentConfirmedEmail({
  backend,
  orderId,
  fetchImpl = fetch,
  env = process.env,
  logError = console.error
}) {
  try {
    const [{ data: contact, error: contactError }, { data: request, error: requestError }] = await Promise.all([
      backend.from('order_contacts').select('email').eq('order_id', orderId).maybeSingle(),
      backend.from('service_requests').select('service_name').eq('order_id', orderId).limit(1).maybeSingle()
    ]);
    if (contactError || requestError || !contact?.email || !request?.service_name) {
      throw new Error('EMAIL_CONTEXT_UNAVAILABLE');
    }
    const content = servicePaymentConfirmedEmail({ serviceName: request.service_name });
    return deliverTransactionalEmail({
      backend, orderId, emailType: 'service_payment_confirmed', to: contact.email,
      ...content, fetchImpl, env, logError
    });
  } catch (error) {
    logError('Transactional email context failed', {
      emailType: 'service_payment_confirmed', code: safeErrorCode(error)
    });
    return { sent: false, skipped: false };
  }
}
