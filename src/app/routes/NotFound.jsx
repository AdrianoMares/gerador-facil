import { Link } from 'react-router-dom';
import { Seo } from '../../components/Seo';

export function NotFound() {
  return (
    <div className="container page-section not-found">
      <Seo title="Página não encontrada" description="A página que você tentou acessar não foi encontrada na Resodi." />
      <span className="eyebrow">Erro 404</span>
      <h1>Página não encontrada</h1>
      <p>Verifique o endereço ou acesse a página de ferramentas.</p>
      <Link className="button" to="/ferramentas">Ver ferramentas</Link>
    </div>
  );
}
