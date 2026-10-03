import { Router } from "express";
import { z } from "zod";
import { database } from "../utils/db";
import {
  AuthenticatedRequest,
  authMiddleware,
} from "../middleware/auth.middleware";
import { AppError } from "../middleware/error.middleware";
import {
  createCollectionPlan,
  packDeliveryState,
} from "../services/collection-plan";
import { contentPackHash } from "../services/content-pack-contract";

const router = Router();
router.use(authMiddleware);
const wrap = (fn: any) => (req: AuthenticatedRequest, res: any, next: any) =>
  Promise.resolve(fn(req, res)).catch(next);
const record = (value: any) =>
  typeof value === "string" ? JSON.parse(value) : value;
const planInput = z
  .object({
    collectionId: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,119}$/),
    packs: z
      .array(
        z
          .object({
            units: z
              .array(
                z.object({ manifestId: z.string().max(120) }).passthrough(),
              )
              .min(1)
              .max(400),
          })
          .passthrough(),
      )
      .min(1)
      .max(500),
  })
  .passthrough();

router.post(
  "/",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const input = planInput.parse(req.body);
    const ids = [
      ...new Set(input.packs.flatMap((p) => p.units.map((u) => u.manifestId))),
    ];
    const rows = await database("content_pack_manifests")
      .where("owner_user_id", req.userId)
      .whereIn("id", ids)
      .select("id", "payload");
    if (rows.length !== ids.length)
      throw new AppError(
        409,
        "Synchronize all planned manifests to this account before registering the collection",
      );
    const expected = createCollectionPlan(
      input.collectionId,
      ids.map((id) => record(rows.find((r: any) => r.id === id)?.payload)),
    );
    if (contentPackHash(expected) !== contentPackHash(input))
      throw new AppError(
        422,
        "Collection index differs from its accepted immutable manifests",
      );
    await database.transaction(async (trx) => {
      await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
        `collection:${req.userId}:${input.collectionId}`,
      ]);
      const previous = await trx("fluency_collections")
        .where({ user_id: req.userId, collection_id: input.collectionId })
        .first();
      if (previous && previous.content_hash !== expected.hash)
        throw new AppError(409, "Immutable collection identity conflict");
      if (!previous)
        await trx("fluency_collections").insert({
          user_id: req.userId,
          collection_id: input.collectionId,
          content_hash: expected.hash,
          payload: expected,
        });
    });
    res.json({
      registered: true,
      collectionId: input.collectionId,
      visiblePacks: expected.packs.length,
    });
  }),
);

router.post(
  "/:collectionId/reviews",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const input = z
      .object({
        manifestId: z.string().max(120),
        manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
        batchNumber: z.number().int().positive(),
        reviewer: z.string().trim().min(3).max(200),
        candidates: z
          .array(
            z
              .object({
                candidateId: z.string().max(140),
                frequencyEvidence: z.string().trim().min(20).max(4000),
                languageTeachingReview: z.string().trim().min(20).max(4000),
              })
              .strict(),
          )
          .min(1)
          .max(100),
      })
      .strict()
      .parse(req.body);
    const collection = await database("fluency_collections")
      .where({ user_id: req.userId, collection_id: req.params.collectionId })
      .first();
    if (!collection) throw new AppError(404, "Collection not found");
    const unit = record(collection.payload)
      .packs.flatMap((p: any) => p.units)
      .find(
        (u: any) =>
          u.manifestId === input.manifestId &&
          u.manifestHash === input.manifestHash &&
          u.batchNumber === input.batchNumber,
      );
    if (
      !unit ||
      JSON.stringify([...unit.candidateIds].sort()) !==
        JSON.stringify(input.candidates.map((c) => c.candidateId).sort())
    )
      throw new AppError(
        422,
        "Reviews must cover exactly every candidate in the frozen unit",
      );
    await database.transaction(async (trx) => {
      const key = {
        user_id: req.userId,
        collection_id: req.params.collectionId,
        manifest_id: input.manifestId,
        batch_number: input.batchNumber,
      };
      await trx.raw("SELECT pg_advisory_xact_lock(hashtext(?))", [
        `collection-review:${req.userId}:${req.params.collectionId}`,
      ]);
      const previous = await trx("fluency_collection_reviews")
        .where(key)
        .first();
      if (previous && previous.content_hash !== contentPackHash(input))
        throw new AppError(409, "Immutable review receipt conflict");
      if (!previous)
        await trx("fluency_collection_reviews").insert({
          ...key,
          manifest_hash: input.manifestHash,
          content_hash: contentPackHash(input),
          payload: input,
        });
    });
    res.json({
      recorded: true,
      note: "Editorial review attestation recorded; it is not machine-certified frequency or naturalness.",
    });
  }),
);

router.get(
  "/",
  wrap(async (req: AuthenticatedRequest, res: any) => {
    const rows = await database("fluency_collections")
      .where("user_id", req.userId)
      .orderBy("created_at", "desc")
      .limit(100);
    const collections = [];
    for (const row of rows) {
      const plan = record(row.payload);
      const ids = [
        ...new Set<string>(
          plan.packs.flatMap((p: any) => p.units.map((u: any) => u.manifestId)),
        ),
      ];
      const batches = await database("content_pack_batches as b")
        .join("content_pack_manifests as m", "b.manifest_id", "m.id")
        .where("m.owner_user_id", req.userId)
        .whereIn("m.id", ids)
        .select("b.*", "m.verification_report");
      const reviews = await database("fluency_collection_reviews").where({
        user_id: req.userId,
        collection_id: row.collection_id,
      });
      const receipts = batches.map((b: any) => ({
        manifestId: b.manifest_id,
        manifestHash: b.manifest_hash,
        batchNumber: b.batch_number,
        committedCount: Number(b.committed_count),
        databaseVerified:
          b.status === "committed" &&
          record(b.verification_report)?.verified === true,
        languageReviewed: reviews.some(
          (r: any) =>
            r.manifest_id === b.manifest_id &&
            r.manifest_hash === b.manifest_hash &&
            r.batch_number === b.batch_number,
        ),
        selectionReviewed: reviews.some(
          (r: any) =>
            r.manifest_id === b.manifest_id &&
            r.manifest_hash === b.manifest_hash &&
            r.batch_number === b.batch_number,
        ),
      }));
      collections.push({
        collectionId: row.collection_id,
        entryCount: plan.entryCount,
        packs: plan.packs.map((p: any) => ({
          packId: p.packId,
          entryCount: p.entryCount,
          ...packDeliveryState(p, receipts),
        })),
      });
    }
    res.set("Cache-Control", "no-store").json({ collections });
  }),
);
export default router;
