import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutOrder } from '../services/commerce';

const unavailableMessage = 'A contratação deste serviço ainda está sendo configurada.';

export function ServicePurchase({ service }) {
  const [message, setMessage] = useState('');
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const navigate = useNavigate();

  if (service.status !== 'active' || !service.checkout?.productCode) return null;

  async function handlePurchase() {
    setMessage('');
    setIsStartingCheckout(true);

    try {
      const { checkoutUrl } = await createCheckoutOrder({
        productCode: service.checkout.productCode,
        resourceId: null
      });
      navigate(checkoutUrl);
    } catch (error) {
      if (error.code === 'UNAUTHORIZED') {
        setMessage('Faça uma nova verificação para continuar.');
      } else if (error.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
        setMessage('É necessário concluir os aceites obrigatórios antes de contratar.');
      } else if (error.code === 'PRODUCT_NOT_AVAILABLE') {
        setMessage(unavailableMessage);
      } else {
        setMessage('Não foi possível preparar o pagamento agora. Tente novamente em instantes.');
      }
    } finally {
      setIsStartingCheckout(false);
    }
  }

  return (
    <aside className="service-purchase" aria-label="Contratação do serviço">
      <span>Contratação online</span>
      <strong>Pronto para contratar?</strong>
      <p>Você seguirá para o checkout seguro, com Pix, cartão de crédito ou boleto.</p>
      <button className="button" type="button" onClick={handlePurchase} disabled={isStartingCheckout}>
        {isStartingCheckout ? 'Preparando...' : 'Contratar serviço'}
      </button>
      {message && <p className="service-purchase-message" role="status">{message}</p>}
    </aside>
  );
}
