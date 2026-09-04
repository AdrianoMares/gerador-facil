import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { formatCurrencyBRL } from '../../utils/formatters';
import { downloadFinalDocument } from '../../services/commerce';
import { createPagBankPix } from '../../services/payments';

const pagBankSandboxEnabled = import.meta.env?.VITE_PAGBANK_SANDBOX_ENABLED === 'true';

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

export function CheckoutPage() {
  const { orderId } = useParams();
  const [state, setState] = useState({ loading: true, order: null });
  const [downloadMessage, setDownloadMessage] = useState('');
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', taxId: '' });
  const [pixState, setPixState] = useState({ loading: false, error: '', result: null, copied: false });

  useEffect(() => {
    let active = true;

    async function loadOrder() {
      if (!supabase) {
        if (active) setState({ loading: false, order: null });
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select('id, status, currency, subtotal_cents, total_cents, order_items(product_name, product_description, quantity, unit_price_cents, total_price_cents, resource_id)')
        .eq('id', orderId)
        .maybeSingle();

      if (active) setState({ loading: false, order: error ? null : data });
    }

    loadOrder();
    return () => { active = false; };
  }, [orderId]);

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
  const canDownload = state.order.status === 'paid' && Boolean(resourceId);

  async function handleDownload() {
    setDownloadMessage('');
    try {
      await downloadFinalDocument(resourceId);
    } catch {
      setDownloadMessage('Seu documento ainda não está disponível para download.');
    }
  }

  function handleCustomerChange(event) {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: value }));
  }

  async function handleCreatePix(event) {
    event.preventDefault();
    setPixState({ loading: true, error: '', result: null, copied: false });
    try {
      const result = await createPagBankPix({ orderId: state.order.id, customer });
      setPixState({ loading: false, error: '', result, copied: false });
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
        <section className="checkout-notice checkout-pix" aria-live="polite">
          <h2>Pagamento via Pix — Ambiente de teste</h2>
          <p>Seus dados de contato serão vinculados ao pedido. O CPF/CNPJ é usado apenas para criar a cobrança no PagBank e não é armazenado pela Resodi nesta etapa.</p>
          {!pixState.result ? (
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
          ) : (
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
              <p>Expira em: <strong>{new Date(pixState.result.pix.expiresAt).toLocaleString('pt-BR')}</strong></p>
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
      {canDownload && (
        <section className="checkout-notice" aria-live="polite">
          <h2>Documento disponível</h2>
          <p>Seu pagamento foi confirmado. O download será autorizado novamente no servidor.</p>
          <button className="button" type="button" onClick={handleDownload}>Baixar PDF</button>
          {downloadMessage && <p role="status">{downloadMessage}</p>}
        </section>
      )}
    </div>
  );
}
