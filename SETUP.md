# DesafioHub – Guia de Setup

## 1. Supabase

### Criar projeto
1. Acesse [supabase.com](https://supabase.com) → New Project
2. Copie a **Project URL** e as chaves **anon** e **service_role** em Settings → API

### Executar o schema SQL
No SQL Editor do Supabase, cole e execute o conteúdo de `supabase/schema.sql` completo.

Depois, rode em ordem todos os arquivos em `supabase/migrations/` (cada um adiciona
hardening de segurança ou ajusta o schema):

```
supabase/migrations/2026_05_15_fix_privilege_escalation.sql
supabase/migrations/2026_05_15_username_no_email_leak.sql
```

### Configurar Storage
Crie dois buckets:
- `submissions` — **Privado** (signed URLs via `/api/storage/sign`)
- `avatars` — **Público** (público porque avatars circulam livremente na UI)

### Ativar Realtime
Em Database → Replication, ative as tabelas:
- `public.submissions`
- `public.reactions`

> O ranking e a página `/pending` usam polling via API em vez de Realtime sobre `users` (o RLS restringe SELECT a `authenticated` e o browser client roda como anon por causa dos cookies httpOnly).

---

## 2. Upstash Redis (rate limiting)

1. Acesse [upstash.com](https://upstash.com) → Create Database (plano Free)
2. Copie **REST URL** e **REST Token**

---

## 3. Variáveis de ambiente

Crie um arquivo `.env.local` na raiz (use `.env.example` como base):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=seu-token
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 4. Rodar localmente

```bash
npm install
npm run dev
```

---

## 5. Deploy na Vercel

```bash
npm i -g vercel
vercel --prod
```

Adicione todas as env vars acima no painel Vercel (Settings → Environment Variables).

---

## 6. Criar primeiro admin

Após criar sua conta pelo /register, execute no SQL Editor do Supabase:

```sql
UPDATE public.users
SET role = 'admin'
WHERE username = 'SEU_USERNAME';
```

> O trigger `prevent_user_privilege_escalation` ignora esse UPDATE porque `auth.uid()` é NULL quando você roda direto no SQL Editor (service role).

---

## Estrutura de arquivos

```
supabase/schema.sql            ← SQL completo (tabelas, RLS, triggers, 1000 níveis)
supabase/migrations/           ← Migrações incrementais (hardening pré-pentest)
proxy.ts                       ← Proxy Next 16 — auth, CSRF, role cache, route gating
lib/env.ts                     ← Validação de variáveis de ambiente
lib/date.ts                    ← Helpers de timezone (America/Sao_Paulo)
lib/supabase/                  ← Clientes Supabase (browser, server, middleware)
lib/validators/                ← Schemas Zod para validação dupla
lib/rate-limit.ts              ← Rate limiting com Upstash Redis
lib/security/mime-check.ts     ← Validação de MIME por magic bytes
lib/security/sanitize.ts       ← Sanitização de nomes de arquivo
lib/storage/use-signed-url.ts  ← Hook que troca path → signed URL via /api/storage/sign

app/(auth)/login/              ← Login (Supabase auth direto)
app/(auth)/register/           ← Registro
app/(protected)/dashboard/     ← Dashboard com XP, nível e desafios abertos
app/(protected)/challenges/    ← Lista de desafios + upload de fotos
app/(protected)/challenges/[id]/ ← Feed realtime de um desafio
app/(protected)/ranking/       ← Ranking (polling /api/ranking)
app/(protected)/profile/       ← Perfil e histórico
app/(protected)/admin/         ← Painel admin (desafios, submissões, usuários, punições)

app/api/submissions/           ← POST: upload de foto + criação de submissão
app/api/submissions/[id]/      ← GET: fetch single submission (usado pelo realtime feed)
app/api/reactions/             ← POST/DELETE: reagir a submissões (bloqueia self-reaction)
app/api/storage/sign/          ← GET: signed URL para o bucket submissions privado
app/api/ranking/               ← GET: top 100 por XP
app/api/profile/               ← GET/PATCH: perfil + avatar
app/api/profile/status/        ← GET: status de aprovação (polling para /pending)
app/api/admin/challenges/      ← CRUD de desafios
app/api/admin/submissions/[id]/ ← Aprovar / contestar
app/api/admin/users/           ← Listar e promover admins
app/api/admin/penalties/       ← Atribuir / limpar punições individuais
app/api/admin/excuses/         ← Atestados de falta
app/api/admin/settings/        ← Configurações globais (group penalty)

components/LevelArt.tsx        ← 100 art tiers progressivos (SVG animados)
components/XPBar.tsx           ← Barra de XP com animação suave
components/SubmissionCard.tsx  ← Card de submissão com reações e status
components/ReactionButtons.tsx ← Botões de reação com optimistic update
components/FeedRealtime.tsx    ← Feed em tempo real via Supabase Realtime
components/Navbar.tsx          ← Navegação responsiva com menu do usuário
```
