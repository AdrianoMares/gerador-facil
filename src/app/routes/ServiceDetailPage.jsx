import { Link, useParams } from 'react-router-dom';
import { findServiceBySlugs } from '../../catalog/servicesRegistry';
import { Seo } from '../../components/Seo';
import { ServicePurchase } from '../../components/ServicePurchase';
import { siteIdentity } from '../../config/siteIdentity';
import { formatCurrencyBRL } from '../../utils/formatters';
import { NotFound } from './NotFound';
import './ServiceDetailPage.css';

function sectionId(title) {
  return title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ListSection({ title, items, className = '' }) {
  const id = sectionId(title);
  return (
    <section className={`service-detail-section ${className}`} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <ul className="service-detail-list">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function InlineCta({ service, cta }) {
  const price = Number.isInteger(service.priceCents) && service.priceCents > 0
    ? formatCurrencyBRL(service.priceCents / 100)
    : null;

  return (
    <div className="service-inline-cta">
      <div>
        <h3>{cta.title}</h3>
        {cta.text && <p>{cta.text}</p>}
      </div>
      <div className="service-inline-cta-action">
        {price && <span>{price}{service.priceSuffix ? ` ${service.priceSuffix}` : ''}</span>}
        <a className="button" href="#contratar-servico">{cta.buttonLabel || 'Contratar serviço'}</a>
      </div>
    </div>
  );
}

function DetailSection({ section, service }) {
  const id = sectionId(section.title);
  return (
    <section className="service-detail-section" aria-labelledby={id}>
      <h2 id={id}>{section.title}</h2>
      {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {section.bullets?.length > 0 && (
        <ul className="service-detail-list">
          {section.bullets.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )}
      {section.image && (
        <figure className="service-seo-figure">
          <img
            src={section.image.src}
            alt={section.image.alt}
            width="1672"
            height="941"
            loading="lazy"
            decoding="async"
          />
          {section.image.caption && <figcaption>{section.image.caption}</figcaption>}
        </figure>
      )}
      {section.cta && <InlineCta service={service} cta={section.cta} />}
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
  const heroTitle = detail.heroTitle || `${service.name}${detail.technicalName ? ` (${detail.technicalName})` : ''}`;
  const hasPrice = Number.isInteger(service.priceCents) && service.priceCents > 0;
  const transparencyParagraphs = detail.transparency?.paragraphs || [
    'A Resodi é uma empresa privada de serviços digitais e não possui vínculo com a Receita Federal, Gov.br ou outros órgãos públicos.',
    'A transmissão da DASN-SIMEI pode ser realizada gratuitamente pelos canais oficiais do Governo. O valor cobrado pela Resodi corresponde ao atendimento, orientação, preparação e execução do serviço para o cliente.'
  ];
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: service.name,
        description: service.seo.description,
        url: canonical,
        provider: {
          '@type': 'Organization',
          name: siteIdentity.brand,
          url: siteIdentity.domain
        },
        areaServed: {
          '@type': 'Country',
          name: 'Brasil'
        },
        ...(service.status === 'active' && hasPrice ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'BRL',
            price: (service.priceCents / 100).toFixed(2),
            availability: 'https://schema.org/InStock',
            url: canonical
          }
        } : {})
      },
      {
        '@type': 'FAQPage',
        mainEntity: detail.faq.map(([question, answer]) => ({
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

  return (
    <>
      <Seo
        title={service.seo.title}
        description={service.seo.description}
        canonical={canonical}
        noindex={isDraft}
        structuredData={structuredData}
      />
      <div className="container service-breadcrumb" aria-label="Navegação estrutural">
        <Link to="/servicos">Serviços</Link><span aria-hidden="true">/</span><span>{service.category}</span><span aria-hidden="true">/</span><span aria-current="page">{service.name}</span>
      </div>
      <section className="service-detail-hero">
        <div className="container service-detail-hero-grid">
          <div>
            <span className="eyebrow">{detail.eyebrow}</span>
            <h1>{heroTitle}</h1>
            <p>{detail.intro}</p>
          </div>
          <div id="contratar-servico" className="service-purchase-anchor">
            {service.status === 'active' ? <ServicePurchase service={service} /> : (
              <aside className="service-commercial-placeholder" aria-label="Disponibilidade do serviço">
                <span>Contratação online</span>
                <strong>{detail.purchaseTitle || 'Contratação em breve'}</strong>
                {hasPrice && (
                  <div className="service-commercial-price">
                    {formatCurrencyBRL(service.priceCents / 100)}
                    {service.priceSuffix && <small>{service.priceSuffix}</small>}
                  </div>
                )}
                <p>{detail.purchaseDescription || 'Esta página está sendo preparada para o lançamento do serviço.'}</p>
              </aside>
            )}
          </div>
        </div>
      </section>
      <main className="container page-section service-detail-content">
        {detail.sections.map((section) => <DetailSection key={section.title} section={section} service={service} />)}

        <ListSection title="O que está incluído no serviço" items={detail.included} className="service-detail-included" />

        <section className="service-detail-section service-detail-note" aria-labelledby="o-que-nao-esta-incluido">
          <h2 id="o-que-nao-esta-incluido">O que não está incluído</h2>
          <p>Algumas situações podem exigir outro atendimento, como:</p>
          <ul className="service-detail-list">{detail.excluded.map((item) => <li key={item}>{item}</li>)}</ul>
          <p>Se identificarmos uma situação que exija um serviço adicional, entraremos em contato antes de qualquer contratação complementar.</p>
        </section>

        <section className="service-detail-section" aria-labelledby="como-funciona-depois-da-compra">
          <h2 id="como-funciona-depois-da-compra">Como funciona depois da compra</h2>
          <ol className="service-steps">{detail.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>

        {detail.afterStepsCta && <InlineCta service={service} cta={detail.afterStepsCta} />}

        <ListSection title="O que poderá ser solicitado para concluir o serviço" items={detail.requestedInformation} />

        <p className="service-security-note"><strong>Segurança no atendimento:</strong> Por segurança, a Resodi não solicita o armazenamento de senhas, códigos de autenticação ou códigos de verificação na plataforma. Quando um acesso autenticado for necessário, o procedimento será orientado durante o atendimento.</p>

        <section className="service-transparency" aria-labelledby="transparencia-sobre-o-servico-publico">
          <h2 id="transparencia-sobre-o-servico-publico">Transparência sobre o serviço público</h2>
          {transparencyParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>

        {detail.seoSections?.map((section) => <DetailSection key={section.title} section={section} service={service} />)}

        <section className="service-detail-section" aria-labelledby="perguntas-frequentes">
          <h2 id="perguntas-frequentes">Perguntas frequentes</h2>
          <div className="service-faq">
            {detail.faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
          </div>
        </section>

        {detail.finalCta && <InlineCta service={service} cta={detail.finalCta} />}
      </main>
    </>
  );
}
