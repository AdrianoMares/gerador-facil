import './ReceiptSeoContent.css';

const receiptChecklist = [
  'Nome de quem pagou e de quem recebeu.',
  'CPF ou CNPJ, quando fizer sentido para a situação.',
  'Valor recebido e motivo do pagamento.',
  'Cidade e data do recebimento.',
  'Identificação ou assinatura de quem recebeu.'
];

const receiptFaq = [
  ['O que é um recibo de pagamento?', 'É um documento usado para registrar que determinado valor foi recebido. Ele normalmente identifica quem pagou, quem recebeu, o valor, o motivo do pagamento, a data e o local.'],
  ['Como fazer um recibo simples?', 'Informe os dados de quem pagou e de quem recebeu, o valor, a finalidade do pagamento, a cidade e a data. Na Resodi, você pode preencher manualmente ou usar a assistência por IA e revisar tudo antes de gerar o PDF.'],
  ['Posso criar um recibo com IA?', 'Sim. No Gerador de Recibo da Resodi, você pode usar a opção de inteligência artificial para ajudar a organizar as informações do pagamento e preencher o recibo. O conteúdo deve ser conferido antes da finalização.'],
  ['Como criar um recibo com ChatGPT?', 'Muitas pessoas pesquisam como criar recibo com ChatGPT. Na Resodi, a ferramenta já oferece uma experiência própria com IA para ajudar a transformar uma descrição do pagamento em dados estruturados para o recibo, sem exigir que você monte o documento do zero.'],
  ['Preciso saber escrever um prompt para usar a IA?', 'Não. Você pode explicar a situação em linguagem comum, por exemplo quem pagou, quem recebeu, o valor e o motivo. Depois, revise os campos sugeridos antes de concluir.'],
  ['O recibo criado com IA pode ser editado?', 'Sim. A IA serve como apoio ao preenchimento. Os campos continuam disponíveis para revisão e edição antes da geração do documento final.'],
  ['Recibo substitui nota fiscal?', 'Não necessariamente. Recibo e nota fiscal têm finalidades diferentes. O recibo registra o recebimento de um valor, enquanto a emissão de nota fiscal depende da operação e das regras tributárias aplicáveis ao caso.'],
  ['CPF ou CNPJ é obrigatório no recibo?', 'Nem todo recibo exige CPF ou CNPJ em todas as situações. Quando esses dados forem relevantes, eles ajudam a identificar melhor as partes envolvidas.'],
  ['Posso usar o recibo para prestação de serviço?', 'Sim. Um recibo pode registrar o pagamento por um serviço realizado, desde que os dados reflitam corretamente a operação. Isso não elimina eventuais obrigações fiscais ou de emissão de nota.'],
  ['Posso gerar um recibo em PDF para imprimir?', 'Sim. Após preencher e conferir os dados, a Resodi permite finalizar o recibo em PDF para guardar, enviar ou imprimir. O download do PDF é uma etapa paga da ferramenta.']
];

export const receiptFaqItems = receiptFaq;

