# Propostas de UI — DesafioHub

Escopo original: duas direções exploráveis em `/ui-lab`, cada uma com feed,
desafios, ranking e perfil. A direção A foi escolhida e agora é a base das quatro
rotas principais no modo UI, com [aparência personalizável](appearance.md).
A direção B permanece como referência da exploração anterior.

## Contrato de design

Público: participantes de um grupo de desafios de hábitos. Tarefa central:
registrar a participação e acompanhar o progresso dos colegas. Manter desafios
diários/semanais/sequência, quantidade, evidências com até duas fotos, status de
submissão, reações positivas/negativas, XP, níveis, ranking geral/semanal, perfil,
resumo semanal, punições, atestados e administração. Não acrescentar chat,
seguidores, pagamentos ou um sistema de comentários inexistente.

- **Clube:** superfícies claras `#F5F6F8`/`#FFFFFF`, texto `#222733`, cobalto
  `#3158CF`, borda `#E3E6ED`. Navegação lateral, coluna de feed com autoria,
  evidência e reação, contexto pessoal à direita. Geist em corpo e títulos;
  números tabulares. Mais fácil de ler; menos imersiva em fotos.
- **Arena:** grafite `#171A19`/`#222624`, texto `#F2F3ED`, laranja `#FF956C`,
  borda `#3A403D`. Navegação horizontal, título mais expressivo, mural de duas
  colunas, desafio diário em faixa horizontal. Geist com títulos mais pesados.
  Maior presença visual; menor densidade por viewport.
- Sem gradientes decorativos, texto em gradiente, gráficos sem ação, hero de
  KPIs, glassmorphism ou novos recursos só para preencher o layout.
- Mobile: uma coluna, contexto secundário recolhido, navegação inferior com
  rótulos, check-in acessível e formulários sem overflow.
- Estados: filtros selecionados, lista vazia com recuperação, falha de envio
  simulável, envio pendente, confirmação, campos inválidos, upload local de
  até duas imagens, botões desabilitados, foco e navegação por teclado.
- Conclusão verificável: oito combinações direção/tela renderizadas, ausência
  de overflow horizontal a 390px, imagens/fontes prontas, navegação, reações,
  busca, filtros e check-in exercitados, build e TypeScript aprovados.

## Raciocínio de produto

Aplicar **tempo até o primeiro valor (TTV)**: registrar um desafio é a ação
principal e não exige visitar páginas de gestão. Aplicar **camada acionável**:
XP é acompanhado da distância real até o próximo nível. A posição no ranking
separa acumulado de semanal. Não se presume ganho de retenção ou receita sem
medição. São hipóteses para testar com participantes, não resultados obtidos.

Fontes da skill Revenue-Centric Design:
- [TTV, Richard](https://x.com/richardrx/status/2074814716824731651)
- [Informação com direção, Richard](https://x.com/richardrx/status/2075623473565647202)

Referência pública inspecionada: comparação antes/depois do perfil no
[redesign das abas do Duolingo](https://blog.duolingo.com/core-tabs-redesign/).
Lição transferida: identidade, progresso e histórico precisam de hierarquia própria;
espaçamento pode organizar o conteúdo sem um cartão para cada informação.
Não há MCP UIZZE conectado; nenhuma consulta paga ou Pack foi utilizado.

Fotos de demonstração: Unsplash, [licença](https://unsplash.com/license).
Arquivos locais em `public/ui-lab`; pessoas e registros representam exemplos,
não usuários reais. Fontes das imagens (identificadores do CDN Unsplash):
`photo-1476480862126-209bfaa8edc8`, `photo-1507842217343-583bb7270b66`,
`photo-1494790108377-be9c29b29330`, `photo-1500648767791-00dcc994a43e`,
`photo-1506794778202-cad84cf45f1d`, `photo-1534528741775-53994a69daeb`.

## Verificação desta entrega

- `npm run build:ui` passou, incluindo a checagem TypeScript.
- Oito combinações de tela/direção inspecionadas no navegador em desktop
  e em viewport móvel de 390 × 844. Sem overflow horizontal nos 16 casos.
- Conferidos: navegação entre propostas/telas; filtros de feed; reações que
  permanecem ao filtrar; bloqueio de reação no próprio registro; busca sem
  resultados e limpeza dos filtros; frequência semanal; ranking geral;
  edição local do perfil; validação de foto obrigatória; falha simulada com
  recuperação; publicação pendente; duas fotos no registro e ampliação da
  segunda evidência.
- Contraste calculado com os tokens: Clube texto 14,94:1, texto secundário
  4,98:1 e botão 6,13:1; Arena texto 13,73:1, texto secundário 6,81:1 e
  botão 7,92:1. Isso não substitui uma auditoria completa de acessibilidade.
- Capturas reais em `artifacts/ui-proposals`, incluindo visões gerais por
  direção e comparação móvel. Não são imagens geradas por IA.
- As rotas originais não foram substituídas. Os protótipos são acessíveis
  somente no modo UI e usam estado local, sem CRUD real nem persistência.
- O lint do repositório tem o bloqueio de configuração já identificado na
  etapa anterior; não é apresentado como aprovado nesta entrega.
