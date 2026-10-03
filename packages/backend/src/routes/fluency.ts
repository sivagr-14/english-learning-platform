import { Router } from "express";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import { database } from "../utils/db";
import {
  advanceSkill,
  AttemptSchema,
  FOCUS_DOMAINS,
  ProfileSchema,
  SkillSchema,
} from "../services/fluency-learning";
import { vocabularyLessonQualityIssues } from "../data/vocabulary-lesson-template";
import { displayVocabularyLabel } from "../services/vocabulary-sense.service";
import {
  TAXONOMY_SPECIFIC_CATEGORIES,
  TAXONOMY_VERSION,
} from "../data/vocabulary-taxonomy";

import { buildPortableTopicRequest } from "../services/topic-request.service";
import { COLLECTION_POLICY } from "../services/collection-plan";
import { createHash } from "crypto";

const router = Router();
router.use(authMiddleware);
router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
const defaults = {
  timezone: "Europe/Warsaw",
  daily_minutes: 20,
  new_per_day: 10,
  focus: "balanced",
};
const ownWords = (db: any, userId: string) =>
  db("vocabulary_words as w").where((q: any) =>
    q.where("w.owner_user_id", userId).orWhereNull("w.owner_user_id"),
  );
const wrap = (fn: any) => (req: AuthenticatedRequest, res: any, next: any) =>
  Promise.resolve(fn(req, res)).catch(next);

router.get(
  "/profile",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    res.json({
      profile:
        (await database("fluency_profiles")
          .where({ user_id: req.userId })
          .first()) || defaults,
    });
  }),
);
router.put(
  "/profile",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const input = ProfileSchema.parse(req.body);
    const [profile] = await database("fluency_profiles")
      .insert({ user_id: req.userId, ...input })
      .onConflict("user_id")
      .merge({ ...input, updated_at: new Date() })
      .returning("*");
    res.json({ profile });
  }),
);

router.get(
  "/practice",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const query = z
      .object({
        skill: SkillSchema.default("recall"),
        limit: z.coerce.number().int().min(1).max(30).default(10),
        focus: z
          .enum(["balanced", "professional", "conversation", "linking"])
          .default("balanced"),
        mode: z.enum(["due", "diagnostic", "mistakes"]).default("due"),
        wordId: z.string().uuid().optional(),
        categoryKey: z.string().max(240).optional(),
        q: z.string().trim().max(100).optional(),
        cefr: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
        register: z
          .enum(["informal", "neutral", "professional", "formal", "academic"])
          .optional(),
        tag: z.string().max(50).optional(),
      })
      .parse(req.query);
    const profile =
      (await database("fluency_profiles")
        .where({ user_id: req.userId })
        .first()) || defaults;
    const base = ownWords(database, req.userId!)
      .join("vocabulary_lessons as l", "l.word_id", "w.id")
      .leftJoin("fluency_skill_progress as s", function (this: any) {
        this.on("s.word_id", "=", "w.id")
          .andOn("s.user_id", "=", database.raw("?", [req.userId!]))
          .andOn("s.skill", "=", database.raw("?", [query.skill]));
      })
      .leftJoin("fluency_notes as n", function (this: any) {
        this.on("n.word_id", "=", "w.id").andOn(
          "n.user_id",
          "=",
          database.raw("?", [req.userId!]),
        );
      })
      .whereRaw("l.lesson_data->>'format_version' = 'simplified-v2'");
    if (query.wordId) base.where("w.id", query.wordId);
    else {
      if (query.mode === "due")
        base.where((q: any) =>
          q.whereNull("s.due_at").orWhere("s.due_at", "<=", new Date()),
        );
      if (query.mode === "mistakes")
        base.whereRaw("s.state->>'latestSuccessful' = 'false'");
      if (query.mode === "diagnostic") base.whereNull("s.word_id");
    }
    if (query.skill === "speaking" || query.skill === "writing")
      base.whereRaw("COALESCE(n.learning_intent, 'active') = 'active'");
    if (query.categoryKey)
      base.where("w.taxonomy_category_key", query.categoryKey);
    if (query.cefr) base.where("w.cefr_level", query.cefr);
    if (query.register)
      base.whereRaw(
        "l.lesson_data #>> '{overview,meaning_usage_profile,register}' ILIKE ?",
        [`%${query.register}%`],
      );
    if (query.tag) base.whereRaw("? = ANY(n.tags)", [query.tag]);
    if (query.q)
      base.where((q: any) =>
        q
          .whereILike("w.word", `%${query.q}%`)
          .orWhereILike("w.english_meaning", `%${query.q}%`),
      );
    const domains = FOCUS_DOMAINS[query.focus];
    if (domains.length)
      base.whereIn(
        database.raw("split_part(w.taxonomy_category_key, '.', 1)"),
        domains,
      );
    const rows = await base
      .select(
        "w.id",
        "w.word",
        "w.sense_rank",
        "w.english_meaning",
        "w.tamil_meaning",
        "w.core_idea",
        "w.cefr_level",
        "w.taxonomy_category_key",
        "l.lesson_data",
        "s.state",
        "s.due_at",
        "n.personal_example",
        "n.correction_request",
        "n.tags",
        "n.learning_intent",
      )
      .orderByRaw("CASE WHEN s.word_id IS NULL THEN 1 ELSE 0 END")
      .orderBy("s.due_at")
      .orderByRaw("md5(w.id::text || current_date::text)")
      .limit(query.limit);
    // Share the introduction budget with flashcards and serialize concurrent tabs.
    const cards =
      query.wordId || query.mode !== "due"
        ? rows
        : await database.transaction(async (trx) => {
            await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
              `flashcards:${req.userId}`,
            ]);
            const today = await trx("user_progress")
              .where("user_id", req.userId)
              .whereRaw(
                "date(timezone(?, introduced_at)) = date(timezone(?, now()))",
                [profile.timezone, profile.timezone],
              )
              .count({ count: "*" })
              .first();
            let allowance = Math.max(
              0,
              profile.new_per_day - Number(today?.count || 0),
            );
            const introduced = new Set(
              (
                await trx("user_progress")
                  .where("user_id", req.userId)
                  .whereIn(
                    "word_id",
                    rows.map((w: any) => w.id),
                  )
                  .whereNotNull("introduced_at")
                  .select("word_id")
              ).map((p: any) => p.word_id),
            );
            const accepted = rows.filter(
              (w: any) => introduced.has(w.id) || allowance-- > 0,
            );
            const newIds = accepted
              .filter((w: any) => !introduced.has(w.id))
              .map((w: any) => w.id);
            if (newIds.length) {
              const words = await trx("vocabulary_words")
                .whereIn("id", newIds)
                .select("id", "category_id");
              const now = new Date();
              await trx("user_progress")
                .insert(
                  words.map((w: any) => ({
                    user_id: req.userId,
                    word_id: w.id,
                    category_id: w.category_id,
                    introduced_at: now,
                    next_review_at: now,
                  })),
                )
                .onConflict(["user_id", "word_id"])
                .merge(["introduced_at", "next_review_at"]);
              // Existing import-created queues must match the new introduction date.
              await trx("flashcard_queue")
                .where("user_id", req.userId)
                .whereIn("word_id", newIds)
                .update({ due_at: now, updated_at: now });
            }
            return accepted;
          });
    res.json({
      cards: cards.map((w: any) => ({
        ...w,
        display_label: displayVocabularyLabel(w.word, w.sense_rank),
      })),
      assessment: "self-reported",
      profile,
    });
  }),
);

