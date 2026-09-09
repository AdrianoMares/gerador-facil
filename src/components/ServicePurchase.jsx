import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutOrder, recordServiceLegalAcceptances } from '../services/commerce';
import { canStartServicePurchase, isServiceCheckoutReady } from '../services/servicePurchase.js';
import { formatCurrencyBRL } from '../utils/formatters';
import { ServiceLegalAcceptance } from './ServiceLegalAcceptance';
import './ServicePurchase.css';

const unavailableMessage = 'A contratação deste serviço ainda está sendo configurada.';

export function ServicePurchase({ service, environmentEnabled = false }) {
  const [message, setMessage] = useState('');
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const navigate = useNavigate();

  if (!isServiceCheckoutReady(service)) return null;

  const purchaseEnabled = environmentEnabled === true;

  async function handlePurchase() {
    setMessage('');

    if (!purchaseEnabled) {
      setMessage(unavailableMessage);
      return;
    }

    if (!canStartServicePurchase(service, purchaseEnabled, termsAccepted, privacyAccepted)) {
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
  const purchaseTitle = service.detail?.purchaseTitle || 'Pronto para contratar?';
  const purchaseDescription = service.detail?.purchaseDescription || 'Você seguirá para o checkout seguro, com Pix, cartão de crédito ou boleto.';

  return (
    <aside className="service-purchase" aria-label="Contratação do serviço">
      <span>Contratação online</span>
      <strong>{purchaseTitle}</strong>
      {hasPrice && (
        <div className="service-purchase-price">
          {formatCurrencyBRL(service.priceCents / 100)}
          {service.priceSuffix && <small>{service.priceSuffix}</small>}
        </div>
      )}
      <p>{purchaseDescription}</p>

      <ServiceLegalAcceptance
        termsAccepted={termsAccepted}
        privacyAccepted={privacyAccepted}
        disabled={!purchaseEnabled}
        onTermsChange={(accepted) => {
          setTermsAccepted(accepted);
          setMessage('');
        }}
        onPrivacyChange={(accepted) => {
          setPrivacyAccepted(accepted);
          setMessage('');
        }}
      />

      <button className="button" type="button" onClick={handlePurchase} disabled={isStartingCheckout || !canStartServicePurchase(service, purchaseEnabled, termsAccepted, privacyAccepted)}>
        {isStartingCheckout ? 'Preparando...' : 'Contratar serviço'}
      </button>
      {!purchaseEnabled && <p className="service-purchase-message" role="status">{unavailableMessage}</p>}
      {message && <p className="service-purchase-message" role="status">{message}</p>}
    </aside>
  );
}
