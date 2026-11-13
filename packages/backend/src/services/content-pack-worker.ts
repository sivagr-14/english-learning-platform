/** The existing manifest/batch tables are the durable queue. This map only
 * coalesces wake-ups; losing it on restart cannot lose receipts or work. */
export class ContentPackWorker {
  private active = new Map<string, Promise<any>>();
  constructor(private process: (userId: string, resumeOwnedOnly?: boolean) => Promise<any>) {}

  isRunning(userId: string) { return this.active.has(userId); }

  run(userId: string, resumeOwnedOnly = false): Promise<any> {
    const current = this.active.get(userId);
    if (current) return current;
    const promise = Promise.resolve().then(async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          const result = await this.process(userId, resumeOwnedOnly);
          if (attempt < 3 && result.failures?.some((failure: any) => failure.retryable)) continue;
          return result;
        } catch (error) {
          const status = (error as {status?: number}).status;
          if (attempt >= 3 || (status && status < 500)) throw error;
        }
      }
    }).finally(() => this.active.delete(userId));
    this.active.set(userId, promise);
    return promise;
  }

  async recover(database: any) {
    // Only resume accounts that previously authenticated and claimed work.
    // Unowned packs still require an authenticated wake-up.
    const owners = await database('content_pack_manifests')
      .where({inbox_branch: 'chatgpt-content-inbox'}).whereNull('inbox_cleaned_at')
      .whereNotNull('owner_user_id').distinct('owner_user_id');
    return Promise.allSettled(owners.map((row: any) => this.run(row.owner_user_id, true)));
  }
}
