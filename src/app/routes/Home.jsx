import { ToolCard } from '../../components/ToolCard';
import { activeTools } from '../../tools/registry';

export function Home() {
  return (
    <div className="container page-section">
      <h1>Gere documentos profissionais em poucos minutos</h1>
      <p>Ferramentas simples para criar recibos, currículos e outros documentos online.</p>

      <section className="page-section">
        <h2>Ferramentas disponíveis</h2>
        <div className="grid-tools">
          {activeTools.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}
        </div>
      </section>
    </div>
  );
}