export function ReceiptSeoContent() {
  return (
    <section className="receipt-seo" aria-labelledby="receipt-seo-title">
      <div className="receipt-seo-intro">
        <span className="eyebrow">Guia sobre recibos</span>
        <h2 id="receipt-seo-title">Gerador de recibo online com IA e PDF</h2>
        <p>
          O Gerador de Recibo da Resodi ajuda você a criar um <strong>recibo de pagamento</strong> de forma
          simples, usando preenchimento manual ou assistência por inteligência artificial. Você pode revisar
          todos os dados na prévia e, quando estiver tudo correto, gerar o recibo em PDF para enviar ou imprimir.
        </p>
      </div>

      <div className="receipt-seo-grid receipt-seo-feature">
        <div>
          <h2>O que é um recibo de pagamento?</h2>
          <p>
            Um recibo é um documento que registra o recebimento de um valor. Ele pode ser usado em pagamentos
            entre pessoas, prestação de serviços, quitação de valores e outras situações em que é útil manter
            uma comprovação escrita do que foi pago e recebido.
          </p>
          <p>
            Um <strong>recibo simples</strong> costuma informar as partes envolvidas, o valor, a referência do
            pagamento, a cidade e a data. A clareza dessas informações facilita a identificação da transação.
          </p>
        </div>
        <img
          src="/images/ferramentas/recibo/como-preencher-recibo.svg"
          alt="Ilustração mostrando como preencher um recibo de pagamento com pagador, recebedor, valor, referência e data"
          loading="lazy"
          width="720"
          height="520"
        />
      </div>

      <div className="receipt-seo-block">
        <h2>Como fazer um recibo online</h2>
        <p>
          Para criar um modelo de recibo, você pode começar pela ferramenta acima e seguir uma sequência simples:
        </p>
        <ol className="receipt-seo-steps">
          <li>Informe quem realizou o pagamento.</li>
          <li>Informe quem recebeu o valor.</li>
          <li>Digite o valor recebido.</li>
          <li>Descreva a que o pagamento se refere.</li>
          <li>Informe cidade e data.</li>
          <li>Confira a prévia e finalize o documento.</li>
        </ol>
      </div>

      <div className="receipt-seo-grid receipt-seo-feature receipt-seo-feature-reverse">
        <img
          src="/images/ferramentas/recibo/dados-importantes-recibo.svg"
          alt="Checklist visual com os dados importantes de um recibo simples"
          loading="lazy"
          width="720"
          height="520"
        />
        <div>
          <h2>O que deve constar em um recibo?</h2>
          <p>
            Não existe um único formato para todo tipo de recebimento, mas alguns dados tornam o documento mais
            claro e ajudam a identificar a operação.
          </p>
          <ul className="receipt-seo-checklist">
            {receiptChecklist.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div className="receipt-seo-ai">
        <div>
          <span className="receipt-seo-ai-badge">IA</span>
          <h2>Criar recibo com inteligência artificial</h2>
          <p>
            Além do preenchimento manual, a Resodi permite <strong>criar recibo com IA</strong>. Você descreve
            o pagamento em linguagem natural e a ferramenta ajuda a organizar as informações nos campos do recibo.
          </p>
          <p className="receipt-seo-example">
            Exemplo: “Recebi R$ 1.000 de João pela manutenção de um computador em Aracruz.”
          </p>
          <p>
            A IA é uma assistência ao preenchimento. Antes de gerar o documento, confira nomes, valores, datas,
            CPF/CNPJ e a descrição do pagamento.
          </p>
        </div>
        <div>
          <h2>Como criar recibo com ChatGPT ou IA?</h2>
          <p>
            É comum pesquisar por <strong>criar recibo com ChatGPT</strong>, <strong>fazer recibo com ChatGPT</strong>
            ou <strong>modelo de recibo com IA</strong>. Na Resodi, você pode fazer esse processo diretamente no
            Gerador de Recibo usando a opção de IA da própria ferramenta.
          </p>
          <p>
            Assim, em vez de receber apenas um texto solto, você trabalha com campos estruturados, visualiza a
            prévia do recibo e pode corrigir qualquer informação antes da finalização.
          </p>
        </div>
      </div>

      <div className="receipt-seo-columns">
        <article>
          <h2>Modelo de recibo simples</h2>
          <p>
            Um modelo de recibo simples deve ser direto: quem recebeu, de quem recebeu, qual foi o valor, a que
            o pagamento se refere e quando ocorreu. A ferramenta monta a estrutura automaticamente conforme os
            dados informados.
          </p>
        </article>
        <article>
          <h2>Recibo de prestação de serviço</h2>
          <p>
            Autônomos, freelancers, profissionais e prestadores podem usar um recibo para registrar o recebimento
            por um serviço realizado. A emissão do recibo não substitui automaticamente eventuais obrigações fiscais.
          </p>
        </article>
        <article>
          <h2>Recibo em PDF para imprimir ou enviar</h2>
          <p>
            Depois da conferência, o documento pode ser finalizado em PDF. Isso facilita o envio digital, o
            armazenamento e a impressão do recibo quando uma cópia física for necessária.
          </p>
        </article>
      </div>

      <div className="receipt-seo-note">
        <h2>Recibo substitui nota fiscal?</h2>
        <p>
          Recibo e nota fiscal não são a mesma coisa. O recibo serve para registrar o recebimento de um valor.
          A necessidade de emitir nota fiscal depende da atividade, da operação realizada e das regras aplicáveis
          ao emissor. Quando houver dúvida tributária, consulte a regra correspondente ao seu caso.
        </p>
      </div>

      <div className="receipt-seo-faq">
        <span className="eyebrow">Dúvidas frequentes</span>
        <h2>Perguntas sobre recibos, PDF e IA</h2>
        <div className="receipt-seo-faq-list">
          {receiptFaq.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="receipt-seo-cta">
        <div>
          <h2>Crie seu recibo online</h2>
          <p>Preencha manualmente ou use a IA, confira a prévia e finalize seu recibo em PDF.</p>
        </div>
        <a className="button" href="#gerador-de-recibo">Voltar ao gerador</a>
      </div>
    </section>
  );
}
