import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { formatCurrencyBRL } from '../../utils/formatters';
import { downloadFinalDocument } from '../../services/commerce';
import {
  cardBinFromNumber,
  checkPagBankCardStatus,
  checkPagBankPixStatus,
  createPagBankCard,
  createPagBankPix,
  getPagBankCardInstallments,
  pollPagBankCardStatus,
  pollPagBankPixStatus
} from '../../services/payments';

const pagBankSandboxEnabled = import.meta.env?.VITE_PAGBANK_SANDBOX_ENABLED === 'true';
const paymentNoticeStyle = { borderColor: '#163B63', background: '#F4F6F8' };
const successNoticeStyle = { borderColor: '#b9dfcf', background: '#edf7f2' };
const successHeadingStyle = { color: '#247f59' };

const statusLabels = {
  pending_payment: 'Aguardando pagamento',
  paid: 'Pago',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  refunded: 'Reembolsado'
};

function formatCents(cents, currency) {
  if (currency !== 'BRL') return `${currency} ${((cents || 0) / 100).toFixed(2)}`;
  return formatCurrencyBRL((cents || 0) / 100);
}

async function fetchCheckoutState(orderId) {
  if (!supabase) return { loading: false, order: null, entitlements: [] };
  const [{ data, error }, { data: entitlements, error: entitlementError }] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, currency, subtotal_cents, total_cents, order_items(product_name, product_description, quantity, unit_price_cents, total_price_cents, resource_id)')
      .eq('id', orderId)
      .maybeSingle(),
    supabase
      .from('entitlements')
      .select('resource_id')
      .eq('order_id', orderId)
      .is('revoked_at', null)
  ]);
  return {
    loading: false,
    order: error ? null : data,
    entitlements: entitlementError || !Array.isArray(entitlements) ? [] : entitlements
  };
}

