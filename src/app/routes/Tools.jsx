import { ToolCard } from '../../components/ToolCard';
import { activeTools } from '../../tools/registry';

export function Tools() {
  return (
    <div className="container page-section">
      <h1>Ferramentas online</h1>
      <p>Escolha uma ferramenta para gerar seu documento.</p>
      <div className="grid-tools">
        {activeTools.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}
      </div>
    </div>
  );
}
