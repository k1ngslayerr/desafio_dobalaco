# Aparência personalizável

A direção A (Clube) é a base de `/dashboard`, `/challenges`, `/ranking` e
`/profile` no modo UI. Abra **Aparência** na barra lateral ou o ícone de paleta
no cabeçalho móvel. Não são necessárias credenciais de Supabase.

## Comportamento

- Sistema segue `prefers-color-scheme` e reage a mudanças do sistema operacional.
- Claro, Escuro e Preto mudam o fundo e preservam a acentuação escolhida.
- Fundo e acentuação também aceitam seletor nativo e HEX com 3 ou 6 dígitos,
  com ou sem `#`. Exemplo: `#000000` para preto. Transparência não é aceita.
- As mudanças aparecem imediatamente. **Salvar aparência** persiste a
  preferência no navegador; cancelar, Escape e fechar descartam a prévia.
- **Restaurar padrão** volta a Sistema com azul `#3158CF`, ainda sujeito a salvar.
- A preferência vale para o navegador, não para uma conta. Outras abas recebem
  as alterações salvas. Se o armazenamento estiver bloqueado, o tema funciona
  na sessão e a interface informa que não conseguiu salvar.
- Apenas as duas cores escolhidas são armazenadas. Superfícies, bordas,
  texto, estados e cores de foco são calculados a partir delas. Botões do
  Clube usam a acentuação exata, com texto preto ou branco conforme o contraste.
  Texto colorido e componentes antigos podem receber ajuste de luminosidade.
- Fundos saturados mantêm cartões e superfícies na mesma família de cor,
  sem convertê-los em branco. Fundos claros neutros preservam cartões claros.
- A mesma paleta alcança portais de modais, notificações e tokens semânticos
  das páginas anteriores. Os status de sucesso, atenção e erro mantêm suas
  funções; não são convertidos na acentuação escolhida.
- Um bootstrap no documento aplica a paleta antes da hidratação para evitar
  a troca visível de um fundo claro por um tema escuro salvo.

## Organização

- `lib/appearance.ts`: validação, cálculo de cores, preferências padrão e bootstrap.
- `components/appearance`: provider global, painel e estilos.
- `components/club`: aplicação da direção A nas páginas de demonstração.
- As interfaces anteriores continuam acessíveis pelo menu **Mais páginas →
  Tela anterior · todas as opções**, ou adicionando `?view=original` às quatro
  rotas. Agenda, histórico e controles anteriores continuam disponíveis.
- A integração real continua com as telas anteriores quando o modo UI está
  desligado. Este trabalho não migra os protótipos para CRUD de produção.

## Verificação

`npm run test:appearance` (Node 24 neste ambiente) usa o runner nativo, sem
dependência nova. Cobre HEX e configurações inválidas, 2.025 combinações de
cores com uma fórmula de contraste independente, modo de sistema, cores
customizadas, armazenamento corrompido/bloqueado e paridade do bootstrap.

Critério da paleta: contraste de pelo menos 4,5:1 para texto principal,
secundário, acentuação textual, conteúdo de botões e status nos respectivos
fundos calculados. Isso não equivale a uma auditoria completa de acessibilidade
de todas as páginas legadas.

Validação no navegador: edição de HEX inválido, branco sobre branco, preto
com acentuação personalizada, salvar/recarregar, cancelar, Escape, restaurar
padrão, navegação com persistência, sincronização entre abas e modais com a
mesma paleta. O painel foi inspecionado no desktop e a 390 × 844, com rodapé
de ações visível e sem overflow horizontal. O aviso de confirmação não bloqueia
outros modais e desaparece automaticamente.

O build passou; 21 rotas (incluindo as quatro vistas anteriores) responderam
normalmente. O bootstrap extraído do HTML de produção também foi executado
isoladamente e produziu a mesma paleta testada. Capturas em
`artifacts/appearance`. Esses resultados descrevem a entrega original. O
estado atual do lint e os limites da validação estão registrados em
[frontend-review.md](frontend-review.md).
