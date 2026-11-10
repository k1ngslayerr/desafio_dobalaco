"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Camera,
  Check, CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Dumbbell, Flame, Flag, HeartPulse, ImagePlus, LayoutGrid, ListFilter, Loader2,
  MoreHorizontal, Plus, Search, Settings2, ShieldCheck, SlidersHorizontal,
  Target, ThumbsDown, ThumbsUp, Trophy, UserRound, Users, Utensils, X, Zap,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppearanceTrigger } from "@/components/appearance/AppearanceProvider";
import type { Database } from "@/lib/supabase/types";
import { challengeCategories, type ChallengeCategory } from "@/lib/preview/categories";
import { previewPosts, type PreviewPost as Post } from "@/lib/preview/feed";

export type LabScreen = "feed" | "desafios" | "ranking" | "perfil";
type Direction = "clube" | "arena";
type LabUser = Database["public"]["Tables"]["users"]["Row"] & { current_penalty: string | null };
type Challenge = Database["public"]["Tables"]["challenges"]["Row"] & { category?: ChallengeCategory };

const nav = [
  { screen: "feed", label: "Feed do grupo", icon: LayoutGrid },
  { screen: "desafios", label: "Desafios", icon: Flag },
  { screen: "ranking", label: "Ranking", icon: Trophy },
  { screen: "perfil", label: "Meu perfil", icon: UserRound },
] as const;

const feedCategoryIcons = {
  todos: SlidersHorizontal,
  treinos: Dumbbell,
  alimentacao: Utensils,
  leitura: BookOpen,
  "bem-estar": HeartPulse,
};

function href(direction: Direction, screen: LabScreen) { return `/ui-lab?direction=${direction}&screen=${screen}`; }
function number(value: number) { return value.toLocaleString("pt-BR"); }

function Portrait({ username, name, size = 40, src }: { username: string; name: string; size?: number; src?: string | null }) {
  const available = ["marina", "vitor", "rafael", "beatriz"].includes(username);
  return <span className="ui-portrait" style={{ width: size, height: size }}>
    {available || src ? <Image unoptimized={!!src} src={src || `/ui-lab/${username}.jpg`} alt={name} width={size} height={size} /> : name.slice(0, 2).toUpperCase()}
  </span>;
}

function FeedSupport({ user, users, rankingHref }: { user: LabUser; users: LabUser[]; rankingHref: string }) {
  return <div className="ui-feed-support-content">
    <section className="ui-feed-progress" aria-label="Seu progresso">
      <h2>Seu progresso</h2>
      <div className="ui-row"><span>Nível {user.level}</span><span className="ui-muted">250 / 400 XP</span></div>
      <div className="ui-progress" role="progressbar" aria-label="Progresso para o próximo nível" aria-valuenow={250} aria-valuemin={0} aria-valuemax={400}><span style={{ width: "62.5%" }} /></div>
      <p>Faltam <strong>150 XP</strong> para o próximo nível.</p>
    </section>
    <section className="ui-feed-weekly" aria-label="Ranking da semana">
      <h2>Ranking da semana</h2>
      <ol>{users.slice(0, 3).map((participant, index) => <li key={participant.id}>
        <span className="sr-only">{index + 1}º lugar:</span>
        <Portrait username={participant.username} name={participant.full_name ?? participant.username} src={participant.avatar_url} size={32} />
        <span className="ui-feed-ranking-name">{participant.id === user.id ? "Você" : participant.full_name?.split(" ")[0] || participant.username}</span>
        <span className="ui-muted">{480 - index * 80} XP</span>
      </li>)}</ol>
      <Link className="ui-text-link" href={rankingHref}>Ver ranking<ArrowUpRight size={14} /></Link>
    </section>
  </div>;
}

function Navigation({ screen, challengeCount, link, mobile = false }: { screen: LabScreen; challengeCount: number; link: (screen: LabScreen) => string; mobile?: boolean }) {
  return <nav aria-label={mobile ? "Navegação móvel da proposta" : "Navegação da proposta"} className={mobile ? "ui-mobile-nav" : "ui-navigation"}>
    {nav.map(({ screen: target, label, icon: Icon }) => <Link key={target} href={link(target)} aria-current={screen === target ? "page" : undefined}>
      <Icon size={20} strokeWidth={1.8} /><span>{mobile && target === "feed" ? "Feed" : label}</span>
      {!mobile && target === "desafios" && <span className="ui-nav-count">{challengeCount}</span>}
    </Link>)}
  </nav>;
}

function Progress({ level }: { level: number }) {
  return <div className="ui-progress-block">
    <div className="ui-row"><span className="ui-level"><Zap size={14} fill="currentColor" />Nível {level}</span><span className="ui-muted">250 / 400 XP</span></div>
    <div className="ui-progress" role="progressbar" aria-label="Progresso para o próximo nível" aria-valuenow={250} aria-valuemin={0} aria-valuemax={400}><span style={{ width: "62.5%" }} /></div>
    <p>Faltam <strong>150 XP</strong> para o nível {level + 1}.</p>
  </div>;
}

