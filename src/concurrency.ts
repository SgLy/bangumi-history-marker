export const REQUEST_CONCURRENCY = 4;

export async function mapLimit<T, R>(
  items: readonly T[],
  fn: (item: T, index: number) => Promise<R>,
  limit = REQUEST_CONCURRENCY,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        const item = items[index];
        if (item === undefined) throw new Error(`mapLimit: items[${index}] 缺失`);
        results[index] = await fn(item, index);
      }
    }),
  );
  return results;
}
