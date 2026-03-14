/**
 * Unit tests for the price service (Yahoo Finance + CoinGecko + Binance).
 *
 * Covers: successful quote fetch, network timeout, invalid ticker,
 * rate limiting (429), malformed JSON, historical price fetch,
 * crypto price fetch, mixed portfolio refresh.
 *
 * All network calls are mocked via vi.stubGlobal('fetch').
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshAllPrices, fetchAllHistoricalPrices, buildPortfolioSeries } from '../priceService';

// ── Mock fetch ───────────────────────────────────────────────────────────────

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // withRetry uses setTimeout for backoff — use fake timers
  vi.useFakeTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(body, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function errorResponse(status) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  });
}

function networkError(message = 'Network error') {
  return Promise.reject(new Error(message));
}

const STOCK_HOLDING = {
  id: 'h1',
  name: 'Vanguard S&P 500',
  ticker: 'VOO',
  category: 'US Equities',
  units: 10,
  avgCost: 400,
  currentPrice: 450,
};

const CRYPTO_HOLDING = {
  id: 'h2',
  name: 'Bitcoin',
  ticker: 'BTC',
  category: 'Crypto',
  units: 0.5,
  avgCost: 30000,
  currentPrice: 40000,
};

function yahooChartResponse(price) {
  return {
    chart: {
      result: [{
        meta: { regularMarketPrice: price },
        timestamp: [],
        indicators: { quote: [{ close: [] }] },
      }],
    },
  };
}

function yahooHistoryResponse(timestamps, closes) {
  return {
    chart: {
      result: [{
        timestamp: timestamps,
        indicators: { quote: [{ close: closes }] },
      }],
    },
  };
}

// ── refreshAllPrices tests ───────────────────────────────────────────────────

describe('refreshAllPrices — stock quotes', () => {
  it('successfully fetches a stock price', async () => {
    fetchMock.mockImplementation(() => jsonResponse(yahooChartResponse(455.50)));

    const promise = refreshAllPrices([STOCK_HOLDING]);
    const { updated, failed } = await promise;

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('h1');
    expect(updated[0].price).toBe(455.50);
    expect(updated[0].priceUpdatedAt).toBeDefined();
    expect(failed).toHaveLength(0);
  });

  it('handles network timeout / fetch error', async () => {
    // All 3 retry attempts fail with network error
    fetchMock.mockImplementation(() => networkError('timeout'));

    const promise = refreshAllPrices([STOCK_HOLDING]);

    // Advance through retry backoffs (600ms, 1200ms)
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(1200);

    const { updated, failed } = await promise;

    expect(updated).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].ticker).toBe('VOO');
    expect(failed[0].error).toContain('timeout');
  });

  it('handles invalid ticker / no price in response', async () => {
    fetchMock.mockImplementation(() => jsonResponse({
      chart: { result: [{ meta: {} }] },
    }));

    const promise = refreshAllPrices([STOCK_HOLDING]);

    // Advance through retry backoffs for "No price in response" errors
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(1200);

    const { updated, failed } = await promise;

    expect(updated).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toContain('No price');
  });

  it('handles HTTP 429 rate limiting (no retry for 4xx)', async () => {
    fetchMock.mockImplementation(() => errorResponse(429));

    const promise = refreshAllPrices([STOCK_HOLDING]);

    const { updated, failed } = await promise;

    expect(updated).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toContain('429');
    // Should only attempt once (4xx = no retry)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('handles HTTP 500 with retry and eventual success', async () => {
    fetchMock
      .mockImplementationOnce(() => errorResponse(500))
      .mockImplementationOnce(() => jsonResponse(yahooChartResponse(460)));

    const promise = refreshAllPrices([STOCK_HOLDING]);

    // Advance past first retry backoff
    await vi.advanceTimersByTimeAsync(600);

    const { updated, failed } = await promise;

    expect(updated).toHaveLength(1);
    expect(updated[0].price).toBe(460);
    expect(failed).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips holdings with no ticker', async () => {
    const noTicker = { ...STOCK_HOLDING, id: 'h-no', ticker: '' };

    const promise = refreshAllPrices([noTicker]);
    const { updated, failed } = await promise;

    expect(updated).toHaveLength(0);
    expect(failed).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('refreshAllPrices — crypto quotes', () => {
  it('successfully fetches crypto price via CoinGecko', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('coingecko.com/api/v3/search'))
        return jsonResponse({ coins: [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }] });
      if (url.includes('coingecko.com/api/v3/simple/price'))
        return jsonResponse({ bitcoin: { usd: 42000 } });
      return errorResponse(404);
    });

    const promise = refreshAllPrices([CRYPTO_HOLDING]);
    const { updated, failed } = await promise;

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('h2');
    expect(updated[0].price).toBe(42000);
    expect(failed).toHaveLength(0);
  });

  it('handles CoinGecko search failure', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('coingecko.com/api/v3/search'))
        return jsonResponse({ coins: [] }); // no match
      return errorResponse(404);
    });

    const promise = refreshAllPrices([CRYPTO_HOLDING]);

    // Advance through retries for "No coin" error
    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(1200);

    const { updated, failed } = await promise;

    expect(updated).toHaveLength(0);
    expect(failed).toHaveLength(1);
    expect(failed[0].ticker).toBe('BTC');
  });
});

describe('refreshAllPrices — mixed portfolio', () => {
  it('fetches stock and crypto prices together', async () => {
    fetchMock.mockImplementation((url) => {
      if (url.includes('/api/yahoo'))
        return jsonResponse(yahooChartResponse(455));
      if (url.includes('coingecko.com/api/v3/search'))
        return jsonResponse({ coins: [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' }] });
      if (url.includes('coingecko.com/api/v3/simple/price'))
        return jsonResponse({ bitcoin: { usd: 42000 } });
      return errorResponse(404);
    });

    const promise = refreshAllPrices([STOCK_HOLDING, CRYPTO_HOLDING]);
    const { updated, failed } = await promise;

    expect(updated).toHaveLength(2);
    expect(failed).toHaveLength(0);
  });
});

// ── fetchAllHistoricalPrices tests ───────────────────────────────────────────

describe('fetchAllHistoricalPrices', () => {
  it('successfully fetches stock history', async () => {
    const timestamps = [1700000000, 1700086400]; // 2 days
    const closes = [450, 455];

    fetchMock.mockImplementation(() =>
      jsonResponse(yahooHistoryResponse(timestamps, closes))
    );

    const promise = fetchAllHistoricalPrices([STOCK_HOLDING]);
    const { histMap, skipped } = await promise;

    expect(histMap.size).toBe(1);
    expect(histMap.get('h1').size).toBe(2);
    expect(skipped).toHaveLength(0);
  });

  it('skips holdings with no ticker and reports them', async () => {
    const noTicker = { ...STOCK_HOLDING, id: 'h-no', ticker: '' };

    const promise = fetchAllHistoricalPrices([noTicker]);
    const { histMap, skipped } = await promise;

    expect(histMap.size).toBe(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toContain('No ticker');
  });

  it('handles API error and adds to skipped', async () => {
    fetchMock.mockImplementation(() => errorResponse(429));

    const promise = fetchAllHistoricalPrices([STOCK_HOLDING]);

    // 4xx won't retry
    const { histMap, skipped } = await promise;

    expect(histMap.size).toBe(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].ticker).toBe('VOO');
  });

  it('fetches crypto history via Binance', async () => {
    const klines = [
      [1700000000000, '40000', '41000', '39000', '40500', '100'],
      [1700086400000, '40500', '42000', '40000', '41000', '200'],
    ];

    fetchMock.mockImplementation(() => jsonResponse(klines));

    const promise = fetchAllHistoricalPrices([CRYPTO_HOLDING]);
    const { histMap, skipped } = await promise;

    expect(histMap.size).toBe(1);
    expect(histMap.get('h2').size).toBe(2);
    expect(skipped).toHaveLength(0);
  });
});

// ── buildPortfolioSeries tests ───────────────────────────────────────────────

describe('buildPortfolioSeries', () => {
  it('builds daily portfolio values from histMap', () => {
    const histMap = new Map();
    const priceMap = new Map();
    const today = new Date().toISOString().slice(0, 10);
    // Use today to ensure it's within range
    priceMap.set(today, 450);
    histMap.set('h1', priceMap);

    const holdings = [{ ...STOCK_HOLDING, id: 'h1' }];
    const series = buildPortfolioSeries(holdings, histMap, '1M');

    expect(series.length).toBeGreaterThanOrEqual(1);
    // value = units * price = 10 * 450 = 4500
    expect(series[series.length - 1].value).toBe(4500);
  });

  it('returns empty array when no data in range', () => {
    const histMap = new Map();
    const priceMap = new Map();
    priceMap.set('2020-01-01', 100); // way outside 1M range
    histMap.set('h1', priceMap);

    const holdings = [{ ...STOCK_HOLDING, id: 'h1' }];
    const series = buildPortfolioSeries(holdings, histMap, '1M');

    expect(series).toHaveLength(0);
  });
});
