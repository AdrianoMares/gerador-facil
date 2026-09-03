import { Seo } from '../components/Seo';
import { siteIdentity } from '../config/siteIdentity';

export function LegalDocumentPage({ document }) {
  return (
    <section className="page-section legal-document">
      <Seo title={document.seo.title} description={document.seo.description} />
      <div className="container legal-document-inner">
        <header className="legal-document-header">
          <span className="eyebrow">{siteIdentity.brand}</span>
          <h1>{document.title}</h1>
          <dl className="legal-document-meta">
            <div><dt>Versão</dt><dd>{document.version}</dd></div>
            <div><dt>Vigência</dt><dd>{new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${document.effectiveDate}T00:00:00Z`))}</dd></div>
            <div><dt>Identificação</dt><dd>CNPJ {siteIdentity.cnpj}</dd></div>
          </dl>
        </header>
        <article className="legal-document-content">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </article>
      </div>
    </section>
  );
}
