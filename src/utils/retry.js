/**
 * Retry an async function up to `attempts` times with exponential backoff.
 * Suitable for transient network/HTTP failures.
 * Non-retriable errors (logical validation, 4xx auth) should be thrown
 * from inside `fn` and will still propagate after all attempts are exhausted.
 *
 * @param {() => Promise<T>} fn        - Async factory to run each attempt
 * @param {{ attempts?: number, baseDelay?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { attempts = 3, baseDelay = 600 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      // Don't retry on 4xx client errors — they won't resolve on retry
      const status = e?.status ?? e?.message?.match(/HTTP (\d+)/)?.[1];
      if (status && +status >= 400 && +status < 500) throw e;
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, baseDelay * 2 ** i));
      }
    }
  }
  throw lastError;
}
