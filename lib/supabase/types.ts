// Auto-generated types mirror the Supabase schema.
// For production: run `npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts`

export type UserRole = "user" | "admin";
export type UserStatus = "pending" | "active" | "suspended";
export type ChallengeFrequency = "daily" | "weekly";
export type SubmissionStatus = "pending" | "approved" | "contested" | "rejected";
export type ReactionType = "positive" | "negative";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
          xp: number;
          level: number;
          role: UserRole;
          status: UserStatus;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "created_at" | "xp" | "level" | "role" | "status"> & {
          xp?: number;
          level?: number;
          role?: UserRole;
          status?: UserStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      challenges: {
        Row: {
          id: string;
          title: string;
          description: string;
          xp_reward: number;
          penalty_xp: number;
          requires_photo: boolean;
          frequency: ChallengeFrequency;
          weekly_target: number;
          starts_at: string | null; // YYYY-MM-DD
          ends_at: string | null;   // YYYY-MM-DD
          quantity_label: string | null;
          xp_per_unit: number | null;
          max_quantity: number | null;
          created_by: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["challenges"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["challenges"]["Insert"]>;
      };
      submissions: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string;
          photo_url: string | null;
          status: SubmissionStatus;
          xp_awarded: number;
          quantity: number | null;
          submitted_date: string; // YYYY-MM-DD
          contested_by: string | null;
          contested_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["submissions"]["Row"], "id" | "created_at" | "status" | "xp_awarded"> & {
          id?: string;
          created_at?: string;
          status?: SubmissionStatus;
          xp_awarded?: number;
        };
        Update: Partial<Database["public"]["Tables"]["submissions"]["Insert"]>;
      };
      reactions: {
        Row: {
          id: string;
          submission_id: string;
          user_id: string;
          type: ReactionType;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reactions"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Insert"]>;
      };
      level_config: {
        Row: {
          level: number;
          xp_required: number;
          art_tier: number;
        };
        Insert: Database["public"]["Tables"]["level_config"]["Row"];
        Update: Partial<Database["public"]["Tables"]["level_config"]["Row"]>;
      };
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
  };
}
