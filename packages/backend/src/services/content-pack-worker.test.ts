import { ContentPackWorker } from './content-pack-worker';

describe('durable content-pack wake-ups', () => {
  it('coalesces browser, manual and recovery wake-ups for the same owner', async () => {
    let finish!: (result: any) => void;
    const process = jest.fn(() => new Promise(resolve => {finish = resolve;}));
    const worker = new ContentPackWorker(process);
    const first = worker.run('alice');
    expect(worker.run('alice')).toBe(first);
    expect(worker.isRunning('alice')).toBe(true);
    await Promise.resolve();
    finish({failures: []});
    await first;
    expect(process).toHaveBeenCalledTimes(1);
    expect(worker.isRunning('alice')).toBe(false);
  });
  it('retries transient failures at most three times and does not retry integrity failures', async () => {
    const process = jest.fn().mockResolvedValue({failures: [{retryable: true}]});
    await new ContentPackWorker(process).run('alice');
    expect(process).toHaveBeenCalledTimes(3);
    process.mockClear().mockRejectedValue(Object.assign(new Error('bad owner'), {status: 403}));
    await expect(new ContentPackWorker(process).run('alice')).rejects.toThrow('bad owner');
    expect(process).toHaveBeenCalledTimes(1);
  });
  it('a new worker resumes only persisted owners after restart', async () => {
    const query = {where: jest.fn().mockReturnThis(), whereNull: jest.fn().mockReturnThis(),
      whereNotNull: jest.fn().mockReturnThis(), distinct: jest.fn().mockResolvedValue([{owner_user_id: 'alice'}])};
    const database = jest.fn(() => query);
    const process = jest.fn().mockResolvedValue({failures: []});
    await new ContentPackWorker(process).recover(database);
    expect(query.whereNotNull).toHaveBeenCalledWith('owner_user_id');
    expect(process).toHaveBeenCalledWith('alice', true);
  });
});
