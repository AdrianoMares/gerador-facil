import { ServiceCategorySection } from '../../components/ServiceCategorySection';
import { Seo } from '../../components/Seo';
import { marketingDigitalCategories } from '../../catalog/marketingDigitalRegistry';

export function MarketingDigital() {
  return (
    <div className="container page-section">
      <Seo
        title="Marketing Digital, Sites e Lojas Virtuais"
        description="Serviços de marketing digital da Resodi para criação de sites, lojas virtuais, tráfego pago e configuração de ERP."
      />
      <div className="section-heading">
        <span className="eyebrow">Marketing Digital</span>
        <h1>Marketing digital para colocar seu projeto no ar</h1>
        <p>Encontre serviços de criação de sites, lojas virtuais, tráfego pago e estruturação digital.</p>
      </div>
      <div className="services-catalog">
        {marketingDigitalCategories.map((category) => (
          <ServiceCategorySection key={category.slug} category={category} />
        ))}
      </div>
    </div>
  );
}
