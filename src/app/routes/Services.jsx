import { ServiceCategorySection } from '../../components/ServiceCategorySection';
import { Seo } from '../../components/Seo';
import { serviceCategories } from '../../catalog/servicesRegistry';

export function Services() {
  return (
    <div className="container page-section">
      <Seo
        title="Serviços e Consultorias Online"
        description="Encontre serviços e consultorias online da Resodi para Imposto de Renda, MEI, Meu INSS e outras necessidades digitais."
      />
      <div className="section-heading">
        <span className="eyebrow">Serviços Resodi</span>
        <h1>Serviços e consultorias online</h1>
        <p>Encontre ajuda para resolver serviços digitais, obrigações e solicitações do dia a dia.</p>
      </div>
      <div className="services-catalog">
        {serviceCategories.map((category) => <ServiceCategorySection key={category.slug} category={category} />)}
      </div>
    </div>
  );
}
