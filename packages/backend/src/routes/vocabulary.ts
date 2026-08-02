import express, { Router, Response, NextFunction } from "express";
import { z } from "zod";
import {
  authMiddleware,
  AuthenticatedRequest,
} from "../middleware/auth.middleware";
import {
  buildNavigation,
  cefrRange,
  normalizeCefrLevel,
} from "../services/vocabulary-browse.service";
import { database } from "../utils/db";
import {
  loadStarterSamples,
  removeStarterSamples,
  starterSampleStatus,
} from "../services/starter-samples.service";
import {
  addWordsToUserCategory,
  createUserCategory,
  ensureFavoriteCategory,
  listUserCategories,
} from "../services/user-category.service";
import {
  displayVocabularyLabel,
  parseVocabularyDisplayLabel,
} from "../services/vocabulary-sense.service";

const router: Router = express.Router();
const DEFAULT_PAGE_SIZE = 50;

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const searchSchema = paginationSchema.extend({
  q: z.string().trim().min(1).max(100),
});

const detailContextSchema = z.object({
  from: z.enum(["category", "search"]).optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const categoryListSchema = z.object({
  includeEmpty: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const createUserCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});

const addWordsToCategorySchema = z
  .object({
    wordIds: z.array(z.string().uuid()).min(1).max(100),
    categoryId: z.string().uuid().optional(),
    newCategoryName: z.string().trim().min(1).max(100).optional(),
  })
  .refine((input) => !(input.categoryId && input.newCategoryName), {
    message: "Choose an existing category or create a new one, not both.",
    path: ["categoryId"],
  });

router.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

function applyOwnership(query: any, userId?: string) {
  return query.where((builder: any) => {
    if (userId) {
      builder.where("vw.owner_user_id", userId).orWhereNull("vw.owner_user_id");
      return;
    }
    builder.whereNull("vw.owner_user_id");
  });
}

function applyCategory(query: any, categoryId: string) {
  return query.whereRaw("COALESCE(vec.category_id, vw.category_id) = ?", [
    categoryId,
  ]);
}

function applySearch(query: any, queryText: string, userId: string) {
  const parsed = parseVocabularyDisplayLabel(queryText);
  const term = `%${parsed.term}%`;

  query.where((builder: any) => {
    builder
      .whereILike("vw.word", term)
      .orWhereILike("vw.english_meaning", term)
      .orWhereILike("vw.tamil_meaning", term)
      .orWhereILike("vw.core_idea", term)
      .orWhereILike("vc.category_name", term)
      .orWhereILike("vc.track_name", term)
      .orWhereExists((linked: any) => {
        linked
          .select(database.raw("1"))
          .from("vocabulary_entry_categories as search_vec")
          .join(
            "vocabulary_categories as search_vc",
            "search_vec.category_id",
            "search_vc.id",
          )
          .whereRaw("search_vec.word_id = vw.id")
          .andWhere((categoryOwner: any) =>
            categoryOwner
              .where("search_vc.owner_user_id", userId)
              .orWhereNull("search_vc.owner_user_id"),
          )
          .andWhere((categoryMatch: any) =>
            categoryMatch
              .whereILike("search_vc.category_name", term)
              .orWhereILike("search_vc.track_name", term),
          );
      });
  });
  if (parsed.senseRank) query.where("vw.sense_rank", parsed.senseRank);
  return query;
}

function addSearchOrder(query: any, queryText: string) {
  const parsed = parseVocabularyDisplayLabel(queryText);
  return query
    .orderByRaw(
      `CASE
        WHEN LOWER(vw.word) = LOWER(?) THEN 0
        WHEN vw.word ILIKE ? THEN 1
        WHEN vw.word ILIKE ? THEN 2
        ELSE 3
      END`,
      [parsed.term, `${parsed.term}%`, `%${parsed.term}%`],
    )
    .orderByRaw("LOWER(vw.word)")
    .orderBy("vw.sense_rank")
    .orderBy("vw.id");
}

function withDisplayLabel(word: any) {
  return {
    ...word,
    display_label: displayVocabularyLabel(word.word, word.sense_rank),
  };
}

function categoryWordsBase(userId: string, categoryId: string) {
  const query = database("vocabulary_words as vw").leftJoin(
    "vocabulary_entry_categories as vec",
    "vw.id",
    "vec.word_id",
  );
  applyOwnership(query, userId);
  applyCategory(query, categoryId);
  return query;
}

function searchWordsBase(userId: string, queryText: string) {
  const query = database("vocabulary_words as vw").join(
    "vocabulary_categories as vc",
    "vw.category_id",
    "vc.id",
  );
  applyOwnership(query, userId);
  applySearch(query, queryText, userId);
  return query;
}

async function getCategories(userId: string, includeEmpty = false) {
  await ensureFavoriteCategory(database, userId);

  const query = database("vocabulary_categories as vc")
    .leftJoin("vocabulary_entry_categories as vec", "vc.id", "vec.category_id")
    .leftJoin("vocabulary_words as vw", function () {
      this.on("vec.word_id", "=", "vw.id").andOn(function () {
        this.on("vw.owner_user_id", "=", database.raw("?", [userId])).orOnNull(
          "vw.owner_user_id",
        );
      });
    })
    .where("vc.is_active", true)
    .where((builder: any) =>
      builder.where("vc.owner_user_id", userId).orWhereNull("vc.owner_user_id"),
    )
    .select(
      "vc.id",
      "vc.track_number",
      "vc.track_name",
      "vc.category_number",
      "vc.category_name",
      "vc.description",
      "vc.color_code",
      "vc.is_user_category",
      "vc.is_default",
    )
    .select(
      database.raw("ARRAY_AGG(DISTINCT UPPER(vw.cefr_level)) as cefr_levels"),
    )
    .countDistinct({ word_count: "vw.id" })
    .groupBy("vc.id")
    .orderBy([{ column: "vc.track_number" }, { column: "vc.category_number" }]);
  if (!includeEmpty) {
    query.havingRaw("COUNT(DISTINCT vw.id) > 0 OR vc.owner_user_id = ?", [
      userId,
    ]);
  }
  const rows = await query;

  return rows.map((category: any) => ({
    ...category,
    cefr_range: cefrRange(category.cefr_levels),
    cefr_levels: undefined,
  }));
}

router.get(
  ["/", "/categories"],
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { includeEmpty } = categoryListSchema.parse(req.query);
      res.json({
        categories: await getCategories(req.userId as string, includeEmpty),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/user-categories",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json({
        categories: await listUserCategories(database, req.userId as string),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/user-categories",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = createUserCategorySchema.parse(req.body);
      const category = await createUserCategory(
        database,
        req.userId as string,
        input,
      );
      res.status(201).json({ category });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/words/categories",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { wordIds, categoryId, newCategoryName } =
        addWordsToCategorySchema.parse(req.body);
      res.json(
        await addWordsToUserCategory(database, req.userId as string, wordIds, {
          categoryId,
          newCategoryName,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/categories/:id/words",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = DEFAULT_PAGE_SIZE } = paginationSchema.parse(
        req.query,
      );
      const categories = await getCategories(req.userId as string);
      const category = categories.find(
        (item: any) => item.id === req.params.id,
      );

      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      const base = categoryWordsBase(
        req.userId as string,
        String(req.params.id),
      );
      const [{ total }] = await base.clone().countDistinct({ total: "vw.id" });
      const words = await base
        .clone()
        .leftJoin("vocabulary_lessons as vl", "vw.id", "vl.word_id")
        .select(
          "vw.id",
          "vw.category_id",
          "vw.word",
          "vw.sense_rank",
          "vw.sense_gloss",
          "vw.pronunciation",
          "vw.word_type",
          "vw.cefr_level",
          "vw.frequency",
          "vw.english_meaning",
          "vw.tamil_meaning",
          "vw.core_idea",
          "vw.is_starter_sample",
          "vl.lesson_data",
        )
        .orderByRaw("LOWER(vw.word)")
        .orderBy("vw.sense_rank")
        .orderBy("vw.id")
        .limit(limit)
        .offset((page - 1) * limit);

      res.json({
        category,
        words: words.map((word: any) => ({
          ...withDisplayLabel(word),
          cefr_level: normalizeCefrLevel(word.cefr_level),
        })),
        pagination: {
          page,
          limit,
          total: Number(total || 0),
          total_pages: Math.max(1, Math.ceil(Number(total || 0) / limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/import/single",
  authMiddleware,
  async (_req: AuthenticatedRequest, res: Response) => {
    res.status(409).json({
      message:
        "Direct vocabulary creation is disabled. Assess the content in ChatGPT, review the exact counts, and approve it before entries are created.",
    });
  },
);

router.post(
  "/import/json",
  authMiddleware,
  async (_req: AuthenticatedRequest, res: Response) => {
    res.status(409).json({
      message:
        "Direct JSON import is disabled. Content must pass through ChatGPT assessment and approval first.",
    });
  },
);

router.get(
  "/starter-samples",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await starterSampleStatus(req.userId as string));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/starter-samples",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await loadStarterSamples(req.userId as string);
      res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/starter-samples",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.json(await removeStarterSamples(req.userId as string));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/search",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const {
        q,
        page = 1,
        limit = DEFAULT_PAGE_SIZE,
      } = searchSchema.parse(req.query);
      const base = searchWordsBase(req.userId as string, q);
      const [{ total }] = await base
        .clone()
        .clearSelect()
        .countDistinct({ total: "vw.id" });
      const wordsQuery = base
        .clone()
        .select(
          "vw.id",
          "vw.word",
          "vw.sense_rank",
          "vw.sense_gloss",
          "vw.word_type",
          "vw.cefr_level",
          "vw.frequency",
          "vw.english_meaning",
          "vw.tamil_meaning",
          "vw.core_idea",
          "vw.is_starter_sample",
          "vc.track_name",
          "vc.category_name",
        );
      addSearchOrder(wordsQuery, q);
      const words = await wordsQuery.limit(limit).offset((page - 1) * limit);

      res.json({
        query: q,
        words: words.map((word: any) => ({
          ...withDisplayLabel(word),
          cefr_level: normalizeCefrLevel(word.cefr_level),
        })),
        pagination: {
          page,
          limit,
          total: Number(total || 0),
          total_pages: Math.max(1, Math.ceil(Number(total || 0) / limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/words/:id",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const context = detailContextSchema.parse(req.query);
      const word = await database("vocabulary_words as vw")
        .join("vocabulary_categories as vc", "vw.category_id", "vc.id")
        .leftJoin("vocabulary_lessons as vl", "vw.id", "vl.word_id")
        .select(
          "vw.id",
          "vw.category_id",
          "vw.word",
          "vw.sense_rank",
          "vw.sense_gloss",
          "vw.pronunciation",
          "vw.word_type",
          "vw.cefr_level",
          "vw.frequency",
          "vw.english_meaning",
          "vw.tamil_meaning",
          "vw.core_idea",
          "vw.is_starter_sample",
          "vc.track_name",
          "vc.category_name",
          "vc.description as category_description",
          "vl.lesson_data",
        )
        .where("vw.id", req.params.id)
        .where((builder: any) =>
          builder
            .where("vw.owner_user_id", req.userId)
            .orWhereNull("vw.owner_user_id"),
        )
        .first();

      if (!word) {
        return res.status(404).json({ message: "Word not found" });
      }

      let navigation = null;
      if (context.from === "category" && context.categoryId) {
        const rowsQuery = categoryWordsBase(
          req.userId as string,
          context.categoryId,
        )
          .select("vw.id", "vw.word")
          .orderByRaw("LOWER(vw.word)")
          .orderBy("vw.sense_rank")
          .orderBy("vw.id");
        navigation = buildNavigation(await rowsQuery, String(req.params.id));
      } else if (context.from === "search" && context.q) {
        const rowsQuery = searchWordsBase(
          req.userId as string,
          context.q,
        ).select("vw.id", "vw.word");
        addSearchOrder(rowsQuery, context.q);
        navigation = buildNavigation(await rowsQuery, String(req.params.id));
      }

      res.json({
        word: {
          ...withDisplayLabel(word),
          cefr_level: normalizeCefrLevel(word.cefr_level),
        },
        navigation,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/words/:id/lesson",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const lesson = await database("vocabulary_lessons")
        .join(
          "vocabulary_words",
          "vocabulary_lessons.word_id",
          "vocabulary_words.id",
        )
        .where("word_id", req.params.id)
        .where((builder: any) =>
          builder
            .where("vocabulary_words.owner_user_id", req.userId)
            .orWhereNull("vocabulary_words.owner_user_id"),
        )
        .select("vocabulary_lessons.*")
        .first();

      if (!lesson) {
        return res.status(404).json({ message: "Lesson not found" });
      }

      res.json({ lesson: lesson.lesson_data || lesson });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
