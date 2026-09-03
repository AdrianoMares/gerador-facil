import { ServiceCard } from './ServiceCard';

export function ServiceCategorySection({ category }) {
  return (
    <section className="service-category" aria-labelledby={`category-${category.slug}`}>
      <h2 id={`category-${category.slug}`}>{category.name}</h2>
      <div className="grid-tools">
        {category.services.map((service) => <ServiceCard key={service.slug} service={service} />)}
      </div>
    </section>
  );
}