router.post(
  "/attempts",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const input = AttemptSchema.parse(req.body);
    const result = await database.transaction(async (trx) => {
      await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
        `fluency:${req.userId}`,
      ]);
      if (
        !(await ownWords(trx, req.userId!).where("w.id", input.word_id).first())
      )
        throw new AppError(404, "Entry not found");
      const existing = await trx("fluency_attempts")
        .where({ user_id: req.userId, id: input.id })
        .first();
      if (existing) {
        if (
          Object.entries(input).some(([key, value]) => existing[key] !== value)
        )
          throw new AppError(
            409,
            "Attempt identity already belongs to a different response",
          );
        return { replayed: true };
      }
      const profile =
        (await trx("fluency_profiles")
          .where({ user_id: req.userId })
          .first()) || defaults;
      const key = {
        user_id: req.userId!,
        word_id: input.word_id,
        skill: input.skill,
      };
      const previous = await trx("fluency_skill_progress").where(key).first();
      const next = advanceSkill(
        previous?.state,
        input.successful,
        input.skill,
        input.context,
        new Date(),
        profile.timezone,
      );
      await trx("fluency_attempts").insert({ ...input, user_id: req.userId });
      await trx("fluency_skill_progress")
        .insert({ ...key, ...next })
        .onConflict(["user_id", "word_id", "skill"])
        .merge({ ...next, updated_at: new Date() });
      return { ...next, assessment: "self-reported" };
    });
    res.json(result);
  }),
);

router.put(
  "/notes/:wordId",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const wordId = z.string().uuid().parse(req.params.wordId);
    const input = z
      .object({
        personal_example: z.string().trim().max(6000),
        correction_request: z.string().trim().max(2000),
        tags: z.array(z.string().trim().min(1).max(50)).max(12),
        learning_intent: z.enum(["active", "recognition"]),
      })
      .strict()
      .parse(req.body);
    if (!(await ownWords(database, req.userId!).where("w.id", wordId).first()))
      throw new AppError(404, "Entry not found");
    await database("fluency_notes")
      .insert({ user_id: req.userId, word_id: wordId, ...input })
      .onConflict(["user_id", "word_id"])
      .merge({ ...input, updated_at: new Date() });
    res.json({ saved: true });
  }),
);

