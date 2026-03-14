/**
 * Unit tests for the withRetry exponential backoff helper.
 *
 * Covers: first-attempt success, retry on transient failure, retry exhaustion,
 * immediate throw on 4xx client errors, backoff timing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../retry';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withRetry', () => {
  it('resolves on first attempt when fn succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const promise = withRetry(fn, { attempts: 3, baseDelay: 100 });
    // No timers needed — first attempt succeeds immediately
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('recovered');

    const promise = withRetry(fn, { attempts: 3, baseDelay: 100 });

    // Advance past first backoff (100ms)
    await vi.advanceTimersByTimeAsync(100);
    // Advance past second backoff (200ms)
    await vi.advanceTimersByTimeAsync(200);

    await expect(promise).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('exhausts all retries and throws the last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    const promise = withRetry(fn, { attempts: 3, baseDelay: 100 });
    // Attach catch handler immediately to prevent unhandled rejection
    const assertion = expect(promise).rejects.toThrow('persistent failure');

    // Advance past first backoff (100ms)
    await vi.advanceTimersByTimeAsync(100);
    // Advance past second backoff (200ms)
    await vi.advanceTimersByTimeAsync(200);

    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 4xx client errors (immediate throw)', async () => {
    const err = new Error('HTTP 401');
    err.status = 401;
    const fn = vi.fn().mockRejectedValue(err);

    const promise = withRetry(fn, { attempts: 3, baseDelay: 100 });

    await expect(promise).rejects.toThrow('HTTP 401');
    // Should NOT have retried — only 1 call
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 4xx detected from error message', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('HTTP 429 rate limited'));

    const promise = withRetry(fn, { attempts: 3, baseDelay: 100 });

    await expect(promise).rejects.toThrow('HTTP 429');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx server errors', async () => {
    const err = new Error('HTTP 500');
    err.status = 500;
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { attempts: 3, baseDelay: 100 });

    await vi.advanceTimersByTimeAsync(100);

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects exponential backoff timing', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const promise = withRetry(fn, { attempts: 3, baseDelay: 200 });

    // After first failure, wait baseDelay * 2^0 = 200ms
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(1); // not yet
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2); // now retried

    // After second failure, wait baseDelay * 2^1 = 400ms
    await vi.advanceTimersByTimeAsync(399);
    expect(fn).toHaveBeenCalledTimes(2); // not yet
    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3); // now retried

    await expect(promise).resolves.toBe('ok');
  });

  it('uses default options when none provided', async () => {
    const fn = vi.fn().mockResolvedValue('default');
    const promise = withRetry(fn);
    await expect(promise).resolves.toBe('default');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
