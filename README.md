# Gerador Fácil

Projeto de ferramentas online para gerar documentos e arquivos automaticamente.

## Stack

- React + Vite
- Vercel
- Supabase
- n8n
- Render, se necessário para backend/PDF avançado

## Primeiras ferramentas

- Gerador de Recibo de Pagamento
- Gerador de Currículo

## Objetivo da estrutura

Permitir adicionar novas ferramentas com poucas alterações:

1. Criar uma pasta em `src/tools/nova-ferramenta`.
2. Criar página, formulário, preview, config e utils.
3. Registrar a ferramenta em `src/tools/registry.js`.
4. A ferramenta passa a aparecer no menu, home e página de ferramentas.
