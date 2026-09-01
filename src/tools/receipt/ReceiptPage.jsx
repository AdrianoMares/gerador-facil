import { useMemo, useState } from 'react';
import { DocumentAutosaveStatus } from '../../components/DocumentAutosaveStatus';
import { DocumentFinalization } from '../../components/DocumentFinalization';
import { ModeSelector } from '../../components/ModeSelector';
import { Seo } from '../../components/Seo';
import { useDocumentDraft } from '../../hooks/useDocumentDraft';
import { receiptConfig } from './receiptConfig';
import { ReceiptForm } from './ReceiptForm';
import { ReceiptPreview } from './ReceiptPreview';
import {
  createReceiptData,
  hydrateReceiptDraft,
  serializeReceiptDraft,
  validateReceiptData
} from './receiptSchema';

export function ReceiptPage() {
  const [receiptData, setReceiptData] = useState(createReceiptData);
  const validation = useMemo(() => validateReceiptData(receiptData), [receiptData]);
  const draftState = useDocumentDraft({
    data: receiptData,
    setData: setReceiptData,
    serviceType: 'receipt',
    isValid: validation.valid,
    serializePayload: serializeReceiptDraft,
    hydratePayload: hydrateReceiptDraft
  });

  return (
    <div className="container page-section tool-page">
      <Seo title={receiptConfig.seo.title} description={receiptConfig.seo.description} />
      <div className="tool-page-heading">
        <span className="eyebrow">Documentos</span>
        <h1>{receiptConfig.name}</h1>
        <p>{receiptConfig.description}</p>
        <p className="privacy-note">Seu rascunho é salvo automaticamente para manter seu progresso.</p>
      </div>
      <ModeSelector />
      <DocumentAutosaveStatus {...draftState} />
      <div className="document-workspace">
        <ReceiptForm data={receiptData} onChange={setReceiptData} />
        <ReceiptPreview data={receiptData} />
      </div>
      <DocumentFinalization validation={validation} />
    </div>
  );
}
