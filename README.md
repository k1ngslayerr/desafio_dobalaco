This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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
também pode ficar em `.env.local` para usar `npm run dev` normalmente, como
configurado neste ambiente local. Para voltar à integração real, remova a
opção ou defina `false`, configure as credenciais indicadas em `SETUP.md` e
reinicie o servidor usando `npm run dev`. Refaça o build ao trocar de modo:
variáveis `NEXT_PUBLIC_*` ficam incorporadas ao JavaScript do navegador.
Não publique um build de demonstração como a aplicação real.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
