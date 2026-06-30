import { Link } from 'react-router-dom';
import { activeTools } from '../../tools/registry';

export function Header() {
  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/"><strong>Gerador Fácil</strong></Link>
        <nav className="nav">
          <Link to="/ferramentas">Ferramentas</Link>
          {activeTools.map((tool) => (
            <Link key={tool.slug} to={tool.path}>{tool.shortName}</Link>
          ))}
          <Link to="/precos">Preços</Link>
        </nav>
      </div>
    </header>
  );
}
