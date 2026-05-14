# DesafioHub – Guia de Setup

## 1. Supabase

### Criar projeto
1. Acesse [supabase.com](https://supabase.com) → New Project
2. Copie a **Project URL** e as chaves **anon** e **service_role** em Settings → API

### Executar o schema SQL
No SQL Editor do Supabase, cole e execute o conteúdo de `supabase/schema.sql` completo.

### Configurar Storage
Crie dois buckets públicos:
- `submissions` — fotos dos desafios
- `avatars` — fotos de perfil

### Ativar Realtime
Em Database → Replication, ative as tabelas:
- `public.submissions`
- `public.reactions`
- `public.users`

---

## 2. Upstash Redis (rate limiting)

1. Acesse [upstash.com](https://upstash.com) → Create Database (plano Free)
2. Copie **REST URL** e **REST Token**

---

## 3. hCaptcha

1. Acesse [hcaptcha.com](https://www.hcaptcha.com) → Sign Up (plano Free)
2. Adicione seu domínio e copie o **Site Key** e **Secret Key**

---

## 4. Variáveis de ambiente

Crie um arquivo `.env.local` na raiz (use `.env.example` como base):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=seu-token
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=seu-site-key
HCAPTCHA_SECRET_KEY=seu-secret-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 5. Rodar localmente

```bash
npm install
npm run dev
```

---

## 6. Deploy na Vercel

```bash
npm i -g vercel
vercel --prod
```

Adicione todas as env vars acima no painel Vercel (Settings → Environment Variables).

---

## 7. Criar primeiro admin

Após criar sua conta pelo /auth/register, execute no SQL Editor do Supabase:

```sql
UPDATE public.users
SET role = 'admin'
WHERE username = 'SEU_USERNAME';
```

---

## Estrutura de arquivos criados

```
supabase/schema.sql          ← SQL completo (tabelas, RLS, triggers, 1000 níveis)
middleware.ts                ← Proteção de rotas + verificação de admin
lib/env.ts                   ← Validação de variáveis de ambiente
lib/supabase/                ← Clientes Supabase (browser, server, middleware)
lib/validators/              ← Schemas Zod para validação dupla
lib/rate-limit.ts            ← Rate limiting com Upstash Redis
lib/security/mime-check.ts   ← Validação de MIME por magic bytes
lib/security/sanitize.ts     ← Sanitização de nomes de arquivo

app/(auth)/login/            ← Login com hCaptcha
app/(auth)/register/         ← Registro com hCaptcha
app/(protected)/dashboard/   ← Dashboard com XP, nível e desafios abertos
app/(protected)/challenges/  ← Lista de desafios + upload de fotos
app/(protected)/challenges/[id]/ ← Feed realtime de um desafio
app/(protected)/ranking/     ← Ranking ao vivo
app/(protected)/profile/     ← Perfil e histórico
app/(protected)/admin/       ← Painel admin (desafios, submissões, usuários)

app/api/submissions/         ← POST: upload de foto (magic bytes check)
app/api/reactions/           ← POST/DELETE: reagir a submissões
app/api/admin/challenges/    ← CRUD de desafios
app/api/admin/submissions/[id]/ ← Aprovar / contestar
app/api/admin/users/         ← Listar e promover admins

components/LevelArt.tsx      ← 100 art tiers progressivos (SVG animados)
components/XPBar.tsx         ← Barra de XP com animação suave
components/SubmissionCard.tsx ← Card de submissão com reações e status
components/ReactionButtons.tsx ← Botões de reação com optimistic update
components/FeedRealtime.tsx  ← Feed em tempo real via Supabase Realtime
components/Navbar.tsx        ← Navegação responsiva com menu do usuário
```