function MiniRanking({ user, activeUsers, rankingHref }: { user: LabUser; activeUsers: LabUser[]; rankingHref: string }) {
  return <section className="ui-side-section">
    <div className="ui-section-title"><h2>O ritmo da semana</h2><Trophy size={17} /></div>
    <p className="ui-muted ui-small">Cada participação faz diferença.</p>
    <ol className="ui-mini-ranking">{activeUsers.slice(0, 3).map((u, i) => <li key={u.id}>
      <span className="ui-place">{i + 1}</span><Portrait username={u.username} name={u.full_name ?? u.username} size={32} />
      <span className="ui-mini-name">{u.username === user.username ? "Você" : u.full_name?.split(" ")[0]}{u.id === user.id && <small>2º lugar</small>}</span>
      <strong>{480 - i * 80}<small> XP</small></strong>
    </li>)}</ol>
    <Link className="ui-text-link" href={rankingHref}>Ver ranking completo <ArrowUpRight size={15} /></Link>
  </section>;
}

function Today({ challenge, completed, onSelect, wide = false }: { challenge: Challenge | null; completed: boolean; onSelect: (challenge: Challenge) => void; wide?: boolean }) {
  if (!challenge) return null;
  return <section className={`ui-today ${wide ? "wide" : ""}`}>
    <div className="ui-today-icon"><Flag size={23} strokeWidth={1.6} /></div>
    <div className="ui-today-copy"><span className="ui-small ui-muted">Seu próximo check-in</span><h2>30 minutos para você.</h2><p>Caminhe, corra ou faça o seu treino.</p></div>
    <span className="ui-xp">+100 XP</span>
    <button className="ui-button primary" onClick={() => onSelect(challenge)}>{completed ? "Ver check-in" : "Registrar agora"}<ArrowUpRight size={17} /></button>
  </section>;
}

