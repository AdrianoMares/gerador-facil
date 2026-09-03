import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { formatCurrencyBRL } from '../../utils/formatters';
import { downloadFinalDocument } from '../../services/commerce';

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
      {pending && (
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
