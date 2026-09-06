import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPublicOrderStatus } from '../../services/payments';
import { formatCurrencyBRL } from '../../utils/formatters';

const statusLabels = {
  waiting: 'Aguardando pagamento',
  paid: 'Pago',
  expired_or_cancelled: 'Vencido/Cancelado'
};

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return 'Indisponível';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function PublicOrderPage() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true, order: null, error: '' });
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const order = await getPublicOrderStatus(token);
      setState({ loading: false, order, error: '' });
    } catch (error) {
      setState({
        loading: false,
        order: null,
        error: error?.code === 'ORDER_NOT_FOUND'
          ? 'Este link é inválido ou não está mais disponível.'
          : 'Não foi possível atualizar o pedido agora. Tente novamente em instantes.'
      });
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    getPublicOrderStatus(token)
      .then((order) => { if (active) setState({ loading: false, order, error: '' }); })
      .catch((error) => {
        if (active) {
          setState({
            loading: false,
            order: null,
            error: error?.code === 'ORDER_NOT_FOUND'
              ? 'Este link é inválido ou não está mais disponível.'
              : 'Não foi possível atualizar o pedido agora. Tente novamente em instantes.'
          });
        }
      });
    return () => { active = false; };
  }, [token]);

  async function handleCopy() {
    if (!state.order?.digitableLine || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(state.order.digitableLine);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (state.loading && !state.order) {
    return <div className="container page-section checkout-page"><p>Consultando pedido...</p></div>;
  }

  if (!state.order) {
    return (
      <div className="container page-section checkout-page">
        <span className="eyebrow">Acompanhamento</span>
        <h1>Pedido não encontrado</h1>
        <p>{state.error}</p>
        <Link className="text-link" to="/servicos">Conhecer os serviços</Link>
      </div>
    );
  }

  const order = state.order;
  return (
    <div className="container page-section checkout-page">
      <span className="eyebrow">Resodi</span>
      <h1>Acompanhe seu pedido</h1>
      <section className="checkout-card public-order-card" aria-live="polite">
        <div className="checkout-item">
          <div><h2>{order.serviceName}</h2><p>Serviço digital</p></div>
          <strong>{formatCurrencyBRL(order.amountCents / 100)}</strong>
        </div>
        <p className="checkout-status">Situação: <strong>{statusLabels[order.status]}</strong></p>
        <p>Vencimento: <strong>{formatDate(order.dueDate)}</strong></p>
        <label className="form-field">
          <span>Linha digitável</span>
          <textarea className="textarea checkout-pix-code" readOnly rows="3" value={order.digitableLine} />
        </label>
        <div className="public-order-actions">
          <button className="button" type="button" onClick={handleCopy}>Copiar linha digitável</button>
          <a className="button button-secondary" href={order.boletoUrl} target="_blank" rel="noreferrer">Abrir boleto oficial</a>
        </div>
        {copied && <p role="status">Linha digitável copiada.</p>}
        {order.status === 'waiting' && <p>O pedido será liberado somente após a confirmação oficial do PagBank.</p>}
        {order.status === 'paid' && <p>Seu pagamento foi confirmado e sua solicitação já foi registrada.</p>}
        {order.status === 'expired_or_cancelled' && <p>Este boleto não pode mais ser pago. Inicie uma nova contratação se ainda precisar do serviço.</p>}
        <button className="button button-secondary" type="button" onClick={load} disabled={state.loading}>
          {state.loading ? 'Atualizando...' : 'Atualizar situação'}
        </button>
        {state.error && <p className="checkout-pix-error" role="alert">{state.error}</p>}
      </section>
    </div>
  );
}
