import type { ChallengeCategory } from "./categories";
import { previewChallenges, previewUsers } from "./data";

export type PreviewPost = { id: string; userId: string; category?: ChallengeCategory; username: string; name: string; challenge: string; title: string; text: string; photo?: string; photo2?: string; avatarUrl?: string | null; status: "approved" | "pending" | "contested"; xp: number; likes: number; time: string };

export const previewPosts: PreviewPost[] = [
  { id: "run", userId: previewUsers[0].id, category: previewChallenges[0].category, username: previewUsers[0].username, name: previewUsers[0].full_name ?? previewUsers[0].username, challenge: previewChallenges[0].title, title: "Começando a semana com o pé direito.", text: "30 minutos de corrida e a cabeça já está outra. Quem mais já fez o seu hoje?", photo: "/ui-lab/run.jpg", status: "approved", xp: 100, likes: 3, time: "Há 28 min" },
  { id: "read", userId: previewUsers[1].id, category: previewChallenges[1].category, username: previewUsers[1].username, name: previewUsers[1].full_name ?? previewUsers[1].username, challenge: previewChallenges[1].title, title: "Mais um capítulo, menos uma desculpa.", text: "Deixei o celular de lado e finalmente voltei para aquele livro. Pequenos passos também contam.", photo: "/ui-lab/read.jpg", status: "pending", xp: 80, likes: 2, time: "Há 1 h" },
  { id: "train", userId: previewUsers[2].id, category: previewChallenges[2].category, username: previewUsers[2].username, name: previewUsers[2].full_name ?? previewUsers[2].username, challenge: previewChallenges[2].title, title: "O segundo treino da semana está pago.", text: "Hoje foi no esforço, mas foi. Bora fechar a meta até sexta!", status: "contested", xp: 150, likes: 1, time: "Há 2 h" },
];
