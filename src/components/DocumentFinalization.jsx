import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PdfDownloadButton } from './PdfDownloadButton';
import { createCheckoutOrder } from '../services/commerce';

const unavailableMessage = 'Pagamento ainda está sendo configurado.';

export function DocumentFinalization({ validation, productCode, resourceId }) {
  const [message, setMessage] = useState('');
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const navigate = useNavigate();

  async function handleDownload() {
    if (!validation.valid) return;

    if (!resourceId) {
      setMessage(unavailableMessage);
      return;
    }

    setIsStartingCheckout(true);
    setMessage('');

    try {
      const { checkoutUrl } = await createCheckoutOrder({ productCode, resourceId });
      navigate(checkoutUrl);
    } catch (error) {
      setMessage(error.code === 'PRODUCT_NOT_AVAILABLE' ? unavailableMessage : 'Não foi possível preparar o pagamento agora. Tente novamente em instantes.');
    } finally {
      setIsStartingCheckout(false);
    }
  }

  return (
    <section className="document-finalization" aria-labelledby="document-finalization-title">
      <div>
        <span className="eyebrow">Próxima etapa</span>
        <h2 id="document-finalization-title">Finalizar documento</h2>
        <p>Visualize seu documento gratuitamente. O pagamento será exigido somente quando o download estiver disponível.</p>
        {!validation.valid && (
          <p className="validation-summary">
            <strong>Campos que faltam:</strong> {validation.missingFields.join(', ')}.
          </p>
        )}
        {message && <p className="download-message" role="status">{message}</p>}
      </div>
      <PdfDownloadButton type="button" disabled={!validation.valid || isStartingCheckout} onClick={handleDownload}>
        {isStartingCheckout ? 'Preparando...' : 'Baixar PDF'}
      </PdfDownloadButton>
    </section>
  );
}
