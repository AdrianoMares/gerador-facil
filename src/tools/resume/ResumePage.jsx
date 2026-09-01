import { useMemo, useState } from 'react';
import { DocumentAutosaveStatus } from '../../components/DocumentAutosaveStatus';
import { DocumentFinalization } from '../../components/DocumentFinalization';
import { ModeSelector } from '../../components/ModeSelector';
import { Seo } from '../../components/Seo';
import { useDocumentDraft } from '../../hooks/useDocumentDraft';
import { resumeConfig } from './resumeConfig';
import { ResumeForm } from './ResumeForm';
import { ResumePreview } from './ResumePreview';
import {
  createResumeData,
  hydrateResumeDraft,
  serializeResumeDraft,
  validateResumeData
} from './resumeSchema';

export function ResumePage() {
  const [resumeData, setResumeData] = useState(createResumeData);
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
      <Seo title={resumeConfig.seo.title} description={resumeConfig.seo.description} />
      <div className="tool-page-heading">
        <span className="eyebrow">Carreira</span>
        <h1>{resumeConfig.name}</h1>
        <p>{resumeConfig.description}</p>
        <p className="privacy-note">Seu rascunho é salvo automaticamente. Sua foto permanece somente neste navegador.</p>
      </div>
      <ModeSelector />
      <DocumentAutosaveStatus {...draftState} />
      <div className="document-workspace">
        <ResumeForm data={resumeData} onChange={setResumeData} />
        <ResumePreview data={resumeData} />
      </div>
      <DocumentFinalization validation={validation} />
    </div>
  );
}
