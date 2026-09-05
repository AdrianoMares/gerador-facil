import { Link, useParams } from 'react-router-dom';
import { findServiceBySlugs } from '../../catalog/servicesRegistry';
import { Seo } from '../../components/Seo';
import { ServicePurchase } from '../../components/ServicePurchase';
import { siteIdentity } from '../../config/siteIdentity';
import { NotFound } from './NotFound';
import '../../service-detail.css';

function ListSection({ title, items, className = '' }) {
  return (
    <section className={`service-detail-section ${className}`} aria-labelledby={title}>
      <h2 id={title}>{title}</h2>
      <ul className="service-detail-list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

export function ServiceDetailPage() {
  const { categorySlug, serviceSlug } = useParams();
  const service = findServiceBySlugs(categorySlug, serviceSlug);

  if (!service) return <NotFound />;

  const { detail } = service;
  const isDraft = service.status === 'draft';
  const canonical = `${siteIdentity.domain}${service.path}`;

  return (
    <>
      <Seo title={service.seo.title} description={service.seo.description} canonical={canonical} noindex={isDraft} />
      <div className="container service-breadcrumb" aria-label="Navegação estrutural">
        <Link to="/servicos">Serviços</Link><span aria-hidden="true">/</span><span>{service.category}</span><span aria-hidden="true">/</span><span aria-current="page">{service.name}</span>
      </div>
      <section className="service-detail-hero">
        <div className="container service-detail-hero-grid">
          <div>
            <span className="eyebrow">{detail.eyebrow}</span>
            <h1>{service.name} ({detail.technicalName})</h1>
            <p>{detail.intro}</p>
          </div>
          {service.status === 'active' ? <ServicePurchase service={service} /> : (
            <aside className="service-commercial-placeholder" aria-label="Disponibilidade do serviço">
              <span>Disponibilidade</span>
              <strong>Contratação em breve</strong>
              <p>Esta página está sendo preparada para o lançamento do serviço.</p>
            </aside>
          )}
        </div>
      </section>
      <main className="container page-section service-detail-content">
        {detail.sections.map((section) => (
          <section className="service-detail-section" key={section.title} aria-labelledby={section.title}>
            <h2 id={section.title}>{section.title}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
        <ListSection title="O que está incluído no serviço" items={detail.included} className="service-detail-included" />
        <section className="service-detail-section service-detail-note" aria-labelledby="O que não está incluído">
          <h2 id="O que não está incluído">O que não está incluído</h2>
          <p>Algumas situações podem exigir outro atendimento, como:</p>
          <ul className="service-detail-list">{detail.excluded.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>Se identificarmos uma situação que exija um serviço adicional, entraremos em contato antes de qualquer contratação complementar.</p>
        </section>
        <section className="service-detail-section" aria-labelledby="Como funciona depois da compra">
          <h2 id="Como funciona depois da compra">Como funciona depois da compra</h2>
          <ol className="service-steps">{detail.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
        <ListSection title="O que poderá ser solicitado para concluir o serviço" items={detail.requestedInformation} />
        <p className="service-security-note"><strong>Segurança no atendimento:</strong> Por segurança, a Resodi não solicita o armazenamento de senhas, códigos de autenticação ou códigos de verificação na plataforma. Quando um acesso autenticado for necessário, o procedimento será orientado durante o atendimento.</p>
        <section className="service-transparency" aria-labelledby="Transparência sobre o serviço público">
          <h2 id="Transparência sobre o serviço público">Transparência sobre o serviço público</h2>
          <p>A Resodi é uma empresa privada de serviços digitais e não possui vínculo com a Receita Federal, Gov.br ou outros órgãos públicos.</p>
          <p>A transmissão da DASN-SIMEI pode ser realizada gratuitamente pelos canais oficiais do Governo. O valor cobrado pela Resodi corresponde ao atendimento, orientação, preparação e execução do serviço para o cliente.</p>
        </section>
        <section className="service-detail-section" aria-labelledby="Perguntas frequentes">
          <h2 id="Perguntas frequentes">Perguntas frequentes</h2>
          <div className="service-faq">
            {detail.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </section>
      </main>
    </>
  );
}
