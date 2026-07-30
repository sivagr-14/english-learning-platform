import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  authMiddleware,
  AuthenticatedRequest,
} from '../middleware/auth.middleware';
import { database } from '../utils/db';
import { VocabularyImportService } from '../services/vocabulary-import.service';

const router: Router = express.Router();

router.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get(
  '/',
  authMiddleware,
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await database('vocabulary_categories')
        .leftJoin(
          'vocabulary_words',
          'vocabulary_categories.id',
          'vocabulary_words.category_id'
        )
        .select(
          'vocabulary_categories.id',
          'vocabulary_categories.track_number',
          'vocabulary_categories.track_name',
          'vocabulary_categories.category_number',
          'vocabulary_categories.category_name',
          'vocabulary_categories.description',
          'vocabulary_categories.difficulty_level',
          'vocabulary_categories.estimated_words_count',
          'vocabulary_categories.color_code'
        )
        .count({ word_count: 'vocabulary_words.id' })
        .groupBy('vocabulary_categories.id')
        .orderBy([{ column: 'track_number' }, { column: 'category_number' }]);

      res.json({ categories });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/categories',
  authMiddleware,
  async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const categories = await database('vocabulary_categories')
        .leftJoin(
          'vocabulary_words',
          'vocabulary_categories.id',
          'vocabulary_words.category_id'
        )
        .select(
          'vocabulary_categories.id',
          'vocabulary_categories.track_number',
          'vocabulary_categories.track_name',
          'vocabulary_categories.category_number',
          'vocabulary_categories.category_name',
          'vocabulary_categories.description',
          'vocabulary_categories.difficulty_level',
          'vocabulary_categories.estimated_words_count',
          'vocabulary_categories.color_code'
        )
        .count({ word_count: 'vocabulary_words.id' })
        .groupBy('vocabulary_categories.id')
        .orderBy([{ column: 'track_number' }, { column: 'category_number' }]);

      res.json({ categories });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/categories/:id/words',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const words = await database('vocabulary_words')
        .leftJoin(
          'vocabulary_lessons',
          'vocabulary_words.id',
          'vocabulary_lessons.word_id'
        )
        .select(
          'vocabulary_words.id',
          'vocabulary_words.category_id',
          'vocabulary_words.word',
          'vocabulary_words.pronunciation',
          'vocabulary_words.word_type',
          'vocabulary_words.cefr_level',
          'vocabulary_words.frequency',
          'vocabulary_words.english_meaning',
          'vocabulary_words.tamil_meaning',
          'vocabulary_words.core_idea',
          'vocabulary_lessons.lesson_data'
        )
        .where('vocabulary_words.category_id', req.params.id)
        .orderBy('vocabulary_words.word');

      res.json({ words });
    } catch (error) {
      next(error);
    }
  }
);

const ImportVocabularySchema = z.object({
  categoryId: z.string().uuid().optional(),
  category: z.string().optional(),
  track: z.string().optional(),
  word: z.string().min(1),
  pronunciation: z.string().optional(),
  word_type: z.string().optional(),
  cefr_level: z.string().optional(),
  frequency: z.string().optional(),
  english_meaning: z.string().min(1),
  tamil_meaning: z.string().optional(),
  core_idea: z.string().optional(),
  memory_trigger: z.string().optional(),
  visual_scene: z.string().optional(),
  memory_sentence: z.string().optional(),
  recall_question: z.string().optional(),
  natural_domains: z.string().optional(),
  when_to_use: z.string().optional(),
  when_not_to_use: z.string().optional(),
  examples: z.string().optional(),
});

router.post(
  '/import/single',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = ImportVocabularySchema.parse(req.body);
      const importer = new VocabularyImportService(database);
      const result = await importer.importSingle(input, req.userId);

      res.status(201).json({
        message: 'Vocabulary imported',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/import/json',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const input = z
        .object({
          jsonText: z.string().min(1),
        })
        .parse(req.body);
      const importer = new VocabularyImportService(database);
      const result = await importer.importJson(input.jsonText, req.userId);

      res.status(201).json({
        message: 'JSON vocabulary import finished',
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/search',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = z
        .object({
          q: z.string().trim().min(1),
          limit: z.coerce.number().int().min(1).max(50).optional(),
        })
        .parse(req.query);
      const term = `%${input.q}%`;

      const words = await database('vocabulary_words')
        .join(
          'vocabulary_categories',
          'vocabulary_words.category_id',
          'vocabulary_categories.id'
        )
        .select(
          'vocabulary_words.id',
          'vocabulary_words.word',
          'vocabulary_words.word_type',
          'vocabulary_words.cefr_level',
          'vocabulary_words.frequency',
          'vocabulary_words.english_meaning',
          'vocabulary_words.tamil_meaning',
          'vocabulary_words.core_idea',
          'vocabulary_categories.track_name',
          'vocabulary_categories.category_name'
        )
        .where((builder) => {
          builder
            .whereILike('vocabulary_words.word', term)
            .orWhereILike('vocabulary_words.english_meaning', term)
            .orWhereILike('vocabulary_words.tamil_meaning', term)
            .orWhereILike('vocabulary_words.core_idea', term)
            .orWhereILike('vocabulary_categories.category_name', term)
            .orWhereILike('vocabulary_categories.track_name', term);
        })
        .orderByRaw(
          `CASE WHEN vocabulary_words.word ILIKE ? THEN 0 ELSE 1 END`,
          [input.q]
        )
        .orderBy('vocabulary_words.word')
        .limit(input.limit || 20);

      res.json({ words });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/words/:id',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const word = await database('vocabulary_words')
        .join(
          'vocabulary_categories',
          'vocabulary_words.category_id',
          'vocabulary_categories.id'
        )
        .leftJoin(
          'vocabulary_lessons',
          'vocabulary_words.id',
          'vocabulary_lessons.word_id'
        )
        .select(
          'vocabulary_words.id',
          'vocabulary_words.category_id',
          'vocabulary_words.word',
          'vocabulary_words.pronunciation',
          'vocabulary_words.word_type',
          'vocabulary_words.cefr_level',
          'vocabulary_words.frequency',
          'vocabulary_words.english_meaning',
          'vocabulary_words.tamil_meaning',
          'vocabulary_words.core_idea',
          'vocabulary_categories.track_name',
          'vocabulary_categories.category_name',
          'vocabulary_categories.description as category_description',
          'vocabulary_lessons.lesson_data'
        )
        .where('vocabulary_words.id', req.params.id)
        .first();

      if (!word) {
        return res.status(404).json({ message: 'Word not found' });
      }

      res.json({ word });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/words/:id/lesson',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lesson = await database('vocabulary_lessons')
        .where('word_id', req.params.id)
        .first();

      if (!lesson) {
        return res.status(404).json({ message: 'Lesson not found' });
      }

      res.json({ lesson: lesson.lesson_data || lesson });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/sample', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const words = await database('vocabulary_words')
      .join(
        'vocabulary_categories',
        'vocabulary_words.category_id',
        'vocabulary_categories.id'
      )
      .select(
        'vocabulary_words.word',
        'vocabulary_words.english_meaning',
        'vocabulary_words.tamil_meaning',
        'vocabulary_categories.category_name'
      )
      .orderBy('vocabulary_words.word')
      .limit(10);

    res.json({ words });
  } catch (error) {
    next(error);
  }
});

export default router;
