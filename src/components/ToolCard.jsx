import { Link } from 'react-router-dom';

export function ToolCard({ tool }) {
  return (
    <article className="card">
      <h3>{tool.name}</h3>
      <p>{tool.description}</p>
      <Link className="button" to={tool.path}>Acessar ferramenta</Link>
    </article>
  );
}
