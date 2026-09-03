import { useMemo, useState } from 'react';
import { DocumentAutosaveStatus } from '../../components/DocumentAutosaveStatus';
import { DocumentAiAssistant } from '../../components/DocumentAiAssistant';
import { DocumentFinalization } from '../../components/DocumentFinalization';
import { ModeSelector } from '../../components/ModeSelector';
import { Seo } from '../../components/Seo';
import { useDocumentDraft } from '../../hooks/useDocumentDraft';
import { applyReceiptAiPatch } from '../../utils/documentAiPatch';
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
  const [mode, setMode] = useState('manual');
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
      <ModeSelector mode={mode} onChange={setMode} />
      <DocumentAutosaveStatus {...draftState} />
      <div className="document-workspace">
        {mode === 'manual' ? (
          <ReceiptForm data={receiptData} onChange={setReceiptData} />
        ) : (
          <DocumentAiAssistant
            applyPatch={applyReceiptAiPatch}
            data={receiptData}
            onChange={setReceiptData}
            requestSession={draftState.requestSession}
            serializePayload={serializeReceiptDraft}
            serviceType="receipt"
            sessionConfigured={draftState.sessionConfigured}
            sessionReady={draftState.sessionReady}
            validateData={validateReceiptData}
          />
        )}
        <ReceiptPreview data={receiptData} />
      </div>
      <DocumentFinalization validation={validation} productCode="receipt_pdf" resourceId={draftState.draftId} />
    </div>
  );
}
