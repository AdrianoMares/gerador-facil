import { formatCurrencyBRL } from '../../utils/formatters';
import { amountToWordsBRL, formatReceiptDate } from './receiptUtils';
import { PreviewWatermark } from '../../components/PreviewWatermark';

function display(value, fallback) {
  return value?.trim() || fallback;
}

export function ReceiptPreview({ data }) {
  const amountInWords = data.amount ? amountToWordsBRL(data.amount) : '';

  return (
    <section className="preview-panel" aria-labelledby="receipt-preview-title">
      <div className="preview-heading">
        <span className="eyebrow">Atualização em tempo real</span>
        <h2 id="receipt-preview-title">Prévia do recibo</h2>
      </div>
      <div className="protected-preview-content">
        <article className="receipt-paper">
        <header className="receipt-header">
          <div>
            <span className="receipt-kicker">Comprovante de pagamento</span>
            <h3>RECIBO</h3>
          </div>
          <div className="receipt-amount">
            <small>Valor</small>
            <strong>{data.amount ? formatCurrencyBRL(data.amount) : 'R$ 0,00'}</strong>
          </div>
        </header>

        <div className="receipt-rule" />

        <p className="receipt-statement">
          Recebi de <strong>{display(data.payerName, 'nome de quem pagou')}</strong>
          {data.payerDocument && <> (CPF/CNPJ {data.payerDocument})</>}, a importância de{' '}
          <strong>{data.amount ? formatCurrencyBRL(data.amount) : 'valor não informado'}</strong>
          {amountInWords && <> ({amountInWords})</>}.
        </p>

        <div className="receipt-description">
          <span>Referente a</span>
          <strong>{display(data.description, 'Descrição do pagamento')}</strong>
        </div>

        <p className="receipt-location">
          {display(data.city, 'Cidade')}, {formatReceiptDate(data.date)}.
        </p>

        <footer className="receipt-signature">
          <div className="signature-line" />
          <strong>{display(data.recipientName, 'Nome de quem recebeu')}</strong>
          {data.recipientDocument && <span>CPF/CNPJ {data.recipientDocument}</span>}
          <small>Assinatura do recebedor</small>
        </footer>
          <PreviewWatermark />
        </article>
        <p className="print-preview-message">Esta é apenas uma prévia. O documento final estará disponível para download após a conclusão do pagamento.</p>
      </div>
    </section>
  );
}
