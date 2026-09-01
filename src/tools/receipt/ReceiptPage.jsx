import { useMemo, useState } from 'react';
import { DocumentFinalization } from '../../components/DocumentFinalization';
import { ModeSelector } from '../../components/ModeSelector';
import { Seo } from '../../components/Seo';
import { receiptConfig } from './receiptConfig';
import { ReceiptForm } from './ReceiptForm';
import { ReceiptPreview } from './ReceiptPreview';
import { createReceiptData, validateReceiptData } from './receiptSchema';

export function ReceiptPage() {
  const [receiptData, setReceiptData] = useState(createReceiptData);
  const validation = useMemo(() => validateReceiptData(receiptData), [receiptData]);

  return (
    <div className="container page-section tool-page">
      <Seo title={receiptConfig.seo.title} description={receiptConfig.seo.description} />
      <div className="tool-page-heading">
        <span className="eyebrow">Documentos</span>
        <h1>{receiptConfig.name}</h1>
        <p>{receiptConfig.description}</p>
        <p className="privacy-note">Seus dados permanecem somente neste navegador.</p>
      </div>
      <ModeSelector />
      <div className="document-workspace">
        <ReceiptForm data={receiptData} onChange={setReceiptData} />
        <ReceiptPreview data={receiptData} />
      </div>
      <DocumentFinalization validation={validation} />
    </div>
  );
}
