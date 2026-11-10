// Presentation metadata for the UI preview; the production schema has no categories yet.
export const challengeCategories = [
  { id: "treinos", label: "Treinos" },
  { id: "alimentacao", label: "Alimentação" },
  { id: "leitura", label: "Leitura" },
  { id: "bem-estar", label: "Bem-estar" },
] as const;

export type ChallengeCategory = typeof challengeCategories[number]["id"];
