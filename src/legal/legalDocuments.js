import { siteIdentity } from '../config/siteIdentity.js';

export const legalDocumentTypes = Object.freeze({
  termsOfUse: 'terms_of_use',
  privacyPolicy: 'privacy_policy'
});

function document(type, title, path, seo, sections, contentHash) {
  return Object.freeze({
    type,
    version: '1.0',
    effectiveDate: '2026-09-03',
    title,
    path,
    seo,
    contentHash,
    sections: Object.freeze(sections.map(([heading, paragraphs]) => Object.freeze({
      heading,
      paragraphs: Object.freeze(paragraphs)
    })))
  });
}

export const legalDocuments = Object.freeze([
  document(legalDocumentTypes.termsOfUse, 'Termos de Uso', '/termos-de-uso', {
    title: 'Termos de Uso',
    description: 'Consulte os Termos de Uso da Resodi e conheça as regras aplicáveis às ferramentas, serviços e consultorias da plataforma.'
  }, [
    ['1. Identificação e finalidade da Resodi', [`A Resodi é uma plataforma de ferramentas e serviços digitais. Estes Termos disciplinam o uso da plataforma, de suas ferramentas automáticas e de eventuais serviços ou consultorias solicitados pelo usuário. A identificação cadastral atualmente utilizada pela operação é o CNPJ ${siteIdentity.cnpj}.`]],
    ['2. Aceitação dos Termos', ['Ao utilizar a plataforma ou solicitar um serviço, o usuário declara que leu e compreendeu estes Termos. Aceites que forem exigidos em fluxos específicos serão registrados para a versão aplicável do documento.']],
    ['3. Ferramentas automáticas e serviços/consultorias', ['As ferramentas podem auxiliar na criação, organização ou preparação de conteúdos e documentos. Serviços e consultorias dependem do escopo contratado e não substituem análise profissional quando ela for necessária ao caso concreto.']],
    ['4. Responsabilidades do usuário', ['O usuário deve utilizar a plataforma de modo lícito, cuidadoso e compatível com estes Termos. É sua responsabilidade revisar informações e resultados antes de utilizá-los, enviá-los ou tomar decisões com base neles.']],
    ['5. Veracidade das informações', ['O usuário é responsável pela exatidão, atualidade e legitimidade das informações fornecidas. A Resodi pode depender dessas informações para executar corretamente a ferramenta, o serviço ou a consultoria solicitados.']],
    ['6. Dados e documentos fornecidos', ['O usuário deve fornecer apenas os dados e documentos necessários ao serviço solicitado e deve possuir autorização para compartilhá-los. Não envie informações que não sejam pertinentes à finalidade informada.']],
    ['7. Execução dos serviços', ['A execução de serviços observa o escopo, as condições e os prazos aplicáveis à contratação. Quando for necessária autenticação pessoal, o usuário deverá realizar o procedimento diretamente ou utilizar meio oficial de representação ou autorização, quando existente.']],
    ['8. Compartilhamento necessário para prestação do serviço', ['O usuário declara ciência de que, para a execução do serviço solicitado, a Resodi poderá tratar e, quando necessário, compartilhar os dados e documentos estritamente necessários à prestação contratada, observadas as finalidades informadas e a legislação aplicável.', 'Esse compartilhamento pode envolver órgãos públicos, plataformas oficiais, fornecedores tecnológicos, prestadores envolvidos e operadores necessários à prestação, sempre limitado à finalidade pertinente. Quando uma finalidade depender juridicamente de consentimento específico, ele será solicitado separadamente.']],
    ['9. Pagamentos, cancelamentos e reembolsos', ['Valores, formas de pagamento, cancelamentos e reembolsos serão apresentados nas condições aplicáveis à contratação. Nenhuma cobrança ou direito a reembolso é criado apenas pela navegação na plataforma.']],
    ['10. Condutas proibidas', ['É proibido usar a plataforma para finalidade ilícita, violar direitos de terceiros, tentar acessar sistemas sem autorização, interferir no funcionamento da plataforma ou fornecer dados falsos.']],
    ['11. Propriedade intelectual', ['A plataforma, sua identidade visual, conteúdos e elementos protegidos pertencem à Resodi ou a seus respectivos titulares. O uso da plataforma não transfere direitos de propriedade intelectual além do necessário para sua utilização regular.']],
    ['12. Disponibilidade da plataforma', ['A Resodi busca manter a plataforma disponível e funcional, mas pode realizar manutenção, atualização ou interrupções necessárias. Não é garantida disponibilidade ininterrupta ou ausência de falhas.']],
    ['13. Privacidade e proteção de dados', ['O tratamento de dados pessoais é descrito na Política de Privacidade. O aceite destes Termos não representa consentimento universal para todo e qualquer tratamento de dados pessoais.']],
    ['14. Segurança e confidencialidade', ['A Resodi adota medidas técnicas e administrativas adequadas para proteger dados pessoais contra acessos não autorizados, perda, destruição, alteração, divulgação ou tratamento inadequado. As medidas incluem acesso restrito, menor privilégio, confidencialidade, retenção limitada, prevenção de acessos indevidos, resposta a incidentes e revisão periódica de controles, sem garantia de segurança absoluta.']],
    ['15. Alterações dos Termos e versionamento', ['Estes Termos são versionados. O conteúdo de uma versão publicada não será alterado silenciosamente; mudanças materiais resultarão em nova versão, com vigência e registro próprios.']],
    ['16. Legislação aplicável', ['Estes Termos são regidos pela legislação brasileira aplicável.']],
    ['17. Contato pelos canais oficiais disponibilizados pela Resodi', ['Dúvidas sobre estes Termos devem ser encaminhadas pelos canais oficiais disponibilizados pela Resodi na plataforma.']]
  ], 'aa8b1c508bf483ea0e3fc1b11fd7a2d05b7dcad461f2a57668a2e4ba8187bffb'),
  document(legalDocumentTypes.privacyPolicy, 'Política de Privacidade', '/politica-de-privacidade', {
    title: 'Política de Privacidade',
    description: 'Saiba como a Resodi trata, protege e utiliza dados pessoais em suas ferramentas, serviços e consultorias.'
  }, [
    ['1. Sobre esta Política', ['Esta Política explica como a Resodi pode tratar dados pessoais ao disponibilizar ferramentas, serviços e consultorias. Ela deve ser lida em conjunto com os Termos de Uso e com informações específicas apresentadas em cada fluxo.']],
    ['2. Identificação da Resodi', [`A Resodi é uma plataforma de ferramentas e serviços digitais. A identificação cadastral atualmente utilizada pela operação é o CNPJ ${siteIdentity.cnpj}.`]],
    ['3. Dados que podem ser tratados', ['A Resodi pode tratar dados pessoais necessários para disponibilizar a plataforma, executar ferramentas, atender solicitações, prestar serviços, cumprir obrigações e proteger a operação.']],
    ['4. Dados fornecidos pelo usuário', ['Podem ser tratados dados inseridos diretamente pelo usuário, como informações de cadastro, dados necessários a ferramentas e informações enviadas em solicitações de serviço.']],
    ['5. Dados técnicos e operacionais', ['Podem ser tratados dados técnicos e operacionais necessários ao funcionamento e à segurança da plataforma, como registros de acesso, dispositivo, navegador e interações técnicas.']],
    ['6. Dados e documentos relacionados a serviços', ['Quando o usuário solicitar um serviço ou consultoria, a Resodi poderá tratar os dados e documentos estritamente necessários à execução da prestação contratada.']],
    ['7. Finalidades do tratamento', ['Os dados podem ser tratados para fornecer ferramentas e serviços, autenticar usuários, atender solicitações, prevenir fraudes e abusos, cumprir obrigações legais, exercer direitos e aprimorar a operação de forma compatível com a legislação.']],
    ['8. Bases legais', ['O tratamento ocorrerá conforme a base legal adequada a cada finalidade, como execução de contrato ou procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse quando aplicável e consentimento quando juridicamente necessário.']],
    ['9. Dados pessoais sensíveis', ['Determinados serviços futuros podem envolver dados pessoais sensíveis. Esses dados somente serão tratados quando necessários, com fundamento legal adequado, acesso limitado e finalidade compatível com o serviço solicitado. O consentimento não é presumido como base universal.']],
    ['10. Ferramentas automáticas e fornecedores tecnológicos', ['A Resodi pode utilizar fornecedores de hospedagem, banco de dados, autenticação, pagamentos, inteligência artificial, infraestrutura e comunicação, conforme necessário para a operação e a prestação dos serviços.']],
    ['11. Compartilhamento de dados', ['Dados podem ser compartilhados com operadores e prestadores que atuem em nome da Resodi, apenas na medida necessária e com finalidade compatível. Não há compartilhamento indiscriminado de dados pessoais.']],
    ['12. Órgãos públicos e plataformas oficiais', ['Quando necessário para executar o serviço solicitado ou cumprir obrigação aplicável, dados e documentos podem ser compartilhados com órgãos públicos e plataformas oficiais, dentro dos limites da finalidade pertinente.']],
    ['13. Armazenamento e retenção', ['Os dados são mantidos pelo período necessário para cumprir a finalidade do tratamento, obrigações legais ou regulatórias, exercício de direitos e necessidades legítimas aplicáveis. Não há um prazo único de retenção para todos os dados.']],
    ['14. Segurança da informação', ['A Resodi adota medidas técnicas e administrativas adequadas para proteger dados pessoais contra acessos não autorizados, perda, destruição, alteração, divulgação ou tratamento inadequado. Isso inclui acesso restrito, princípio do menor privilégio, deveres de confidencialidade, retenção limitada, prevenção de acessos indevidos e revisão das medidas de segurança.']],
    ['15. Incidentes de segurança', ['A Resodi mantém medidas de prevenção e resposta a incidentes. Caso um incidente possa gerar risco ou dano relevante, serão adotadas as providências aplicáveis conforme a legislação.']],
    ['16. Direitos do titular', ['O titular pode solicitar informações sobre o tratamento de seus dados e exercer os direitos previstos na legislação aplicável, observadas as hipóteses e limites legais.']],
    ['17. Exclusão, correção e atualização', ['O titular pode solicitar correção, atualização ou exclusão de dados, quando cabível. Algumas informações podem precisar ser preservadas por obrigação legal, exercício de direitos ou outra hipótese legítima aplicável.']],
    ['18. Transferências internacionais quando aplicáveis', ['Se houver transferência internacional de dados, ela ocorrerá apenas quando necessária à operação ou ao serviço e de acordo com os requisitos legais aplicáveis.']],
    ['19. Alterações da Política e versionamento', ['Esta Política é versionada. O conteúdo de uma versão publicada não será alterado silenciosamente; mudanças materiais resultarão em nova versão, com vigência e registro próprios.']],
    ['20. Canais oficiais de contato', ['Solicitações e dúvidas sobre privacidade podem ser encaminhadas pelos canais oficiais disponibilizados pela Resodi na plataforma.']]
  ], '0dac27a0fc8b23345f547d2185bae200c19d730794003f87911c3fe6ee3e5e1c')
]);

export function canonicalLegalDocument(document) {
  return JSON.stringify({
    type: document.type,
    version: document.version,
    effectiveDate: document.effectiveDate,
    title: document.title,
    sections: document.sections.map(({ heading, paragraphs }) => ({ heading, paragraphs }))
  });
}

export const legalDocumentsByPath = Object.freeze(Object.fromEntries(
  legalDocuments.map((document) => [document.path, document])
));
