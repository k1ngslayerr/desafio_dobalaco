import { z } from "zod";

// [SECURITY] All user input validated server-side with Zod; client validation is UX only

// ── Auth ────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(12, "Senha deve ter no mínimo 12 caracteres"),
});

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(12, "Senha deve ter no mínimo 12 caracteres")
    .regex(/[A-Z]/, "Deve conter ao menos uma letra maiúscula")
    .regex(/[0-9]/, "Deve conter ao menos um número"),
  username: z
    .string()
    .min(3, "Username deve ter no mínimo 3 caracteres")
    .max(30, "Username deve ter no máximo 30 caracteres")
    .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  full_name: z.string().max(100).optional(),
});

// ── Challenges ──────────────────────────────────────────────
export const challengeSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10).max(2000),
  xp_reward: z.number().int().min(1).max(10000),
  penalty_xp: z.number().int().min(0).max(10000).default(0),
  requires_photo: z.boolean().default(true),
  // Frequency: 'daily' = once per day; 'weekly' = N times per week (e.g. exercise = 3)
  frequency: z.enum(["daily", "weekly"]).default("daily"),
  weekly_target: z.number().int().min(1).max(7).default(1),
  // Optional date range — null means "no limit" on that side
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  ends_at:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  quantity_label: z.string().max(50).nullable().optional(),
  xp_per_unit: z.number().int().min(1).max(10000).nullable().optional(),
  max_quantity: z.number().int().min(1).max(1000000).nullable().optional(),
});

// ── Submissions ─────────────────────────────────────────────
export const submissionStatusSchema = z.object({
  status: z.enum(["approved", "contested", "rejected"]),
  contested_by: z.string().uuid().optional(),
});

// ── Reactions ───────────────────────────────────────────────
export const reactionSchema = z.object({
  submission_id: z.string().uuid(),
  type: z.enum(["positive", "negative"]),
});

// ── Profile ─────────────────────────────────────────────────
export const profileSchema = z.object({
  full_name: z.string().max(100).optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/)
    .optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChallengeInput = z.infer<typeof challengeSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
