import { Seo } from '../../components/Seo';
import { resumeConfig } from './resumeConfig';
import { ResumeForm } from './ResumeForm';
import { ResumePreview } from './ResumePreview';

export function ResumePage() {
  return (
    <div className="container page-section">
      <Seo title={resumeConfig.seo.title} description={resumeConfig.seo.description} />
      <h1>{resumeConfig.name}</h1>
      <p>{resumeConfig.description}</p>
      <div className="grid-tools">
        <ResumeForm />
        <ResumePreview />
      </div>
    </div>
  );
}
