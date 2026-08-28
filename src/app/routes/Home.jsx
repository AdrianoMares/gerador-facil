import { Link } from 'react-router-dom';
import { AdSlot } from '../../components/AdSlot';
import { ToolCard } from '../../components/ToolCard';
import { Seo } from '../../components/Seo';
import { activeTools } from '../../tools/registry';

const homeDescription = 'Use ferramentas online da Resodi para criar recibos, montar currículos e resolver tarefas digitais do dia a dia de forma simples e prática.';

const howItWorksSteps = [
  'Encontre o serviço digital adequado ao que você precisa.',
  'Informe apenas os dados necessários para gerar o documento ou executar o serviço.',
  'Visualize o resultado e utilize as opções disponíveis para concluir o processo.'
];

const onlineToolBenefits = [
  'Resolva tarefas diretamente pelo navegador, sem processos desnecessariamente complicados.',
  'Use as ferramentas disponíveis pelo computador, tablet ou celular.',
  'Preencha os dados de forma estruturada e obtenha resultados mais claros e profissionais.',
  'A Resodi foi estruturada para receber diferentes ferramentas e serviços digitais dentro da mesma plataforma.'
];

const frequentlyAskedQuestions = [
  {
    question: 'O que é a Resodi?',
    answer: 'A Resodi é uma plataforma de ferramentas e serviços digitais criada para facilitar tarefas do dia a dia diretamente pela internet.'
  },
  {
    question: 'Preciso instalar algum aplicativo?',
    answer: 'Não. As ferramentas da Resodi funcionam diretamente pelo navegador, conforme os recursos disponíveis em cada serviço.'
  },
  {
    question: 'Quais ferramentas estão disponíveis na Resodi?',
    answer: 'Atualmente a Resodi disponibiliza ferramentas como Gerador de Recibo de Pagamento e Gerador de Currículo. Novos serviços poderão ser adicionados ao catálogo.'
  },
  {
    question: 'Posso usar a Resodi no celular ou tablet?',
    answer: 'Sim. A interface da Resodi é desenvolvida para funcionar em computadores, tablets e dispositivos móveis.'
  }
];

export function Home() {
  return (
    <div>
      <Seo title="Ferramentas e Serviços Digitais Online" description={homeDescription} />
      <section className="hero">
        <div className="container hero-content">
          <span className="eyebrow">Ferramentas e serviços digitais</span>
          <h1>Resolva serviços digitais.</h1>
          <p>Encontre ferramentas online simples e práticas para criar documentos, organizar informações e resolver tarefas digitais do dia a dia. Gere recibos, monte currículos e acesse novos serviços diretamente pelo navegador.</p>
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

      <AdSlot placement="home-after-tools" />

      <section className="home-section home-section-muted">
        <div className="container page-section">
          <div className="section-heading home-copy">
            <span className="eyebrow">Soluções em um só lugar</span>
            <h2>Serviços digitais para facilitar seu dia a dia</h2>
            <p>A Resodi reúne ferramentas online criadas para simplificar tarefas que normalmente exigem aplicativos, modelos prontos ou processos demorados. A proposta é permitir que você resolva pequenas necessidades digitais diretamente pelo navegador, de forma simples e organizada.</p>
            <p>Começamos com ferramentas para criação de documentos, como recibos de pagamento e currículos profissionais, e a plataforma poderá receber novos serviços para diferentes situações do cotidiano.</p>
          </div>
        </div>
      </section>

      <section className="container page-section">
        <div className="section-heading">
          <span className="eyebrow">Passo a passo</span>
          <h2>Como funciona a Resodi?</h2>
        </div>
        <ol className="steps-grid">
          {howItWorksSteps.map((step, index) => (
            <li className="step-card" key={step}>
              <span className="step-number" aria-hidden="true">{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <AdSlot placement="home-after-how-it-works" />

      <section className="home-section home-section-muted">
        <div className="container page-section">
          <div className="section-heading">
            <span className="eyebrow">Mais praticidade</span>
            <h2>Por que usar ferramentas online?</h2>
          </div>
          <ul className="benefits-grid">
            {onlineToolBenefits.map((benefit) => (
              <li className="benefit-item" key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container page-section">
        <div className="section-heading">
          <span className="eyebrow">Tire suas dúvidas</span>
          <h2>Perguntas frequentes sobre a Resodi</h2>
        </div>
        <div className="faq-list">
          {frequentlyAskedQuestions.map((item) => (
            <article className="faq-item" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <div className="container home-cta-inner">
          <div>
            <h2>Encontre a ferramenta que você precisa</h2>
            <p>Explore as ferramentas disponíveis na Resodi e resolva tarefas digitais de forma simples e prática.</p>
          </div>
          <Link className="button" to="/ferramentas">Ver todas as ferramentas</Link>
        </div>
      </section>
    </div>
  );
}
