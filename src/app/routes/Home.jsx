import { Link } from 'react-router-dom';
import { ToolCard } from '../../components/ToolCard';
import { Seo } from '../../components/Seo';
import { activeTools } from '../../tools/registry';

export function Home() {
  return (
    <div>
      <Seo />
      <section className="hero">
        <div className="container hero-content">
          <span className="eyebrow">Ferramentas e serviços digitais</span>
          <h1>Resolva serviços digitais.</h1>
          <p>Recursos simples e práticos para criar documentos profissionais e resolver tarefas do dia a dia online.</p>
          <div className="hero-actions">
            <Link className="button" to="/ferramentas">Explorar ferramentas</Link>
            <a className="text-link" href="#ferramentas-disponiveis">Ver opções disponíveis</a>
          </div>
        </div>
      </section>

      <section className="container page-section" id="ferramentas-disponiveis">
        <div className="section-heading">
          <span className="eyebrow">Praticidade para o dia a dia</span>
          <h2>Ferramentas disponíveis</h2>
          <p>Escolha o que precisa e preencha seus dados com tranquilidade.</p>
        </div>
        <div className="grid-tools">
          {activeTools.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}
        </div>
      </section>
    </div>
  );
}
