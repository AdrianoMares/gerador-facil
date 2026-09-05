import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createCheckoutOrder, recordServiceLegalAcceptances } from '../services/commerce';
import { formatCurrencyBRL } from '../utils/formatters';

const unavailableMessage = 'A contratação deste serviço ainda está sendo configurada.';

export function ServicePurchase({ service }) {
  const [message, setMessage] = useState('');
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const navigate = useNavigate();

  if (service.status !== 'active' || !service.checkout?.productCode) return null;

  async function handlePurchase() {
    setMessage('');

    if (!termsAccepted || !privacyAccepted) {
      setMessage('Marque os aceites obrigatórios para continuar.');
      return;
    }

    setIsStartingCheckout(true);

    try {
      await recordServiceLegalAcceptances();
      const { checkoutUrl } = await createCheckoutOrder({
        productCode: service.checkout.productCode,
        resourceId: null
      });
      navigate(checkoutUrl);
    } catch (error) {
      if (error.code === 'UNAUTHORIZED') {
        setMessage('Faça uma nova verificação para continuar.');
      } else if (error.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
        setMessage('Não foi possível confirmar os aceites obrigatórios. Tente novamente.');
      } else if (error.code === 'PRODUCT_NOT_AVAILABLE') {
        setMessage(unavailableMessage);
      } else {
        setMessage('Não foi possível preparar o pagamento agora. Tente novamente em instantes.');
      }
    } finally {
      setIsStartingCheckout(false);
    }
  }

  const hasPrice = Number.isInteger(service.priceCents) && service.priceCents > 0;

  return (
    <aside className="service-purchase" aria-label="Contratação do serviço">
      <span>Contratação online</span>
      <strong>Pronto para contratar?</strong>
      {hasPrice && <div className="service-purchase-price">{formatCurrencyBRL(service.priceCents / 100)}</div>}
      <p>Você seguirá para o checkout seguro, com Pix ou cartão de crédito.</p>

      <label className="service-legal-check">
        <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
        <span>Li e aceito os <Link to="/termos-de-uso" target="_blank" rel="noreferrer">Termos de Uso</Link>.</span>
      </label>
      <label className="service-legal-check">
        <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
        <span>Li e aceito a <Link to="/politica-de-privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>.</span>
      </label>

      <button className="button" type="button" onClick={handlePurchase} disabled={isStartingCheckout}>
        {isStartingCheckout ? 'Preparando...' : 'Contratar serviço'}
      </button>
      {message && <p className="service-purchase-message" role="status">{message}</p>}
    </aside>
  );
}
