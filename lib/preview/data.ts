import { appDateStr, appWeekStartStr, datePlusDays } from "@/lib/date";
import type { Database } from "@/lib/supabase/types";
import type { SubmissionCardData } from "@/components/SubmissionCard";
import type { ChallengeCategory } from "./categories";

type User = Database["public"]["Tables"]["users"]["Row"] & {
  current_penalty: string | null;
};
type Challenge = Database["public"]["Tables"]["challenges"]["Row"] & { category: ChallengeCategory };

export const previewUser: User = {
  id: "10000000-0000-4000-8000-000000000001",
  username: "vitor", full_name: "Vitor Almeida", avatar_url: null,
  xp: 2450, level: 12, role: "admin", status: "active",
  current_penalty: null, created_at: "2026-01-05T12:00:00Z",
};

export const previewUsers: User[] = [
  { ...previewUser, id: "10000000-0000-4000-8000-000000000002", username: "marina", full_name: "Marina Costa", xp: 3280, level: 16, role: "user" },
  previewUser,
  { ...previewUser, id: "10000000-0000-4000-8000-000000000003", username: "rafael", full_name: "Rafael Santos", xp: 1820, level: 9, role: "user", current_penalty: "Completar uma caminhada extra de 20 minutos." },
  { ...previewUser, id: "10000000-0000-4000-8000-000000000004", username: "beatriz", full_name: "Beatriz Lima", xp: 1460, level: 7, role: "user" },
  { ...previewUser, id: "10000000-0000-4000-8000-000000000005", username: "lucas", full_name: "Lucas Oliveira", xp: 0, level: 1, role: "user", status: "pending" },
  { ...previewUser, id: "10000000-0000-4000-8000-000000000006", username: "camila", full_name: "Camila Rocha", xp: 680, level: 4, role: "user", status: "suspended" },
];

const challengeBase: Challenge = {
  category: "treinos",
  id: "20000000-0000-4000-8000-000000000001",
  title: "Movimente-se por 30 minutos",
  description: "Vale caminhada, corrida, bicicleta ou aquele treino que você gosta. Registre seu momento e inspire o grupo.",
  xp_reward: 100, penalty_xp: 20, requires_photo: true, frequency: "daily",
  weekly_target: 1, starts_at: null, ends_at: null, quantity_label: null,
  xp_per_unit: null, max_quantity: null, created_by: previewUser.id,
  is_active: true, created_at: "2026-01-05T12:00:00Z",
};

export const previewChallenges: Challenge[] = [
  challengeBase,
  { ...challengeBase, category: "leitura", id: "20000000-0000-4000-8000-000000000002", title: "Leia 20 páginas", description: "Reserve um tempo para um livro e compartilhe uma ideia que ficou com você.", requires_photo: false, xp_reward: 80 },
  { ...challengeBase, id: "20000000-0000-4000-8000-000000000003", title: "Treine três vezes na semana", description: "Construa sua rotina com três treinos no seu ritmo.", frequency: "weekly", weekly_target: 3, xp_reward: 150 },
  { ...challengeBase, category: "bem-estar", id: "20000000-0000-4000-8000-000000000004", title: "Uma semana de hidratação", description: "Beba água ao longo do dia e mantenha sua sequência.", frequency: "streak", requires_photo: false, xp_reward: 60 },
  { ...challengeBase, id: "20000000-0000-4000-8000-000000000005", title: "Cada quilômetro conta", description: "Some os quilômetros da sua caminhada ou corrida de hoje.", quantity_label: "Quilômetros", xp_per_unit: 25, max_quantity: 20, xp_reward: 25 },
  { ...challengeBase, category: "alimentacao", id: "20000000-0000-4000-8000-000000000006", title: "Prepare uma refeição colorida", description: "Experimente uma receita com ingredientes frescos e mostre o resultado.", xp_reward: 120 },
];

export const previewSettings = {
  group_penalty_text: "Quem não atingir a meta da semana escolhe o próximo desafio do grupo.",
  group_penalty_active: false,
};

export function getPreviewData() {
  const today = appDateStr();
  const weekStart = appWeekStartStr();
  const users = previewUsers.filter((u) => u.status === "active");
  const statuses = ["approved", "pending", "contested", "approved", "rejected", "failed"] as const;
  const submissions = statuses.map((status, i) => {
    const user = users[i % users.length];
    const challenge = previewChallenges[i % previewChallenges.length];
    return {
      id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      challenge_id: challenge.id, user_id: user.id,
      photo_url: null, photo_url_2: null,
      title: ["O primeiro passo do dia", "Mais um capítulo concluído", "Treino da semana", "Mantendo a sequência", "Um pouco mais longe", "Hoje não consegui"][i],
      description: "Registro de demonstração para explorar os estados da interface e planejar a próxima versão.",
      status, xp_awarded: status === "approved" ? challenge.xp_reward : 0,
      quantity: null, submitted_date: today,
      created_at: `${today}T${String(18 - i).padStart(2, "0")}:00:00Z`,
      user, challenge,
      reactions: users.slice(0, i % 3 + 1).map((reactor) => ({
        type: "positive" as const, user_id: reactor.id, user: reactor,
      })),
    };
  });
  const scheduled = [{
    ...challengeBase, id: "20000000-0000-4000-8000-000000000007",
    title: "Fim de semana ao ar livre", description: "Explore um parque ou um novo caminho com o grupo.",
    starts_at: datePlusDays(today, 2), ends_at: datePlusDays(today, 4), xp_reward: 200,
  }];
  return {
    today, weekStart, weekEnd: datePlusDays(weekStart, 6),
    yesterday: datePlusDays(today, -1), users, submissions, scheduled,
    excuses: [{ id: "preview-excuse", user_id: users[2].id, excuse_date: today, reason: "Recuperação do treino" }],
  };
}

export function toPreviewCard(s: ReturnType<typeof getPreviewData>["submissions"][number]): SubmissionCardData {
  return {
    ...s,
    reactions: { positive: s.reactions.length, negative: s.status === "contested" ? 2 : 0 },
    reactionUsers: s.reactions.map((r) => ({ ...r.user, user_id: r.user_id, type: r.type })),
    userReaction: s.reactions.some((r) => r.user_id === previewUser.id) ? "positive" : null,
    currentUserId: previewUser.id,
  };
}

export function getPreviewDashboard() {
  return {
    user: { id: previewUser.id }, profile: previewUser,
    artTier: 2, levelXP: 250, levelGap: 400,
    groupPenaltyActive: previewSettings.group_penalty_active,
    groupPenaltyText: previewSettings.group_penalty_text,
    currentPenalty: previewUser.current_penalty,
    openChallenges: previewChallenges,
  };
}

export function getPreviewChallenge(id: string) {
  const challenge = previewChallenges.find((c) => c.id === id) ?? getPreviewData().scheduled.find((c) => c.id === id);
  if (!challenge) return null;
  return {
    challenge, user: { id: previewUser.id },
    initialSubmissions: getPreviewData().submissions.filter((s) => s.challenge_id === id).map(toPreviewCard),
  };
}
