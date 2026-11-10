# Revisão do frontend — 10/11/2026

Escopo: mudanças da `ui-rework` e ajustes locais do rework, com limpeza de
referências sem uso no restante do projeto. O layout aprovado foi preservado.

## Problemas corrigidos

- **Componentes recriados durante o render:** navegação, progresso, resumo do
  ranking e chamada de check-in foram movidos para o escopo do módulo. Isso
  evita remontagens e remove dez erros de `react-hooks/static-components`.
- **Propriedade de posts vinculada ao nome:** o bloqueio de reação e o filtro
  pessoal agora usam o ID do usuário. Alterar o nome de usuário mantém os
  registros vinculados à pessoa correta.
- **Avatar aplicado ao cancelar:** a imagem escolhida fica em rascunho até
  salvar. Fechar o diálogo descarta esse rascunho. Nome e avatar salvos são
  refletidos nos registros locais do próprio usuário.
- **Dimensões de navegação duplicadas:** a largura do menu e a compensação
  de centralização passam a usar a mesma variável CSS.
- **Tipagem encoberta por `any`:** o formulário administrativo de desafios
  distingue a entrada do Zod do resultado validado do resolver.
- **Configuração de lint incompatível com o manifesto:** Next e
  `eslint-config-next` ficam alinhados em 16.4.6 no lockfile.

## Código removido

- Dependência `next-themes`, substituída pelo provider de aparência próprio.
- Componentes sem importadores: `table`, `sheet`, `tabs` e `progress` de
  `components/ui`.
- SVGs padrão sem referências: `file`, `globe`, `next`, `vercel` e `window`.
- Imports, parâmetros, setters, diretivas de lint e campos de contexto sem
  consumidores; estado constante do motivo de atestado; reset redundante do
  formulário desmontado ao fechar o check-in.
- Texto genérico de scaffolding do README.

Os dados ilustrativos dos posts foram separados em `lib/preview/feed.ts` e
referenciam usuários e categorias das fixtures existentes. Telas legadas,
Arena e capturas históricas continuam referenciadas e foram preservadas.

## Validação

- TypeScript: `tsc --noEmit --incremental false`, sem erros.
- Seis testes de aparência aprovados.
- Navegador: avatar em rascunho/cancelamento, edição de identidade, filtro
  pessoal e bloqueio de reação ao próprio registro.
- Centralização e ausência de overflow verificadas em 320, 390, 768, 1024,
  1100, 1280, 1366, 1487 e 1920 px.
- Manifesto e dependências raiz do lockfile conferidos.

O lint local passou de **20 erros e 14 avisos** para **7 erros e 1 aviso**.
Os restantes já existiam antes desta revisão: `set-state-in-effect` nas telas
administrativas, no perfil de participante, no resumo semanal e na
inicialização do provider de aparência; `incompatible-library` no uso de
`react-hook-form` da tela legada de desafios. O lint completo ainda não passa.

O lockfile foi regenerado sem reinstalar o `node_modules` do servidor de
desenvolvimento em execução. A instalação local continua com Next e
`eslint-config-next` 16.2.6; os testes acima usam esse ambiente. Um build limpo
com as versões do lockfile exige `npm ci` e não foi executado nesta revisão.
