# DesafioHub

Aplicação de desafios em grupo, com registros, evidências, XP e ranking.

## Desenvolvimento

### Trabalhar na UI sem Supabase

As telas principais agora usam a direção **Clube (A)**. Use **Aparência** na
barra lateral ou a paleta no cabeçalho para escolher fundo e acentuação,
com prévia ao vivo e preferências salvas no navegador. Veja os detalhes em
[`docs/appearance.md`](docs/appearance.md). As telas anteriores permanecem
acessíveis com `?view=original` e pelo menu **Mais páginas**.

```bash
npm run dev:ui
```

Abra [http://localhost:3000](http://localhost:3000). Nas telas principais,
use a navegação do Clube e o menu **Mais páginas**. Nas demais telas, o botão
**Modo UI · Telas** reúne os atalhos de autenticação, perfis e administração.
Os exemplos ficam em `lib/preview/data.ts` e `lib/preview/api.ts`.

Esse modo usa dados fictícios, libera a navegação e simula as respostas das
ações sem persistência. Não usa Supabase, Redis, OAuth nem uploads reais.
A tela de aprovação permanece pendente para permitir a edição do seu layout.
Atualizar a página restaura os exemplos; a preferência de aparência permanece.

Para validar ou executar um build de demonstração:

```bash
npm run build:ui
npm run start:ui
```

O modo é ativado explicitamente por `NEXT_PUBLIC_UI_PREVIEW=true`. Essa opção
também pode ficar em `.env.local` para usar `npm run dev` normalmente. Para voltar à integração real, remova a
opção ou defina `false`, configure as credenciais indicadas em `SETUP.md` e
reinicie o servidor usando `npm run dev`. Refaça o build ao trocar de modo:
variáveis `NEXT_PUBLIC_*` ficam incorporadas ao JavaScript do navegador.
Não publique um build de demonstração como a aplicação real.

## Integração real

Siga [`SETUP.md`](SETUP.md) para configurar Supabase, Redis, autenticação e
as variáveis de ambiente. Inicie com `npm run dev` e o modo de demonstração
desligado. As telas anteriores continuam responsáveis pela integração real.

## Verificação local

```bash
npm run test:appearance
npx tsc --noEmit --incremental false
npm run lint
```

O runner dos testes de aparência importa TypeScript diretamente; use Node 24.
As dependências são registradas em `package-lock.json`; use `npm ci` para uma
instalação reproduzível. Os exemplos visuais e as decisões do rework estão em
[`docs/ui-proposals.md`](docs/ui-proposals.md).
