# AGENTS.md — Resodi

## Projeto e escopo

- Este repositório contém a **Resodi**, uma plataforma de ferramentas e serviços digitais.
- Estas instruções se aplicam a todo o repositório.
- A stack principal é **React**, **Vite**, **React Router**, **Supabase** e **Vercel**.
- Use a versão do Node.js definida em `.nvmrc` e em `package.json`. Se os dois arquivos divergirem, não altere nenhum deles sem solicitação; informe a inconsistência.

## Identidade visual

- O nome oficial da marca é **Resodi** e o slogan é **Resolva serviços digitais.**
- O domínio oficial para referências públicas é **https://www.resodi.com.br**.
- A paleta aprovada é azul principal `#163B63`, azul escuro `#0D2742`, verde `#2E9E6F`, fundo claro `#F4F6F8` e branco `#FFFFFF`.
- A tipografia oficial é **Manrope**, preferencialmente nos pesos Regular e Medium.
- Reutilize os ativos oficiais da marca disponíveis em `public/brand/`.
- Não redesenhe, recrie ou altere a marca e seu símbolo sem solicitação explícita.

## Arquitetura atual

- Preserve a arquitetura, os padrões e a organização existentes no projeto.
- Mantenha a inicialização da aplicação em `src/main.jsx`, o roteamento em `src/app/router.jsx`, os layouts e as páginas gerais em `src/app/`, e os componentes compartilhados em `src/components/`.
- Reutilize componentes, utilitários e serviços existentes antes de criar alternativas ou componentes duplicados.
- Organize cada nova ferramenta em uma pasta própria dentro de `src/tools/`, seguindo o padrão das ferramentas existentes.
- Centralize o cadastro de ferramentas em `src/tools/registry.js` e atualize rotas e registros somente quando isso for necessário para a funcionalidade solicitada.
- Mantenha integrações e acessos a serviços em `src/services/` e utilitários compartilhados em `src/utils/`, respeitando as responsabilidades atuais dessas pastas.

## Regras para alterações

- Altere somente o que estiver diretamente relacionado à tarefa solicitada.
- Não altere funcionalidades, comportamento, layout ou arquivos não relacionados à tarefa.
- Não faça refatorações amplas, reorganizações de pastas ou mudanças arquiteturais sem solicitação explícita.
- Priorize código simples, legível, consistente com o código existente e fácil de manter.
- Preserve a compatibilidade e a experiência de uso em dispositivos mobile e desktop.
- Evite alterações desnecessárias em `package.json` e `package-lock.json`.
- Não adicione, remova ou atualize dependências automaticamente sem solicitação explícita.
- Não altere configurações da Vercel ou do Supabase, incluindo projetos, migrações, políticas e variáveis, a menos que isso faça parte explicitamente da tarefa.

## Segurança e integrações

- Nunca insira chaves, tokens, senhas, credenciais ou outros segredos diretamente no código ou em arquivos versionados.
- Use variáveis de ambiente para integrações externas e mantenha apenas nomes de variáveis e valores de exemplo seguros em arquivos como `.env.example`.
- No frontend Vite, considere que variáveis expostas ao cliente não são secretas, inclusive as prefixadas com `VITE_`.
- Não registre dados sensíveis em logs nem os inclua em mensagens de erro, exemplos, commits ou documentação.

## Verificação e conclusão

- Antes de finalizar qualquer alteração, execute:

  ```bash
  npm run lint
  npm run build
  ```

- Se lint, teste ou build falhar, investigue e explique claramente o problema antes de considerar a tarefa concluída. Não omita falhas preexistentes ou limitações do ambiente.
- Quando houver testes específicos relacionados à área alterada, execute-os além das verificações obrigatórias.
- Ao finalizar cada tarefa, informe resumidamente quais arquivos foram alterados e quais verificações foram executadas, incluindo seus resultados.
