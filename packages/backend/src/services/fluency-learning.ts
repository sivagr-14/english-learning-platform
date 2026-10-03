import { z } from "zod";

export const SKILLS = [
  "recognition",
  "recall",
  "listening",
  "speaking",
  "writing",
] as const;
export const SkillSchema = z.enum(SKILLS);
export const ProfileSchema = z
  .object({
    timezone: z
      .string()
      .max(100)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value }).format();
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid IANA timezone"),
    daily_minutes: z.number().int().min(5).max(120),
    new_per_day: z.number().int().min(0).max(30),
    focus: z.enum(["balanced", "professional", "conversation", "linking"]),
  })
  .strict();

export const AttemptSchema = z
  .object({
    id: z.string().uuid(),
    word_id: z.string().uuid(),
    skill: SkillSchema,
    successful: z.boolean(),
    answer: z.string().trim().min(1).max(6000),
    reflection: z.string().trim().max(2000).default(""),
    context: z.enum(["lesson", "work", "daily_life", "new_situation"]),
    phase: z.enum(["diagnostic", "practice"]).default("practice"),
  })
  .strict();

export interface SkillState {
  successfulDays: string[];
  contexts: string[];
  attempts: number;
  latestSuccessful: boolean;
  stage: "learning" | "recognised" | "recallable" | "usable" | "retained";
  intervalDays: number;
}

export function localDay(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// This records self-assessed evidence, never machine-certified language ability.
export function advanceSkill(
  previous: SkillState | undefined,
  successful: boolean,
  skill: string,
  context: string,
  now: Date,
  timezone: string,
) {
  const day = localDay(now, timezone);
  const days = successful
    ? [...new Set([...(previous?.successfulDays || []), day])].sort().slice(-90)
    : [];
  const contexts = successful
    ? [...new Set([...(previous?.contexts || []), context])]
    : [];
  const elapsed = days.length
    ? (Date.parse(days[days.length - 1]) - Date.parse(days[0])) / 86400000
    : 0;
  const production = skill === "speaking" || skill === "writing";
  let stage: SkillState["stage"] = "learning";
  if (successful) stage = "recognised";
  if (days.length >= 2 && elapsed >= 1) stage = "recallable";
  if (production && days.length >= 3 && elapsed >= 3 && contexts.length >= 2)
    stage = "usable";
  if (
    days.length >= 4 &&
    elapsed >= 14 &&
    (!production || contexts.length >= 2)
  )
    stage = "retained";
  // Repeated clicks on the same day must not multiply review intervals.
  const newlySuccessfulDay =
    successful && !previous?.successfulDays.includes(day);
  const intervalDays = !successful
    ? 0
    : newlySuccessfulDay
      ? Math.min(60, Math.max(1, (previous?.intervalDays || 0) * 2))
      : previous?.intervalDays || 1;
  const state: SkillState = {
    successfulDays: days,
    contexts,
    attempts: (previous?.attempts || 0) + 1,
    latestSuccessful: successful,
    stage,
    intervalDays,
  };
  return {
    state,
    due_at: new Date(
      now.getTime() + (successful ? intervalDays * 86400000 : 10 * 60000),
    ),
  };
}

export const FOCUS_DOMAINS: Record<string, string[]> = {
  balanced: [],
  professional: ["professional_communication", "work", "linking_ideas"],
  conversation: [
    "conversational_nuance",
    "communication",
    "everyday_life",
    "relationships",
  ],
  linking: ["linking_ideas"],
};
