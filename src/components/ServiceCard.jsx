import { Link } from 'react-router-dom';
import { formatCurrencyBRL } from '../utils/formatters';

export function ServiceCard({ service }) {
  const hasPrice = Number.isInteger(service.priceCents) && service.priceCents > 0;
  const hasDetailPage = Boolean(service.detail && service.path);
  const content = (
    <>
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      {hasPrice && (
        <p>
          <strong>{formatCurrencyBRL(service.priceCents / 100)}</strong>
          {service.priceSuffix ? ` ${service.priceSuffix}` : ''}
        </p>
      )}
      {service.status !== 'active' && <span className="service-status">Em breve</span>}
    </>
  );

  if (service.status === 'active' || hasDetailPage) {
    return <Link className="card service-card service-card-link" to={service.path}>{content}</Link>;
  }

  return <article className="card service-card">{content}</article>;
}
