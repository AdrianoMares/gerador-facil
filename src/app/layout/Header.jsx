import { Link, NavLink } from 'react-router-dom';

export function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link className="brand-link" to="/" aria-label="Resodi — página inicial">
          <img className="brand-logo brand-logo-horizontal" src="/brand/resodi-logo-horizontal.png" alt="Resodi — Resolva serviços digitais." />
          <img className="brand-logo brand-logo-compact" src="/brand/resodi-favicon.png" alt="" aria-hidden="true" />
        </Link>
        <nav className="nav" aria-label="Navegação principal">
          <NavLink to="/ferramentas">Ferramentas</NavLink>
          <NavLink to="/servicos">Serviços</NavLink>
          <NavLink to="/marketing-digital">Marketing Digital</NavLink>
          <NavLink to="/ajuda">Ajuda</NavLink>
        </nav>
      </div>
    </header>
  );
}
