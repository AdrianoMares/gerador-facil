import { ToolCard } from '../../components/ToolCard';
import { Seo } from '../../components/Seo';
import { activeTools } from '../../tools/registry';

export function Tools() {
  return (
    <div className="container page-section">
      <Seo title="Ferramentas online" description="Conheça as ferramentas digitais da Resodi para criar documentos de forma simples e prática." />
      <div className="section-heading">
        <span className="eyebrow">Soluções Resodi</span>
        <h1>Ferramentas online</h1>
        <p>Escolha uma ferramenta para gerar seu documento.</p>
      </div>
      <div className="grid-tools">
        {activeTools.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}
      </div>
    </div>
  );
}
