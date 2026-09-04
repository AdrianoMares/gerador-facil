import { Link } from 'react-router-dom';
import { Seo } from '../../components/Seo';
import { siteIdentity } from '../../config/siteIdentity';

const helpOptions = [
  {
    title: 'Ferramentas',
    description: 'Acesse os geradores e ferramentas digitais disponíveis na Resodi.',
    to: '/ferramentas'
  },
  {
    title: 'Serviços',
    description: 'Veja os serviços e consultorias digitais organizados por categoria.',
    to: '/servicos'
  },
  {
    title: 'Marketing Digital',
    description: 'Conheça os serviços de sites, lojas virtuais, tráfego pago e gestão digital.',
    to: '/marketing-digital'
  }
];

export function Help() {
  return (
    <div className="container page-section">
      <Seo
        title="Ajuda"
        description="Encontre ajuda para usar as ferramentas, serviços e recursos da Resodi."
      />
      <div className="section-heading">
        <span className="eyebrow">Ajuda Resodi</span>
        <h1>Como podemos ajudar?</h1>
        <p>Escolha uma área para encontrar o que precisa ou entre em contato com a Resodi.</p>
      </div>

      <div className="grid-tools">
        {helpOptions.map((option) => (
          <Link className="card service-card service-card-link" to={option.to} key={option.to}>
            <h2>{option.title}</h2>
            <p>{option.description}</p>
          </Link>
        ))}
        <a className="card service-card service-card-link" href={`mailto:${siteIdentity.contactEmail}`}>
          <h2>Fale com a Resodi</h2>
          <p>Se ainda tiver dúvidas, envie um e-mail para {siteIdentity.contactEmail}.</p>
        </a>
      </div>
    </div>
  );
}