export function CheckoutPage() {
  const { orderId } = useParams();
  const [state, setState] = useState({ loading: true, order: null, entitlements: [] });
  const [downloadMessage, setDownloadMessage] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', taxId: '' });
  const [paymentMethod, setPaymentMethod] = useState('pix');
  const [pixState, setPixState] = useState({ loading: false, error: '', result: null, copied: false });
  const [holder, setHolder] = useState({ name: '', taxId: '' });
  const [sameHolderName, setSameHolderName] = useState(false);
  const [sameHolderTaxId, setSameHolderTaxId] = useState(false);
  const [card, setCard] = useState({ number: '', expMonth: '', expYear: '', securityCode: '' });
  const [cardState, setCardState] = useState({ loading: false, error: '', result: null });
  const [installmentPlans, setInstallmentPlans] = useState([]);
  const [selectedInstallments, setSelectedInstallments] = useState('');
  const [installmentsError, setInstallmentsError] = useState('');
  const [paymentCheck, setPaymentCheck] = useState({ checking: false, timedOut: false, error: '' });

  const loadOrder = useCallback(async () => {
    const nextState = await fetchCheckoutState(orderId);
    setState(nextState);
    return nextState.order;
  }, [orderId]);

  useEffect(() => {
    let active = true;
    fetchCheckoutState(orderId)
      .then((nextState) => { if (active) setState(nextState); })
      .catch(() => { if (active) setState({ loading: false, order: null, entitlements: [] }); });
    return () => { active = false; };
  }, [orderId]);

  useEffect(() => {
    if (!pixState.result || state.order?.status !== 'pending_payment') return undefined;
    const controller = new AbortController();

    pollPagBankPixStatus(state.order.id, { signal: controller.signal })
      .then(async (result) => {
        if (controller.signal.aborted) return;
        if (result.orderStatus === 'paid') await loadOrder();
        if (!controller.signal.aborted) {
          setPaymentCheck({ checking: false, timedOut: result.timedOut, error: '' });
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !controller.signal.aborted) {
          setPaymentCheck({ checking: false, timedOut: true, error: 'Não foi possível verificar automaticamente.' });
        }
      });

    return () => controller.abort();
  }, [loadOrder, pixState.result, state.order?.id, state.order?.status]);

  const cardBin = cardBinFromNumber(card.number);
  useEffect(() => {
    if (paymentMethod !== 'credit_card' || !cardBin || state.order?.status !== 'pending_payment') {
      return undefined;
    }
    let active = true;
    getPagBankCardInstallments(state.order.id, cardBin)
      .then((plans) => {
        if (!active) return;
        setInstallmentPlans(plans);
        setInstallmentsError('');
        setSelectedInstallments((current) => plans.some((plan) => String(plan.installments) === current)
          ? current : String(plans[0]?.installments || ''));
      })
      .catch(() => {
        if (active) {
          setInstallmentPlans([]);
          setSelectedInstallments('');
          setInstallmentsError('Não foi possível calcular as parcelas para este cartão.');
        }
      });
    return () => { active = false; };
  }, [cardBin, paymentMethod, state.order?.id, state.order?.status]);

  useEffect(() => {
    if (!cardState.result || state.order?.status !== 'pending_payment') return undefined;
    const controller = new AbortController();
    pollPagBankCardStatus(state.order.id, { signal: controller.signal })
      .then(async (result) => {
        if (controller.signal.aborted) return;
        if (result.orderStatus === 'paid') await loadOrder();
        if (!controller.signal.aborted) setPaymentCheck({ checking: false, timedOut: result.timedOut, error: '' });
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !controller.signal.aborted) {
          setPaymentCheck({ checking: false, timedOut: true, error: 'Não foi possível verificar automaticamente.' });
        }
      });
    return () => controller.abort();
  }, [cardState.result, loadOrder, state.order?.id, state.order?.status]);

  if (state.loading) {
    return <div className="container page-section checkout-page"><p>Carregando pedido...</p></div>;
  }

  if (!state.order) {
    return (
      <div className="container page-section checkout-page">
        <span className="eyebrow">Checkout</span>
        <h1>Pedido não encontrado</h1>
        <p>Não foi possível acessar este pedido.</p>
        <Link className="text-link" to="/ferramentas">Voltar para as ferramentas</Link>
      </div>
    );
  }

  const items = state.order.order_items || [];
  const pending = state.order.status === 'pending_payment';
  const resourceId = items.find((item) => item.resource_id)?.resource_id;
  const canDownload = state.order.status === 'paid'
    && Boolean(resourceId)
    && state.entitlements.some((entitlement) => entitlement.resource_id === resourceId);

  async function handleDownload() {
    if (downloading) return;
    setDownloadMessage('');
    setDownloading(true);
    try {
      await downloadFinalDocument(resourceId);
    } catch {
      setDownloadMessage('Seu documento ainda não está disponível para download.');
    } finally {
      setDownloading(false);
    }
  }

  function handleCustomerChange(event) {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: value }));
  }

  function handleCardChange(event) {
    const { name, value } = event.target;
    if (name === 'number' && cardBinFromNumber(value) !== cardBin) {
      setInstallmentPlans([]);
      setSelectedInstallments('');
      setInstallmentsError('');
    }
    setCard((current) => ({ ...current, [name]: value }));
  }

  function handlePaymentMethodChange(event) {
    setPaymentMethod(event.target.value);
    setPaymentCheck({ checking: false, timedOut: false, error: '' });
  }

  function handleHolderChange(event) {
    const { name, value } = event.target;
    setHolder((current) => ({ ...current, [name]: value }));
  }

  function handleSameHolderNameChange(event) {
    const checked = event.target.checked;
    setSameHolderName(checked);
    if (checked) setHolder((current) => ({ ...current, name: customer.name }));
  }

  function handleSameHolderTaxIdChange(event) {
    const checked = event.target.checked;
    setSameHolderTaxId(checked);
    if (checked) setHolder((current) => ({ ...current, taxId: customer.taxId }));
  }

  async function handleCreatePix(event) {
    event.preventDefault();
    setPixState({ loading: true, error: '', result: null, copied: false });
    try {
      const result = await createPagBankPix({ orderId: state.order.id, customer });
      setPixState({ loading: false, error: '', result, copied: false });
      setPaymentCheck({ checking: true, timedOut: false, error: '' });
    } catch (error) {
      const message = error?.code === 'PIX_CREATION_UNCERTAIN'
        ? 'Não foi possível confirmar a criação do Pix. Aguarde antes de tentar novamente.'
        : 'Não foi possível gerar o Pix de teste. Confira os dados e tente novamente.';
      setPixState({ loading: false, error: message, result: null, copied: false });
    }
  }

  async function handleCopyPix() {
    if (!pixState.result?.pix.copyPaste || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(pixState.result.pix.copyPaste);
      setPixState((current) => ({ ...current, copied: true }));
    } catch {
      setPixState((current) => ({ ...current, copied: false }));
    }
  }

  async function handleCreateCard(event) {
    event.preventDefault();
    setCardState({ loading: true, error: '', result: null });
    try {
      const result = await createPagBankCard({
        orderId: state.order.id,
        customer,
        holder: {
          name: sameHolderName ? customer.name : holder.name,
          taxId: sameHolderTaxId ? customer.taxId : holder.taxId
        },
        card,
        installments: Number(selectedInstallments)
      });
      setCard({ number: '', expMonth: '', expYear: '', securityCode: '' });
      setCardState({ loading: false, error: '', result });
      setPaymentCheck({ checking: true, timedOut: false, error: '' });
    } catch (error) {
      setCard((current) => ({ ...current, securityCode: '' }));
      const messages = {
        PAGBANK_DECLINED: 'Pagamento recusado. Confira os dados ou tente outro cartão.',
        PAGBANK_REJECTED: 'Pagamento recusado. Confira os dados ou tente outro cartão.',
        CARD_CREATION_UNCERTAIN: 'Não foi possível confirmar a cobrança. Aguarde antes de tentar novamente.',
        PUBLIC_KEY_NOT_CONFIGURED: 'A chave de cartão do ambiente de teste ainda não foi configurada.'
      };
      setCardState({
        loading: false,
        error: messages[error?.code] || 'Não foi possível processar o cartão. Confira os dados e tente novamente.',
        result: null
      });
    }
  }

  async function handleCheckPayment() {
    setPaymentCheck({ checking: true, timedOut: false, error: '' });
    try {
      const result = paymentMethod === 'credit_card'
        ? await checkPagBankCardStatus(state.order.id)
        : await checkPagBankPixStatus(state.order.id);
      if (result.orderStatus === 'paid') await loadOrder();
      setPaymentCheck({ checking: false, timedOut: result.orderStatus !== 'paid', error: '' });
    } catch {
      setPaymentCheck({ checking: false, timedOut: true, error: 'Não foi possível verificar o pagamento agora.' });
    }
  }

  return (
    <div className="container page-section checkout-page">
      <span className="eyebrow">Resodi</span>
      <h1>Resumo do pedido</h1>
      <section className="checkout-card" aria-label="Detalhes do pedido">
        {items.map((item, index) => (
          <div className="checkout-item" key={`${item.product_name}-${index}`}>
            <div>
              <h2>{item.product_name}</h2>
              {item.product_description && <p>{item.product_description}</p>}
              {item.quantity > 1 && <small>Quantidade: {item.quantity}</small>}
            </div>
            <strong>{formatCents(item.total_price_cents, state.order.currency)}</strong>
          </div>
        ))}
        <div className="checkout-total">
          <span>Total</span>
          <strong>{formatCents(state.order.total_cents, state.order.currency)}</strong>
        </div>
        <p className="checkout-status">Status: <strong>{statusLabels[state.order.status] || 'Indisponível'}</strong></p>
      </section>
      {pending && pagBankSandboxEnabled && (
        <section className="checkout-notice checkout-pix" style={paymentNoticeStyle} aria-live="polite">
          <h2>Pagamento — Ambiente de teste</h2>
          <p>Seus dados de contato serão vinculados ao pedido. O CPF/CNPJ é usado apenas para criar a cobrança no PagBank. Número, validade, CVV, BIN e cartão criptografado não são armazenados pela Resodi.</p>
          <fieldset className="checkout-payment-method">
            <legend>Forma de pagamento</legend>
            <label><input type="radio" name="paymentMethod" value="pix" checked={paymentMethod === 'pix'} onChange={handlePaymentMethodChange} /> Pix</label>
            <label><input type="radio" name="paymentMethod" value="credit_card" checked={paymentMethod === 'credit_card'} onChange={handlePaymentMethodChange} /> Cartão de crédito</label>
          </fieldset>
          {paymentMethod === 'pix' && !pixState.result && (
            <form className="checkout-pix-form" onSubmit={handleCreatePix}>
              <label className="form-field">
                <span>Nome completo</span>
                <input className="input" name="name" autoComplete="name" value={customer.name} onChange={handleCustomerChange} required />
              </label>
              <label className="form-field">
                <span>E-mail</span>
                <input className="input" type="email" name="email" autoComplete="email" value={customer.email} onChange={handleCustomerChange} required />
              </label>
              <label className="form-field">
                <span>WhatsApp</span>
                <input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={customer.phone} onChange={handleCustomerChange} required />
              </label>
              <label className="form-field">
                <span>CPF/CNPJ</span>
                <input className="input" name="taxId" inputMode="numeric" autoComplete="off" value={customer.taxId} onChange={handleCustomerChange} required />
              </label>
              <button className="button" type="submit" disabled={pixState.loading}>
                {pixState.loading ? 'Gerando Pix...' : 'Gerar Pix'}
              </button>
              {pixState.error && <p className="checkout-pix-error" role="alert">{pixState.error}</p>}
            </form>
          )}
          {paymentMethod === 'pix' && pixState.result && (
            <div className="checkout-pix-result">
              {pixState.result.pix.qrCodeUrl && (
                <img src={pixState.result.pix.qrCodeUrl} alt="QR Code Pix do ambiente de teste" width="240" height="240" />
              )}
              <label className="form-field">
                <span>Pix Copia e Cola</span>
                <textarea className="textarea checkout-pix-code" readOnly value={pixState.result.pix.copyPaste} rows="4" />
              </label>
              <button className="button" type="button" onClick={handleCopyPix}>Copiar código</button>
              {pixState.copied && <p role="status">Código Pix copiado.</p>}
              <p>Status: <strong>Aguardando pagamento</strong></p>
              {paymentCheck.checking && <p role="status">Verificando pagamento automaticamente...</p>}
              {paymentCheck.timedOut && (
                <button className="button" type="button" onClick={handleCheckPayment} disabled={paymentCheck.checking}>
                  Verificar pagamento
                </button>
              )}
              {paymentCheck.error && <p className="checkout-pix-error" role="alert">{paymentCheck.error}</p>}
              <p>Expira em: <strong>{new Date(pixState.result.pix.expiresAt).toLocaleString('pt-BR')}</strong></p>
              <p><strong>Ambiente de teste:</strong> nenhum pagamento real será processado.</p>
            </div>
          )}
          {paymentMethod === 'credit_card' && !cardState.result && (
            <form className="checkout-card-form" onSubmit={handleCreateCard}>
              <label className="form-field">
                <span>Nome completo</span>
                <input className="input" name="name" autoComplete="name" value={customer.name} onChange={handleCustomerChange} required />
              </label>
              <label className="form-field">
                <span>E-mail</span>
                <input className="input" type="email" name="email" autoComplete="email" value={customer.email} onChange={handleCustomerChange} required />
              </label>
              <label className="form-field">
                <span>WhatsApp</span>
                <input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={customer.phone} onChange={handleCustomerChange} required />
              </label>
              <label className="form-field">
                <span>CPF/CNPJ do pagador</span>
                <input className="input" name="taxId" inputMode="numeric" autoComplete="off" value={customer.taxId} onChange={handleCustomerChange} required />
              </label>
              <div className="form-field">
                <label htmlFor="card-holder-name">Nome do titular</label>
                <input id="card-holder-name" className="input" name="name" autoComplete="cc-name" value={sameHolderName ? customer.name : holder.name} onChange={handleHolderChange} readOnly={sameHolderName} required />
                <label className="checkbox-field">
                  <input type="checkbox" checked={sameHolderName} onChange={handleSameHolderNameChange} />
                  Igual ao nome completo acima
                </label>
              </div>
              <div className="form-field">
                <label htmlFor="card-holder-tax-id">CPF do titular</label>
                <input id="card-holder-tax-id" className="input" name="taxId" inputMode="numeric" autoComplete="off" value={sameHolderTaxId ? customer.taxId : holder.taxId} onChange={handleHolderChange} readOnly={sameHolderTaxId} required />
                <label className="checkbox-field">
                  <input type="checkbox" checked={sameHolderTaxId} onChange={handleSameHolderTaxIdChange} />
                  Igual ao CPF do pagador acima
                </label>
              </div>
              <label className="form-field checkout-card-number">
                <span>Número do cartão</span>
                <input className="input" name="number" inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={handleCardChange} required />
              </label>
              <label className="form-field">
                <span>Mês de validade</span>
                <input className="input" name="expMonth" inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" maxLength="2" value={card.expMonth} onChange={handleCardChange} required />
              </label>
              <label className="form-field">
                <span>Ano de validade</span>
                <input className="input" name="expYear" inputMode="numeric" autoComplete="cc-exp-year" placeholder="AAAA" maxLength="4" value={card.expYear} onChange={handleCardChange} required />
              </label>
              <label className="form-field">
                <span>CVV</span>
                <input className="input" type="password" name="securityCode" inputMode="numeric" autoComplete="cc-csc" maxLength="4" value={card.securityCode} onChange={handleCardChange} required />
              </label>
              <label className="form-field checkout-card-number">
                <span>Parcelas</span>
                <select className="select" value={selectedInstallments} onChange={(event) => setSelectedInstallments(event.target.value)} disabled={!installmentPlans.length} required>
                  <option value="">Informe o cartão para calcular</option>
                  {installmentPlans.map((plan) => (
                    <option key={plan.installments} value={plan.installments}>
                      {plan.installments}x de {formatCents(plan.installmentValue, 'BRL')}
                      {plan.interestFree ? ' sem taxa' : ` — total ${formatCents(plan.totalAmount, 'BRL')}`}
                    </option>
                  ))}
                </select>
              </label>
              {installmentsError && <p className="checkout-pix-error checkout-card-number" role="alert">{installmentsError}</p>}
              <button className="button checkout-card-number" type="submit" disabled={cardState.loading || !selectedInstallments}>
                {cardState.loading ? 'Processando pagamento...' : 'Pagar com cartão'}
              </button>
              {cardState.error && <p className="checkout-pix-error checkout-card-number" role="alert">{cardState.error}</p>}
            </form>
          )}
          {paymentMethod === 'credit_card' && cardState.result && (
            <div className="checkout-card-result">
              <p><strong>Pagamento em processamento.</strong> A confirmação será feita diretamente com o PagBank.</p>
              {paymentCheck.checking && <p role="status">Verificando pagamento automaticamente...</p>}
              {paymentCheck.timedOut && (
                <button className="button" type="button" onClick={handleCheckPayment} disabled={paymentCheck.checking}>Verificar pagamento</button>
              )}
              {paymentCheck.error && <p className="checkout-pix-error" role="alert">{paymentCheck.error}</p>}
              <p><strong>Ambiente de teste:</strong> nenhum pagamento real será processado.</p>
            </div>
          )}
        </section>
      )}
      {pending && !pagBankSandboxEnabled && (
        <section className="checkout-notice" aria-live="polite">
          <h2>Pagamento ainda não disponível</h2>
          <p>Estamos finalizando a configuração das formas de pagamento.</p>
        </section>
      )}
      {state.order.status === 'paid' && (
        <section className="checkout-notice" style={successNoticeStyle} aria-live="polite">
          <h2 style={successHeadingStyle}>Pagamento confirmado</h2>
          <p>O PagBank confirmou o pagamento deste pedido.</p>
        </section>
      )}
      {canDownload && (
        <section className="checkout-notice" style={successNoticeStyle} aria-live="polite">
          <h2 style={successHeadingStyle}>Documento disponível</h2>
          <p>Seu pagamento foi confirmado. O download será autorizado novamente no servidor.</p>
          <button className="button" type="button" onClick={handleDownload} disabled={downloading} aria-busy={downloading}>
            {downloading ? 'Gerando PDF...' : 'Baixar PDF'}
          </button>
          {downloadMessage && <p role="status">{downloadMessage}</p>}
        </section>
      )}
    </div>
  );
}
