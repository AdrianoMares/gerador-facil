import { useMemo, useState } from 'react';
import { DocumentAutosaveStatus } from '../../components/DocumentAutosaveStatus';
import { DocumentAiAssistant } from '../../components/DocumentAiAssistant';
import { DocumentFinalization } from '../../components/DocumentFinalization';
import { ModeSelector } from '../../components/ModeSelector';
import { Seo } from '../../components/Seo';
import { useDocumentDraft } from '../../hooks/useDocumentDraft';
import { applyResumeAiPatch } from '../../utils/documentAiPatch';
import { siteIdentity } from '../../config/siteIdentity';
import { resumeConfig } from './resumeConfig';
import { ResumeSeoContent, resumeFaqItems } from './ResumeSeoContent';
import { ResumeForm } from './ResumeForm';
import { ResumePreview } from './ResumePreview';
import {
  createResumeData,
  hydrateResumeDraft,
  serializeResumeDraft,
  validateResumeData
} from './resumeSchema';

const resumeCanonical = `${siteIdentity.domain}/ferramentas/gerador-de-curriculo`;

const resumeStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebApplication',
      name: 'Gerador de Currículo Online com IA',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: resumeCanonical,
      description: resumeConfig.seo.description,
      offers: {
        '@type': 'Offer',
        price: '14.90',
        priceCurrency: 'BRL',
        description: 'Download do currículo final em PDF'
      },
      provider: {
        '@type': 'Organization',
        name: siteIdentity.brand,
        url: siteIdentity.domain
      }
    },
    {
      '@type': 'FAQPage',
      mainEntity: resumeFaqItems.map(([question, answer]) => ({
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

export function ResumePage() {
  const [resumeData, setResumeData] = useState(createResumeData);
  const [mode, setMode] = useState('manual');
  const validation = useMemo(() => validateResumeData(resumeData), [resumeData]);
  const draftState = useDocumentDraft({
    data: resumeData,
    setData: setResumeData,
    serviceType: 'resume',
    isValid: validation.valid,
    serializePayload: serializeResumeDraft,
    hydratePayload: hydrateResumeDraft
  });

  return (
    <div className="container page-section tool-page">
      <Seo
        title={resumeConfig.seo.title}
        description={resumeConfig.seo.description}
        canonical={resumeCanonical}
        structuredData={resumeStructuredData}
      />
      <div className="tool-page-heading" id="gerador-de-curriculo">
        <span className="eyebrow">Carreira</span>
        <h1>{resumeConfig.name}</h1>
        <p>{resumeConfig.description}</p>
        <p className="privacy-note">Seu rascunho é salvo automaticamente. Sua foto permanece somente neste navegador.</p>
      </div>
      <ModeSelector mode={mode} onChange={setMode} />
      <DocumentAutosaveStatus {...draftState} />
      <div className="document-workspace">
        {mode === 'manual' ? (
          <ResumeForm data={resumeData} onChange={setResumeData} />
        ) : (
          <DocumentAiAssistant
            applyPatch={applyResumeAiPatch}
            data={resumeData}
            onChange={setResumeData}
            requestSession={draftState.requestSession}
            serializePayload={serializeResumeDraft}
            serviceType="resume"
            sessionConfigured={draftState.sessionConfigured}
            sessionReady={draftState.sessionReady}
            validateData={validateResumeData}
          />
        )}
        <ResumePreview data={resumeData} />
      </div>
      <DocumentFinalization validation={validation} productCode="resume_pdf" resourceId={draftState.draftId} />
      <ResumeSeoContent />
    </div>
  );
}
