import './ResumeSeoContent.css';

const resumeChecklist = [
  'Nome completo e informações de contato atualizadas.',
  'Título ou objetivo profissional coerente com a vaga desejada.',
  'Resumo profissional claro e direto.',
  'Experiências com cargos, empresas, períodos e atividades.',
  'Formação acadêmica, cursos e habilidades relevantes.'
];

const resumeFaq = [
  ['Como fazer um currículo online?', 'Você pode preencher seus dados diretamente no Gerador de Currículo da Resodi, acompanhar a prévia em tempo real e revisar as informações antes de finalizar o documento em PDF.'],
  ['Posso criar currículo com IA?', 'Sim. A Resodi permite usar inteligência artificial para ajudar a organizar e preencher informações do currículo. Depois, você pode revisar e editar tudo antes de finalizar.'],
  ['Como criar currículo com ChatGPT?', 'Muitas pessoas procuram como criar currículo com ChatGPT. Na Resodi, você pode usar uma experiência própria com IA dentro do gerador para estruturar informações como resumo profissional, experiências, cursos e habilidades.'],
  ['O gerador de currículo é grátis?', 'Você pode preencher e visualizar a prévia do currículo sem pagar. O download do currículo final em PDF é uma etapa paga da ferramenta.'],
  ['Posso fazer currículo com foto?', 'Sim. A foto é opcional e pode ser adicionada ao currículo. A imagem permanece somente no navegador durante o preenchimento da ferramenta.'],
  ['O que colocar no resumo profissional?', 'Use um texto curto para apresentar seu perfil, seus objetivos e as principais qualificações relacionadas à área em que deseja atuar.'],
  ['Como fazer currículo para primeiro emprego?', 'Destaque formação, cursos, habilidades, projetos, atividades acadêmicas e experiências informais relevantes. Não é necessário inventar experiência profissional.'],
  ['Curriculum vitae e currículo são a mesma coisa?', 'No uso cotidiano, curriculum vitae, CV e currículo costumam se referir ao mesmo documento profissional usado para apresentar formação, experiências, habilidades e dados de contato.'],
  ['Posso editar o currículo criado com IA?', 'Sim. A IA funciona como apoio ao preenchimento. Você continua no controle e pode editar os campos antes de gerar o documento final.'],
  ['Posso baixar o currículo em PDF?', 'Sim. Após preencher e conferir os dados, você pode finalizar o currículo em PDF. O download do arquivo final é uma etapa paga da ferramenta.']
];

export const resumeFaqItems = resumeFaq;

