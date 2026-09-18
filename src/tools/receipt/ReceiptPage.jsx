import { useMemo, useState } from 'react';
import { DocumentAutosaveStatus } from '../../components/DocumentAutosaveStatus';
import { DocumentAiAssistant } from '../../components/DocumentAiAssistant';
import { DocumentFinalization } from '../../components/DocumentFinalization';
import { ModeSelector } from '../../components/ModeSelector';
import { Seo } from '../../components/Seo';
import { useDocumentDraft } from '../../hooks/useDocumentDraft';
import { applyReceiptAiPatch } from '../../utils/documentAiPatch';
import { siteIdentity } from '../../config/siteIdentity';
import { receiptConfig } from './receiptConfig';
import { ReceiptForm } from './ReceiptForm';
import { ReceiptSeoContent, receiptFaqItems } from './ReceiptSeoContent';
import { ReceiptPreview } from './ReceiptPreview';
import {
  createReceiptData,
  hydrateReceiptDraft,
  serializeReceiptDraft,
  validateReceiptData
} from './receiptSchema';

const receiptCanonical = `${siteIdentity.domain}/ferramentas/gerador-de-recibo`;

const receiptStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Gerador de Recibo Online com IA',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: receiptCanonical,
      description: receiptConfig.seo.description,
      offers: {
        '@type': 'Offer',
        price: '4.90',
        priceCurrency: 'BRL',
        description: 'Download do recibo final em PDF'
      },
      provider: {
        '@type': 'Organization',
        name: siteIdentity.brand,
        url: siteIdentity.domain
      }
    },
    {
      '@type': 'FAQPage',
      mainEntity: receiptFaqItems.map(([question, answer]) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: answer
        }
      }))
    }
  ]
};

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
      <Seo
        title={receiptConfig.seo.title}
        description={receiptConfig.seo.description}
        canonical={receiptCanonical}
        structuredData={receiptStructuredData}
      />
      <div className="tool-page-heading" id="gerador-de-recibo">
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
      <ReceiptSeoContent />
    </div>
  );
}
