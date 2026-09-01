import { useState } from 'react';
import { PdfDownloadButton } from './PdfDownloadButton';

const unavailableMessage = 'O pagamento para liberar o download será habilitado em breve.';

export function DocumentFinalization({ validation }) {
  const [message, setMessage] = useState('');

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
      <PdfDownloadButton type="button" onClick={() => setMessage(unavailableMessage)} />
    </section>
  );
}