export function DesignLab({ direction, screen, user, users, challenges, mode = "studio" }: {
  direction: Direction; screen: LabScreen; user: LabUser; users: LabUser[]; challenges: Challenge[]; mode?: "studio" | "app";
}) {
  const focusedFeed = direction === "clube" && screen === "feed";
  const [supportOpen, setSupportOpen] = useState(false);
  const supportTrigger = useRef<HTMLButtonElement>(null);
  const [posts, setPosts] = useState(previewPosts);
  const [reactions, setReactions] = useState<Record<string, "positive" | "negative" | null>>({});
  const [filter, setFilter] = useState("todos");
  const [feedCategory, setFeedCategory] = useState<ChallengeCategory | "todos">("todos");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"geral" | "semanal">("semanal");
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [profile, setProfile] = useState<LabUser>(user);
  const [participant, setParticipant] = useState<LabUser | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [editProfile, setEditProfile] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [stateMenu, setStateMenu] = useState(false);
  const [feedState, setFeedState] = useState<"ready" | "empty" | "error" | "loading">("ready");
  const profileAvatarUrls = useRef<string[]>([]);
  useEffect(() => () => profileAvatarUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);
  function notify(text: string) {
    setFeedback(text);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(""), 4500);
  }

  const link = (target: LabScreen) => mode === "studio" ? href(direction, target) : ({feed: "/dashboard", desafios: "/challenges", ranking: "/ranking", perfil: "/profile"})[target];
  const dialogProfile = participant ?? profile;
  const nextChallenge = challenges[0] ?? null;
  const activeUsers = users.filter((u) => u.status === "active");
  const shownPosts = posts.filter((p) =>
    (filter !== "meus" || p.userId === user.id) &&
    (feedCategory === "todos" || p.category === feedCategory));
  function clearFeedFilters() { setFeedCategory("todos"); setFilter("todos"); }
  function closeProfile(open: boolean) {
    setEditProfile(open);
    if (!open) setAvatarDraft(null);
  }
  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username"));
    const fullName = String(data.get("name"));
    setProfile((old) => ({ ...old, username, full_name: fullName, avatar_url: avatarDraft ?? old.avatar_url }));
    setPosts((old) => old.map((post) => post.userId === user.id ? { ...post, username, name: fullName || username, avatarUrl: avatarDraft ?? profile.avatar_url } : post));
    closeProfile(false);
    notify("Perfil atualizado nesta prévia.");
  }
  const shownChallenges = challenges.filter((c) =>
    (filter === "todos" || filter === "meus" || c.frequency === filter) &&
    `${c.title} ${c.description}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));

  return <div className="ui-lab" data-direction={direction} data-mode={mode}>
    {mode === "studio" && <div className="ui-workbench">
      <Link href="/dashboard" className="ui-back"><ArrowLeft size={14} /><span>Interface atual</span></Link>
      <div className="ui-directions" aria-label="Comparar propostas">
        <Link href={href("clube", screen)} aria-current={direction === "clube" ? "page" : undefined}>A <span>Clube</span></Link>
        <Link href={href("arena", screen)} aria-current={direction === "arena" ? "page" : undefined}>B <span>Arena</span></Link>
      </div>
      <div className="ui-workbench-end"><span>Propostas · dados fictícios</span><button aria-label="Testar estados da interface" onClick={() => setStateMenu(!stateMenu)}><Settings2 size={16} /></button></div>
      {stateMenu && <div className="ui-state-menu"><strong>Estados do feed</strong>{(["ready", "loading", "empty", "error"] as const).map((state, i) => <button key={state} onClick={() => { setFeedState(state); setStateMenu(false); }}>{["Conteúdo preenchido", "Carregando", "Sem publicações", "Falha ao carregar"][i]}</button>)}</div>}
    </div>}

    {direction === "clube" ? <aside className="ui-rail">
      <Link className="ui-brand" href={link("feed")}><span className="ui-brand-mark"><ArrowUpRight size={25} /></span>desafiohub<span className="ui-brand-dot">.</span></Link>
      <Navigation screen={screen} challengeCount={challenges.length} link={link} />
      <div className="ui-rail-secondary"><AppearanceTrigger /><Link href="/weekly"><Clock3 size={19} />Resumo semanal<ArrowUpRight size={14} /></Link><Link href="/admin"><ShieldCheck size={19} />Administração<ArrowUpRight size={14} /></Link></div>
      <Link className="ui-account" href={link("perfil")}><Portrait username={profile.username} name={profile.full_name ?? profile.username} src={profile.avatar_url} /><div><strong>{profile.full_name?.split(" ")[0]}</strong><small>@{profile.username}</small></div><ChevronRight size={17} /></Link>
    </aside> : null}

    <div className="ui-app">
      <header className="ui-topbar">
        {direction === "arena" ? <><Link className="ui-brand" href={link("feed")}><span className="ui-brand-mark"><ArrowUpRight size={25} /></span>desafiohub<span className="ui-brand-dot">.</span></Link><Navigation screen={screen} challengeCount={challenges.length} link={link} /></> : <div className="ui-breadcrumb">Desafio do Balaco <ChevronRight size={14} /><strong>{nav.find((item) => item.screen === screen)?.label}</strong></div>}
        <div className="ui-topbar-actions">{direction === "clube" && <AppearanceTrigger compact />}<span className="ui-member-count"><Users size={16} />{activeUsers.length} participantes</span><details className="ui-more"><summary aria-label="Mais páginas"><MoreHorizontal size={21} /></summary><div>{mode === "app" && <Link href={`${link(screen)}?view=original`}>Tela anterior · todas as opções</Link>}<Link href="/weekly">Resumo semanal</Link><Link href="/admin">Administração</Link><Link href="/pending">Aprovação de conta</Link><Link href="/login">Login e cadastro</Link></div></details><Link href={link("perfil")} aria-label="Abrir meu perfil"><Portrait username={profile.username} name={profile.full_name ?? profile.username} src={profile.avatar_url} size={34} /></Link></div>
      </header>

      <main className={`ui-main screen-${screen}`}>
        <div className="ui-page-heading"><div><h1>{screen === "feed" ? (direction === "clube" ? "Feed do grupo" : <>O movimento<br />de hoje.</>) : screen === "desafios" ? "Um desafio de cada vez." : screen === "ranking" ? "Cada esforço conta." : "Sua história até aqui."}</h1><p>{screen === "feed" ? "Um espaço para compartilhar o que faz você avançar." : screen === "desafios" ? "Escolha o próximo passo. O grupo vai com você." : screen === "ranking" ? "Progresso individual. Motivação coletiva." : "Seus registros, suas conquistas e os próximos passos."}</p></div>{screen !== "perfil" && <button className="ui-button primary ui-main-cta" onClick={() => setSelectedChallenge(nextChallenge)}><Plus size={18} />Fazer check-in</button>}</div>

        {direction === "arena" && screen === "feed" && <Today challenge={nextChallenge} completed={nextChallenge !== null && completed.includes(nextChallenge.id)} onSelect={setSelectedChallenge} wide />}

        <div className="ui-content-layout">
          <div className="ui-primary-column">
            {screen === "feed" && <>
              {focusedFeed && <div className="ui-feed-support-access"><button ref={supportTrigger} className="ui-feed-support-trigger" type="button" onClick={() => setSupportOpen(true)} aria-haspopup="dialog"><Trophy size={16} />Progresso e ranking<ChevronRight size={15} /></button></div>}
              <div className="ui-composer"><Portrait username={profile.username} name={profile.full_name ?? profile.username} src={profile.avatar_url} /><button onClick={() => setSelectedChallenge(nextChallenge)}>Qual foi o seu passo de hoje?</button><button className="ui-icon-button" aria-label="Adicionar foto ao check-in" onClick={() => setSelectedChallenge(nextChallenge)}><ImagePlus size={21} /></button></div>
              <div className="ui-feed-heading"><h2 className={focusedFeed ? "sr-only" : undefined}>Feed do grupo<span aria-live="polite" aria-atomic="true">{shownPosts.length}<span className="sr-only">{shownPosts.length === 1 ? " registro encontrado" : " registros encontrados"}</span></span></h2><div className="ui-tabs"><button aria-pressed={filter === "todos"} onClick={() => setFilter("todos")}>Todos</button><button aria-pressed={filter === "meus"} onClick={() => setFilter("meus")}>Meus registros</button></div></div>
              <div className="ui-feed-categories" role="group" aria-label="Filtrar por tipo de desafio">
                {[{ id: "todos" as const, label: "Todos os tipos" }, ...challengeCategories].map(({ id, label }) => {
                  const Icon = feedCategoryIcons[id];
                  return <button key={id} type="button" aria-pressed={feedCategory === id}
                    onClick={() => setFeedCategory(id)}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></button>;
                })}
              </div>
              {feedState === "ready" && shownPosts.length === 0 && <div className="ui-empty" role="status">
                <ListFilter size={25} /><h3>Nenhum registro com esses filtros.</h3>
                <p>Escolha outro tipo de desafio ou veja todos os registros do grupo.</p>
                <button className="ui-button secondary" onClick={clearFeedFilters}>Limpar filtros</button>
              </div>}
              {feedState === "ready" && shownPosts.length > 0 && <div className="ui-posts">{shownPosts.map((post) => <SocialPost key={post.id} post={post} currentUserId={user.id} direction={direction} reaction={reactions[post.id] ?? null} onReaction={(type) => setReactions((old) => ({ ...old, [post.id]: type }))} onPhoto={setLightbox} onProfile={() => { setParticipant(post.userId === user.id ? null : users.find((u) => u.id === post.userId) ?? null); setEditProfile(true); }} />)}</div>}
              {feedState !== "ready" && <div className="ui-empty" role="status">{feedState === "loading" ? <Loader2 className="ui-spin" size={28} /> : feedState === "error" ? <CircleHelp size={28} /> : <Flag size={28} />}<h3>{feedState === "loading" ? "Buscando os registros do grupo…" : feedState === "error" ? "Não foi possível carregar o feed." : "O primeiro passo pode ser seu."}</h3><p>{feedState === "error" ? "Seus registros continuam seguros. Tente carregar novamente." : feedState === "empty" ? "Registre um desafio para começar a conversa pelo exemplo." : "Isso costuma levar só um instante."}</p><button className="ui-button secondary" onClick={() => { if (feedState === "empty") setSelectedChallenge(nextChallenge); else setFeedState("ready"); }}>{feedState === "empty" ? "Fazer primeiro check-in" : "Carregar registros"}</button></div>}
            </>}

            {screen === "desafios" && <>
              <div className="ui-challenge-tools"><label className="ui-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar um desafio" aria-label="Buscar um desafio" />{query && <button onClick={() => setQuery("")} aria-label="Limpar busca"><X size={16} /></button>}</label><span className="ui-small ui-muted">{shownChallenges.length} desafios</span></div>
              <div className="ui-tabs ui-challenge-tabs">{[["todos", "Todos"], ["daily", "Diários"], ["weekly", "Semanais"], ["streak", "Sequências"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
              <div className="ui-challenge-list">{shownChallenges.map((ch, i) => {
                const Icon = ch.frequency === "streak" ? Flame : ch.title.includes("Leia") ? BookOpen : ch.frequency === "weekly" ? Dumbbell : Target;
                return <article className="ui-challenge-item" key={ch.id}><div className={`ui-challenge-symbol symbol-${i % 3}`}><Icon size={25} strokeWidth={1.6} /></div><div className="ui-challenge-body"><div className="ui-row"><span className="ui-small ui-muted">{ch.frequency === "daily" ? "Diário" : ch.frequency === "weekly" ? `${ch.weekly_target} vezes na semana` : "Sequência diária"}</span><strong className="ui-xp">+{ch.xp_reward} XP</strong></div><h2>{ch.title}</h2><p>{ch.description}</p><div className="ui-challenge-bottom"><span><Camera size={14} />{ch.requires_photo ? "Com evidência" : "Foto opcional"}{ch.quantity_label ? ` · ${ch.quantity_label}` : ""}</span><button className={`ui-button ${completed.includes(ch.id) ? "secondary" : "primary"}`} onClick={() => setSelectedChallenge(ch)}>{completed.includes(ch.id) ? <><Check size={16} />Enviado</> : <>Registrar<ArrowUpRight size={15} /></>}</button></div></div></article>;
              })}</div>
              {!shownChallenges.length && <div className="ui-empty"><Search size={28} /><h3>Nenhum desafio por aqui.</h3><p>Tente outro termo ou veja todos os desafios.</p><button className="ui-button secondary" onClick={() => { setQuery(""); setFilter("todos"); }}>Limpar filtros</button></div>}
              <Link className="ui-agenda-link" href="/challenges?view=original"><Clock3 size={20} /><span><strong>O que vem por aí</strong><small>Veja os próximos desafios na agenda do grupo.</small></span><ArrowUpRight size={20} /></Link>
            </>}

            {screen === "ranking" && <>
              <div className="ui-ranking-heading"><div className="ui-tabs"><button aria-pressed={period === "semanal"} onClick={() => setPeriod("semanal")}>Esta semana</button><button aria-pressed={period === "geral"} onClick={() => setPeriod("geral")}>Geral</button></div><span className="ui-small ui-muted">{period === "semanal" ? "XP conquistado na semana" : "XP acumulado"}</span></div>
              <section className="ui-ranking-list" aria-label="Classificação do grupo"><div className="ui-ranking-columns"><span>Posição / participante</span><span>{period === "semanal" ? "XP semanal" : "XP total"}</span></div>{activeUsers.map((u, i) => <button key={u.id} className={`ui-ranking-person ${u.id === user.id ? "is-you" : ""}`} onClick={() => { setParticipant(u); setEditProfile(true); }}><span className={`ui-rank-number rank-${i + 1}`}>{i === 0 ? <Trophy size={21} /> : String(i + 1).padStart(2, "0")}</span><Portrait username={u.username} name={u.full_name ?? u.username} size={48} /><span className="ui-rank-name"><strong>{u.full_name}{u.id === user.id && <small>Você</small>}</strong><span>@{u.username} · Nível {u.level}</span></span><span className="ui-rank-xp"><strong>{number(period === "semanal" ? 480 - i * 80 : u.xp)}</strong><small>XP</small></span><ChevronRight size={17} /></button>)}</section>
              <div className="ui-ranking-context"><Trophy size={24} /><div><h2>Sua próxima conquista está perto.</h2><p>Mais um check-in de 100 XP leva você a 500 XP nesta semana.</p></div><button className="ui-button primary" onClick={() => setSelectedChallenge(nextChallenge)}>Fazer check-in<ArrowUpRight size={16} /></button></div>
              <p className="ui-ranking-footnote"><CircleHelp size={15} />Somente submissões aprovadas entram no ranking.</p>
            </>}

            {screen === "perfil" && <>
              <section className="ui-profile-panel"><div className="ui-profile-cover"><span className="ui-profile-cover-word">um passo de cada vez.</span><Flag size={70} strokeWidth={1} /></div><div className="ui-profile-main"><Portrait username={profile.username} name={profile.full_name ?? profile.username} src={profile.avatar_url} size={88} /><button className="ui-button secondary" onClick={() => { setParticipant(null); setEditProfile(true); }}>Editar perfil<Settings2 size={15} /></button><h2>{profile.full_name}</h2><p>@{profile.username}<span className="ui-profile-admin"><ShieldCheck size={13} />Admin</span></p><div className="ui-profile-stats"><div><strong>{number(user.xp)}</strong><span>XP acumulado</span></div><div><strong>{user.level}</strong><span>Nível atual</span></div><div><strong>2º</strong><span>No grupo</span></div></div><Progress level={user.level} /></div></section>
              <div className="ui-feed-heading"><h2>Seus registros<span>{posts.filter((p) => p.userId === user.id).length}</span><ListFilter size={17} /></h2><span className="ui-small ui-muted">Sua evolução tem história.</span></div>
              <div className="ui-profile-posts">{posts.filter((p) => p.userId === user.id).map((post) => <SocialPost key={post.id} post={post} currentUserId={user.id} direction={direction} reaction={reactions[post.id] ?? null} onReaction={(type) => setReactions((old) => ({ ...old, [post.id]: type }))} onPhoto={setLightbox} onProfile={() => setEditProfile(true)} />)}</div>
            </>}
          </div>

          {focusedFeed ? <aside className="ui-context-column ui-feed-support" aria-label="Progresso e ranking do grupo">
            <FeedSupport user={user} users={activeUsers} rankingHref={link("ranking")} />
          </aside> : <aside className="ui-context-column">
            {direction === "clube" && screen !== "perfil" && <section className="ui-self-panel"><div className="ui-self-heading"><Portrait username={profile.username} name={profile.full_name ?? profile.username} src={profile.avatar_url} size={44} /><div><h2>Seu próximo nível</h2><p>Está mais perto do que parece.</p></div></div><Progress level={user.level} /></section>}
            {screen !== "ranking" && <MiniRanking user={user} activeUsers={activeUsers} rankingHref={link("ranking")} />}
            {screen !== "perfil" && screen !== "ranking" && (direction === "clube" ? <Today challenge={nextChallenge} completed={nextChallenge !== null && completed.includes(nextChallenge.id)} onSelect={setSelectedChallenge} /> : <section className="ui-arena-progress"><h2>Seu progresso</h2><Progress level={user.level} /></section>)}
            {screen === "ranking" && direction === "arena" && <section className="ui-side-section"><h2>Seu progresso</h2><Progress level={user.level} /><Link className="ui-text-link" href={link("perfil")}>Ver meu perfil<ArrowUpRight size={15} /></Link></section>}
            <section className="ui-community-note"><div className="ui-facepile">{activeUsers.map((u) => <Portrait key={u.id} username={u.username} name={u.full_name ?? u.username} size={29} />)}</div><h2>Ninguém evolui sozinho.</h2><p>Reconheça o esforço de quem está nessa com você.</p><Link href={link("feed")}>Acompanhar o grupo <ArrowRight size={15} /></Link></section>
            <div className="ui-context-footer"><span>DesafioHub · 2026</span><span>Fotos e dados ilustrativos</span></div>
          </aside>}
        </div>
      </main>
      <Navigation screen={screen} challengeCount={challenges.length} link={link} mobile />
    </div>

    {focusedFeed && <Dialog open={supportOpen} onOpenChange={setSupportOpen}><DialogContent className="ui-lab-dialog ui-feed-support-dialog" data-direction="clube" finalFocus={supportTrigger}>
      <DialogHeader><DialogTitle>Progresso e ranking</DialogTitle><DialogDescription>Seu próximo nível e o ritmo do grupo nesta semana.</DialogDescription></DialogHeader>
      <FeedSupport user={user} users={activeUsers} rankingHref={link("ranking")} />
    </DialogContent></Dialog>}
    {feedback && <div className="ui-feedback" role="status"><CheckCircle2 size={20} /><span>{feedback}</span><button onClick={() => setFeedback("")} aria-label="Fechar confirmação"><X size={17} /></button></div>}
    <CheckInDialog direction={direction} challenge={selectedChallenge} challenges={challenges} onClose={() => setSelectedChallenge(null)} onSelect={setSelectedChallenge} onSubmit={(ch, title, description, photos) => {
      setPosts((old) => [{ id: `local-${Date.now()}`, userId: user.id, category: ch.category, username: profile.username, name: profile.full_name ?? profile.username, challenge: ch.title, title, text: description, photo: photos[0], photo2: photos[1], avatarUrl: profile.avatar_url, status: "pending", xp: ch.xp_reward, likes: 0, time: "Agora" }, ...old]);
      setCompleted((old) => [...new Set([...old, ch.id])]);
      setSelectedChallenge(null); notify("Check-in enviado para aprovação. Seu passo já está no feed.");
    }} />
    <Dialog open={editProfile} onOpenChange={closeProfile}><DialogContent data-direction={direction} className="ui-lab-dialog"><DialogHeader><DialogTitle>{dialogProfile.id === user.id ? "Seu perfil" : dialogProfile.full_name}</DialogTitle><DialogDescription>{dialogProfile.id === user.id ? "Ajuste como você aparece para o grupo. Alterações apenas nesta prévia." : `@${dialogProfile.username} · Nível ${dialogProfile.level} · ${number(dialogProfile.xp)} XP`}</DialogDescription></DialogHeader>{dialogProfile.id === user.id ? <form className="ui-profile-form" onSubmit={saveProfile}><label>Nome completo<input name="name" defaultValue={dialogProfile.full_name ?? ""} required maxLength={80} /></label><label>Nome de usuário<input name="username" defaultValue={dialogProfile.username} required minLength={3} maxLength={30} pattern="[a-z0-9_]+" title="Use letras minúsculas, números e sublinhado." /></label><label className="ui-upload"><Camera size={21} /><strong>Alterar foto do perfil</strong>{avatarDraft && <Image src={avatarDraft} alt="Prévia da nova foto de perfil" width={64} height={64} unoptimized />}<span>JPEG, PNG ou WebP · até 5 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Alterar foto do perfil" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { notify("Escolha uma imagem JPEG, PNG ou WebP de até 5 MB."); return; } const url = URL.createObjectURL(file); profileAvatarUrls.current.push(url); setAvatarDraft(url); }} /></label><button className="ui-button primary" type="submit">Salvar alterações<Check size={16} /></button></form> : <div className="ui-participant-preview"><Portrait username={dialogProfile.username} name={dialogProfile.full_name ?? dialogProfile.username} size={72} /><p>{dialogProfile.current_penalty ?? "Um passo de cada vez, junto com o grupo."}</p><Link className="ui-button primary" href={`/u/${dialogProfile.username}`}>Ver perfil completo<ArrowUpRight size={16} /></Link></div>}</DialogContent></Dialog>
    <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}><DialogContent data-direction={direction} className="ui-lab-dialog ui-lightbox"><DialogHeader><DialogTitle>Evidência do desafio</DialogTitle><DialogDescription>Foto ilustrativa de um registro do grupo.</DialogDescription></DialogHeader>{lightbox && <Image src={lightbox} alt="Evidência do desafio ampliada" width={1200} height={800} unoptimized />}</DialogContent></Dialog>
  </div>;
}

function SocialPost({ post, currentUserId, direction, onPhoto, onProfile, reaction, onReaction: setReaction }: { post: Post; currentUserId: string; direction: Direction; onPhoto: (src: string) => void; onProfile: () => void; reaction: "positive" | "negative" | null; onReaction: (type: "positive" | "negative" | null) => void }) {
  const [menu, setMenu] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photoButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const photos = [post.photo, post.photo2].filter((photo): photo is string => !!photo);
  function showPhoto(index: number) {
    setPhotoIndex(index);
    requestAnimationFrame(() => photoButtons.current[index]?.focus({ preventScroll: true }));
  }
  const status = { approved: "Aprovado", pending: "Em aprovação", contested: "Contestado" }[post.status];
  return <article className={`ui-post status-${post.status}`}>
    <header className="ui-post-author"><button className="ui-author-link" onClick={onProfile}><Portrait username={post.username} name={post.name} src={post.avatarUrl} /><span><strong>{post.name}</strong><small>{post.time}<span> · </span>{post.challenge}</small></span></button><div className="ui-post-menu"><button className="ui-icon-button" aria-label={`Opções do registro de ${post.name}`} onClick={() => setMenu(!menu)}><MoreHorizontal size={20} /></button>{menu && <div><button onClick={() => { onProfile(); setMenu(false); }}>Ver participante</button><span>{status}</span></div>}</div></header>
      <div className="ui-post-copy"><h3>{post.title}</h3><p>{post.text}</p></div>
      {photos.length > 0 && <div className="ui-post-gallery" data-count={photos.length} role="group" aria-label={`Fotos de ${post.title}`}>
        {photos.map((photo, index) => <button key={photo} className="ui-post-photo"
          ref={(element) => { photoButtons.current[index] = element; }}
          hidden={direction === "clube" && index !== photoIndex} onClick={() => onPhoto(photo)}
          aria-label={index === 0 ? `Ampliar foto: ${post.title}` : `Ampliar segunda foto: ${post.title}`}>
          <Image src={photo} alt={index === 1 ? "Segunda foto de evidência do desafio" : post.id === "read" ? "Estantes cheias de livros" : post.id === "run" ? "Corredor subindo uma escadaria" : "Evidência enviada para o desafio"}
            width={1200} height={800} priority={post.id === "run" && index === 0} unoptimized />
          <span><Camera size={14} />{index === 0 ? "Ver evidência" : "Foto 2"}</span>
        </button>)}
        {direction === "clube" && photos.length > 1 && <>
          <span className="ui-photo-count" role="status" aria-label={`Foto ${photoIndex + 1} de ${photos.length}`}>{photoIndex + 1} / {photos.length}</span>
          <button className="ui-photo-nav previous" disabled={photoIndex === 0} aria-label={`Foto anterior de ${post.title}`} onClick={() => showPhoto(photoIndex - 1)}><ChevronLeft size={20} /></button>
          <button className="ui-photo-nav next" disabled={photoIndex === photos.length - 1} aria-label={`Próxima foto de ${post.title}`} onClick={() => showPhoto(photoIndex + 1)}><ChevronRight size={20} /></button>
        </>}
      </div>}
    <div className="ui-post-meta"><span className="ui-post-status">{post.status === "approved" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{status}</span>{post.status === "approved" ? <strong>+{post.xp} XP<Zap size={13} fill="currentColor" /></strong> : <span className="ui-muted">{post.xp} XP {post.status === "pending" ? "após aprovação" : "em revisão"}</span>}</div>
    <footer className="ui-post-actions"><div><button disabled={post.userId === currentUserId} title={post.userId === currentUserId ? "Você não pode reagir ao próprio registro." : undefined} aria-pressed={reaction === "positive"} aria-label={`Reconhecer registro de ${post.name}`} onClick={() => setReaction(reaction === "positive" ? null : "positive")}><ThumbsUp size={18} /><span>{direction === "arena" ? "Reconhecer" : "Boa!"}</span><strong>{post.likes + (reaction === "positive" ? 1 : 0)}</strong></button><button disabled={post.userId === currentUserId} title={post.userId === currentUserId ? "Você não pode reagir ao próprio registro." : undefined} aria-pressed={reaction === "negative"} aria-label={`Reação negativa ao registro de ${post.name}`} onClick={() => setReaction(reaction === "negative" ? null : "negative")}><ThumbsDown size={17} /><span className="ui-negative-label">{reaction === "negative" ? 1 : ""}</span></button></div><span className="ui-reaction-caption">O grupo está acompanhando</span></footer>
  </article>;
}

function CheckInDialog({ direction, challenge, challenges, onClose, onSelect, onSubmit }: {
  direction: Direction; challenge: Challenge | null; challenges: Challenge[];
  onClose: () => void; onSelect: (challenge: Challenge) => void;
  onSubmit: (challenge: Challenge, title: string, description: string, photos: string[]) => void;
}) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [simulateError, setSimulateError] = useState(false);
  const photoRefs = useRef<string[]>([]);
  useEffect(() => () => photoRefs.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function close() { if (sending) return; setError(""); setPhotos([]); onClose(); }
  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!challenge) return;
    const data = new FormData(event.currentTarget);
    if (challenge.requires_photo && photos.length === 0) { setError("Adicione uma foto como evidência deste desafio."); return; }
    setError(""); setSending(true);
    timer.current = setTimeout(() => {
      setSending(false);
      if (simulateError) { setError("O envio falhou. Suas informações foram mantidas; tente novamente."); setSimulateError(false); return; }
      onSubmit(challenge, String(data.get("title")), String(data.get("description")), photos);
      setPhotos([]);
    }, 650);
  }

  return <Dialog open={!!challenge} onOpenChange={(open) => { if (!open) close(); }}><DialogContent data-direction={direction} className="ui-lab-dialog" showCloseButton={!sending}><DialogHeader><DialogTitle>Seu passo de hoje</DialogTitle><DialogDescription>Compartilhe o registro do desafio com o grupo.</DialogDescription></DialogHeader>
    <form className="ui-checkin-form" onSubmit={send}>
      <label>Desafio<select value={challenge?.id ?? ""} onChange={(e) => { const next = challenges.find((c) => c.id === e.target.value); if (next) { onSelect(next); setError(""); } }}>{challenges.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
      <div className="ui-checkin-reward"><Flag size={17} /><span>{challenge?.frequency === "weekly" ? `${challenge.weekly_target} registros na semana` : "Um registro por dia"}</span><strong>+{challenge?.xp_reward} XP</strong></div>
      <label>Título<input name="title" required maxLength={120} placeholder="Como foi o seu desafio?" /></label>
      <label>Seu registro<textarea name="description" required maxLength={500} rows={3} placeholder="Conte um pouco sobre esse passo…" /></label>
      {challenge?.quantity_label && <label>{challenge.quantity_label}<input name="quantity" type="number" min={1} max={challenge.max_quantity ?? undefined} required placeholder="Informe a quantidade" /></label>}
      <label className="ui-upload"><ImagePlus size={23} /><strong>{photos.length ? `${photos.length} foto(s) adicionada(s)` : "Adicionar evidência"}</strong><span>{challenge?.requires_photo ? "Foto obrigatória" : "Foto opcional"} · até 2 fotos, 5 MB cada</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="Adicionar fotos de evidência" onChange={(e) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length > 2 || files.some((f) => f.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(f.type))) { setError("Escolha até 2 imagens JPEG, PNG ou WebP de até 5 MB."); return; }
        const urls = files.map((f) => URL.createObjectURL(f)); photoRefs.current.push(...urls); setPhotos(urls); setError("");
      }} /></label>
      {photos.length > 0 && <div className="ui-upload-previews">{photos.map((photo, i) => <Image key={photo} src={photo} alt={`Prévia da foto ${i + 1}`} width={96} height={72} unoptimized />)}<button type="button" onClick={() => setPhotos([])}>Remover fotos</button></div>}
      {error && <p role="alert" className="ui-form-error">{error}</p>}
      <label className="ui-simulate-error"><input type="checkbox" checked={simulateError} onChange={(e) => setSimulateError(e.target.checked)} />Testar falha de envio nesta prévia</label>
      <div className="ui-form-footer"><button type="button" className="ui-button secondary" onClick={close} disabled={sending}>Cancelar</button><button type="submit" className="ui-button primary" disabled={sending}>{sending ? <><Loader2 size={17} className="ui-spin" />Enviando…</> : <>Enviar check-in<ArrowUpRight size={17} /></>}</button></div>
      <p className="ui-form-note">Prévia de interface. Nenhum dado é enviado ao servidor.</p>
    </form>
  </DialogContent></Dialog>;
}
