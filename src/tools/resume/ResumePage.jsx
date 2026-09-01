import { useMemo, useState } from 'react';
import { DocumentFinalization } from '../../components/DocumentFinalization';
import { ModeSelector } from '../../components/ModeSelector';
import { Seo } from '../../components/Seo';
import { resumeConfig } from './resumeConfig';
import { ResumeForm } from './ResumeForm';
import { ResumePreview } from './ResumePreview';
import { createResumeData, validateResumeData } from './resumeSchema';

export function ResumePage() {
  const [resumeData, setResumeData] = useState(createResumeData);
  const validation = useMemo(() => validateResumeData(resumeData), [resumeData]);

  return (
    <div className="container page-section tool-page">
      <Seo title={resumeConfig.seo.title} description={resumeConfig.seo.description} />
      <div className="tool-page-heading">
        <span className="eyebrow">Carreira</span>
        <h1>{resumeConfig.name}</h1>
        <p>{resumeConfig.description}</p>
        <p className="privacy-note">Seus dados e sua foto permanecem somente neste navegador.</p>
      </div>
      <ModeSelector />
      <div className="document-workspace">
        <ResumeForm data={resumeData} onChange={setResumeData} />
        <ResumePreview data={resumeData} />
      </div>
      <DocumentFinalization validation={validation} />
    </div>
  );
}
