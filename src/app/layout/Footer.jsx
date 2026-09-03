import { Link } from 'react-router-dom';
import { siteIdentity } from '../../config/siteIdentity';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <strong>{siteIdentity.brand}</strong>
            <p>{siteIdentity.slogan}</p>
          </div>
          <nav aria-label="Links institucionais">
            <span>Plataforma</span>
            <Link to="/ferramentas">Ferramentas</Link>
            <Link to="/servicos">Serviços</Link>
            <Link to="/precos">Preços</Link>
          </nav>
          <nav aria-label="Links legais">
            <span>Legal</span>
            <Link to="/termos-de-uso">Termos de Uso</Link>
            <Link to="/politica-de-privacidade">Política de Privacidade</Link>
          </nav>
          <div className="footer-identification">
            <span>Identificação</span>
            <p>CNPJ {siteIdentity.cnpj}</p>
          </div>
        </div>
        <div className="footer-bottom">© {year} {siteIdentity.brand}. Todos os direitos reservados.</div>
      </div>
    </footer>
  );
}