router.get(
  "/summary",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const skills = await database("fluency_skill_progress")
      .where("user_id", req.userId)
      .select("skill")
      .select(database.raw("state->>'stage' as stage"))
      .count({ count: "*" })
      .groupBy("skill", database.raw("state->>'stage'"));
    const attempts = await database("fluency_attempts as a")
      .join("vocabulary_words as w", "w.id", "a.word_id")
      .where("a.user_id", req.userId)
      .select("a.*", "w.word", "w.sense_rank", "w.english_meaning")
      .orderBy("a.created_at", "desc")
      .limit(30);
    res.json({ skills, attempts, assessment: "self-reported" });
  }),
);

router.get(
  "/coverage",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const counts = await ownWords(database, req.userId!)
      .leftJoin("vocabulary_lessons as l", "w.id", "l.word_id")
      .select("w.taxonomy_category_key", "w.cefr_level")
      .count({ entries: "w.id" })
      .select(
        database.raw(
          "COUNT(l.word_id) FILTER (WHERE l.lesson_data->>'format_version' = 'simplified-v2') AS current_format",
        ),
      )
      .groupBy("w.taxonomy_category_key", "w.cefr_level");
    const categories = TAXONOMY_SPECIFIC_CATEGORIES.map((c) => {
      const rows = counts.filter((r: any) => r.taxonomy_category_key === c.key);
      return {
        key: c.key,
        name: c.name,
        domain: c.domainKey,
        entries: rows.reduce((n: number, r: any) => n + Number(r.entries), 0),
        currentFormat: rows.reduce(
          (n: number, r: any) => n + Number(r.current_format),
          0,
        ),
        levels: Object.fromEntries(
          rows.map((r: any) => [
            r.cefr_level || "unassigned",
            Number(r.entries),
          ]),
        ),
      };
    });
    const [total] = await ownWords(database, req.userId!).count({
      count: "w.id",
    });
    res.json({
      taxonomyVersion: TAXONOMY_VERSION,
      target: 40000,
      packSize: 400,
      planningPacks: 100,
      totalEntries: Number(total.count),
      categories,
      notice:
        "Current-format counts are not a language-quality audit. Run the audit before counting entries towards the validated target.",
    });
  }),
);

// Explicit, bounded-page audit. The client advances its cursor; ordinary page
// loading never parses all 40,000 lesson documents.
router.get(
  "/audit",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const { after } = z
      .object({ after: z.string().uuid().optional() })
      .parse(req.query);
    const q = ownWords(database, req.userId!)
      .leftJoin("vocabulary_lessons as l", "w.id", "l.word_id")
      .select(
        "w.id",
        "w.word",
        "w.sense_key",
        "w.english_meaning",
        "l.lesson_data",
      )
      .orderBy("w.id")
      .limit(100);
    if (after) q.where("w.id", ">", after);
    const rows = await q;
    const items = rows.map((w: any) => {
      const issues = vocabularyLessonQualityIssues(w.lesson_data, w.word, {
        trustedSourceSentence:
          w.lesson_data?.meaning_in_context?.source_sentence,
      });
      if (
        w.lesson_data?.meaning_in_context?.contextual_meaning !==
        w.english_meaning
      )
        issues.push("Meaning differs from lesson");
      if (!w.sense_key)
        issues.push("Contextual sense identity requires review");
      return { id: w.id, word: w.word, passed: !issues.length, issues };
    });
    res.json({
      items,
      next: rows.length === 100 ? rows[rows.length - 1].id : null,
      auditType: "automated-contract",
      notice:
        "Source provenance, semantic duplicates, frequency and naturalness require separate review.",
    });
  }),
);

router.post(
  "/collection-request",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const topicRequest = await buildPortableTopicRequest(
      database,
      req.userId!,
      {
        topic:
          "Everyday English and professional communication across the complete learning catalogue",
        intendedContext:
          "Natural speech and useful writing across all categories. Professional focus: trade-offs, strategy, principles, setbacks, expectations, respectful disagreement, explanations and official communication. Exclude rare senses and expert-only technical glossary items. Counts must emerge from assessment; do not pad to 40,000.",
      },
    );
    const payload = {
      formatVersion: "chatgpt-fluency-collection-request-v1",
      policy: COLLECTION_POLICY,
      topicRequest,
      instructions:
        "Audit existing entries separately. Decompose coverage across every catalogue category and communication function; resolve overlap by term plus sense. Use the nested topic request and existing topic manifest/batch contracts. Do not manufacture source evidence. Freeze complete topic manifests before lessons. Group accepted immutable units into visible packs with collection:plan. Language and teaching review are required separately from structural validation.",
    };
    const requestHash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    res.json({
      ...payload,
      requestId: `fluency-${requestHash.slice(0, 24)}`,
      requestHash,
    });
  }),
);

export default router;
