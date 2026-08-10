import { randomUUID } from "crypto";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { buildPortableAssessmentRequest, CreateSourceRequestSchema } from "./source-request.service";

export type SourceRequestJobStatus = "queued" | "processing" | "completed" | "failed";

export interface SourceRequestJob {
  id: string;
  ownerUserId: string;
  sourceName: string;
  status: SourceRequestJobStatus;
  stage: "queued" | "inventory" | "database_matching" | "finalizing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  input?: unknown;
  request?: Awaited<ReturnType<typeof buildPortableAssessmentRequest>>;
  error?: string;
}

type RequestBuilder = typeof buildPortableAssessmentRequest;

export class SourceRequestJobService {
  private readonly running = new Set<string>();

  constructor(
    private readonly database: any,
    private readonly directory =
      process.env.SOURCE_REQUEST_JOB_DIR ||
      path.resolve(process.cwd(), ".runtime", "source-request-jobs"),
    private readonly builder: RequestBuilder = buildPortableAssessmentRequest,
  ) {}

  async create(ownerUserId: string, rawInput: unknown): Promise<SourceRequestJob> {
    const input = CreateSourceRequestSchema.parse(rawInput);
    const now = new Date().toISOString();
    const job: SourceRequestJob = {
      id: randomUUID(),
      ownerUserId,
      sourceName: input.sourceName,
      status: "queued",
      stage: "queued",
      createdAt: now,
      updatedAt: now,
      input,
    };
    await this.save(job);
    this.start(job.id);
    return this.publicJob(job);
  }

  async get(ownerUserId: string, id: string): Promise<SourceRequestJob | null> {
    const job = await this.read(id);
    if (!job || job.ownerUserId !== ownerUserId) return null;
    if (job.status === "queued" || job.status === "processing") this.start(job.id);
    return this.publicJob(job);
  }

  private start(id: string) {
    if (this.running.has(id)) return;
    this.running.add(id);
    setImmediate(() => {
      void this.process(id).finally(() => this.running.delete(id));
    });
  }

  private async process(id: string) {
    const job = await this.read(id);
    if (!job || job.status === "completed" || job.status === "failed" || !job.input)
      return;
    try {
      await this.save({
        ...job,
        status: "processing",
        stage: "inventory",
        updatedAt: new Date().toISOString(),
      });
      const request = await this.builder(this.database, job.ownerUserId, job.input);
      await this.save({
        ...job,
        status: "completed",
        stage: "completed",
        updatedAt: new Date().toISOString(),
        input: undefined,
        request,
      });
    } catch (error) {
      await this.save({
        ...job,
        status: "failed",
        stage: "failed",
        updatedAt: new Date().toISOString(),
        input: undefined,
        error: error instanceof Error ? error.message : "Source preparation failed.",
      });
    }
  }

  private publicJob(job: SourceRequestJob): SourceRequestJob {
    const { input: _input, ...safe } = job;
    return safe;
  }

  private file(id: string) {
    return path.join(this.directory, `${id}.json`);
  }

  private async read(id: string): Promise<SourceRequestJob | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    try {
      return JSON.parse(await readFile(this.file(id), "utf8")) as SourceRequestJob;
    } catch (error: any) {
      if (error?.code === "ENOENT") return null;
      throw error;
    }
  }

  private async save(job: SourceRequestJob) {
    await mkdir(this.directory, { recursive: true });
    const destination = this.file(job.id);
    const temporary = `${destination}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(job), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, destination);
  }
}
