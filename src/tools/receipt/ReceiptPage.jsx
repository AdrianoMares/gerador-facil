import { Seo } from '../../components/Seo';
import { receiptConfig } from './receiptConfig';
import { ReceiptForm } from './ReceiptForm';
import { ReceiptPreview } from './ReceiptPreview';

export function ReceiptPage() {
  return (
    <div className="container page-section">
      <Seo title={receiptConfig.seo.title} description={receiptConfig.seo.description} />
      <h1>{receiptConfig.name}</h1>
      <p>{receiptConfig.description}</p>
      <div className="grid-tools">
        <ReceiptForm />
        <ReceiptPreview />
      </div>
    </div>
  );
}