export function ResumeSeoContent() {
  return (
    <section className="resume-seo" aria-labelledby="resume-seo-title">
      <div className="resume-seo-intro">
        <span className="eyebrow">Guia de currículo</span>
        <h2 id="resume-seo-title">Gerador de currículo online com IA, foto e PDF</h2>
        <p>
          O Gerador de Currículo da Resodi ajuda você a criar um <strong>currículo profissional</strong> de forma
          simples, usando preenchimento manual ou assistência por inteligência artificial. Você acompanha a prévia
          em tempo real, pode incluir foto, experiências, formação, cursos e habilidades e revisar tudo antes de gerar o PDF.
        </p>
      </div>

      <div className="resume-seo-grid resume-seo-feature">
        <div>
          <h2>Como fazer um currículo online</h2>
          <p>
            Um bom currículo apresenta suas informações de forma organizada e fácil de ler. Para começar, preencha
            seus dados pessoais, título profissional, resumo, experiências, formação acadêmica, cursos e habilidades.
          </p>
          <p>
            A ferramenta atualiza a prévia automaticamente, permitindo montar seu <strong>curriculum vitae</strong> ou
            CV sem precisar formatar o documento manualmente.
          </p>
        </div>
        <img
          src="/images/ferramentas/curriculo/como-fazer-curriculo-online.svg"
          alt="Ilustração de um currículo online com dados pessoais, resumo, experiência, formação e habilidades"
          loading="lazy"
          width="720"
          height="520"
        />
      </div>

      <div className="resume-seo-block">
        <h2>Passo a passo para criar seu currículo</h2>
        <ol className="resume-seo-steps">
          <li>Informe seus dados pessoais e contatos.</li>
          <li>Escolha um título ou objetivo profissional.</li>
          <li>Escreva um resumo profissional curto.</li>
          <li>Adicione experiências, quando houver.</li>
          <li>Inclua formação, cursos e habilidades.</li>
          <li>Confira a prévia e finalize em PDF.</li>
        </ol>
      </div>

      <div className="resume-seo-ai">
        <div>
          <span className="resume-seo-ai-badge">IA</span>
          <h2>Criar currículo com inteligência artificial</h2>
          <p>
            Se você não sabe como organizar suas informações, pode usar a opção de <strong>criar currículo com IA</strong>.
            Explique sua trajetória em linguagem natural e a ferramenta ajuda a transformar essas informações em campos estruturados.
          </p>
          <p className="resume-seo-example">
            Exemplo: “Trabalhei dois anos como vendedor, fiz curso de atendimento ao cliente e tenho facilidade com comunicação.”
          </p>
          <p>
            Depois da sugestão, revise cargos, datas, atividades, cursos e habilidades antes de finalizar o documento.
          </p>
        </div>
        <div>
          <h2>Como criar currículo com ChatGPT ou IA?</h2>
          <p>
            Pesquisas como <strong>criar currículo com ChatGPT</strong>, <strong>fazer currículo com ChatGPT</strong> e
            <strong> gerador de currículo com IA</strong> procuram justamente uma forma mais rápida de organizar informações profissionais.
          </p>
          <p>
            Na Resodi, a IA funciona dentro do próprio gerador. Assim, você não recebe apenas um texto: pode revisar os
            campos, acompanhar a prévia e montar um currículo pronto para finalização.
          </p>
        </div>
      </div>

      <div className="resume-seo-grid resume-seo-feature resume-seo-feature-reverse">
        <img
          src="/images/ferramentas/curriculo/dados-importantes-curriculo.svg"
          alt="Checklist com as principais informações de um currículo profissional"
          loading="lazy"
          width="720"
          height="520"
        />
        <div>
          <h2>O que colocar em um currículo?</h2>
          <p>
            O currículo deve destacar informações relevantes para a vaga ou área pretendida. Evite excesso de texto
            e priorize dados atualizados, objetivos e fáceis de entender.
          </p>
          <ul className="resume-seo-checklist">
            {resumeChecklist.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div className="resume-seo-columns">
        <article>
          <h2>Gerador de currículo com foto</h2>
          <p>
            A ferramenta permite adicionar uma foto opcional ao currículo. Se decidir usar, escolha uma imagem adequada
            ao contexto profissional e verifique se a apresentação fica equilibrada na prévia.
          </p>
        </article>
        <article>
          <h2>Currículo para primeiro emprego</h2>
          <p>
            Quem ainda não possui experiência formal pode valorizar formação, cursos, projetos, habilidades,
            trabalhos voluntários e conhecimentos que tenham relação com a oportunidade desejada.
          </p>
        </article>
        <article>
          <h2>Currículo em PDF</h2>
          <p>
            Depois de revisar as informações, você pode finalizar o currículo em PDF para enviar por e-mail, plataformas
            de vagas ou outros canais de recrutamento.
          </p>
        </article>
      </div>

      <div className="resume-seo-free">
        <h2>Gerador de currículo grátis? Como funciona na Resodi</h2>
        <p>
          Você pode <strong>preencher e visualizar a prévia do currículo sem pagar</strong>. Isso permite organizar,
          corrigir e conferir suas informações antes da decisão de finalizar. O download do currículo final em PDF custa
          <strong> R$ 14,90</strong>.
        </p>
        <p>
          Assim, buscas como <strong>gerador de currículo online grátis</strong> e <strong>gerador de currículo gratuito</strong>
          encontram uma opção em que a criação e a visualização podem ser feitas antes da compra do arquivo final.
        </p>
      </div>

      <div className="resume-seo-note">
        <h2>Curriculum vitae, CV ou currículo?</h2>
        <p>
          Os três termos são usados para se referir ao documento profissional que apresenta dados de contato, formação,
          experiências e habilidades. No Brasil, “currículo” é o termo mais comum, enquanto “CV” e “curriculum vitae”
          também aparecem com frequência em buscas e processos seletivos.
        </p>
      </div>

      <div className="resume-seo-faq">
        <span className="eyebrow">Dúvidas frequentes</span>
        <h2>Perguntas sobre currículo, IA, foto e PDF</h2>
        <div className="resume-seo-faq-list">
          {resumeFaq.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="resume-seo-cta">
        <div>
          <h2>Crie seu currículo online</h2>
          <p>Preencha manualmente ou use a IA, confira a prévia e finalize seu currículo em PDF.</p>
        </div>
        <a className="button" href="#gerador-de-curriculo">Voltar ao gerador</a>
      </div>
    </section>
  );
}
