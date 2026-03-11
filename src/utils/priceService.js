/**
 * Price service — no API keys required.
 * Stocks / ETFs / etc. → Yahoo Finance (via Vite dev proxy)
 * Crypto               → CoinGecko public API
 */
import { withRetry } from './retry';

const CRYPTO_CATEGORIES = new Set(['Crypto']);

// ── Current price ────────────────────────────────────────────────────────────

async function fetchStockPrice(ticker) {
  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1m`;
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const data = await res.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price == null) throw new Error('No price in response');
    return +price;
  });
}

async function fetchCryptoPricesBatch(tickers) {
  const searches = await Promise.allSettled(
    tickers.map(async (ticker) => {
      const { coins } = await withRetry(async () => {
        const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`);
        if (!res.ok) throw new Error(`Search HTTP ${res.status}`);
        return res.json();
      });
      const match = coins?.find(c => c.symbol.toUpperCase() === ticker.toUpperCase()) || coins?.[0];
      if (!match) throw new Error(`No coin for ${ticker}`);
      return { ticker, coinId: match.id };
    })
  );

  const resolved = [];
  const failures = new Map();
  searches.forEach((r, i) => {
    if (r.status === 'fulfilled') resolved.push(r.value);
    else failures.set(tickers[i], r.reason?.message || 'Search failed');
  });

  if (resolved.length === 0) return { prices: new Map(), failures };

  const ids = resolved.map(r => r.coinId).join(',');
  let priceData;
  try {
    priceData = await withRetry(async () => {
      const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (!priceRes.ok) throw new Error(`Price HTTP ${priceRes.status}`);
      return priceRes.json();
    });
  } catch (e) {
    resolved.forEach(r => failures.set(r.ticker, e.message));
    return { prices: new Map(), failures };
  }

  const prices = new Map();
  for (const { ticker, coinId } of resolved) {
    const p = priceData[coinId]?.usd;
    if (p != null) prices.set(ticker, +p);
    else failures.set(ticker, `No USD price for ${coinId}`);
  }
  return { prices, failures };
}

export async function refreshAllPrices(holdings) {
  const withTicker = holdings.filter(h => h.ticker?.trim());
  const stocks  = withTicker.filter(h => !CRYPTO_CATEGORIES.has(h.category));
  const cryptos = withTicker.filter(h =>  CRYPTO_CATEGORIES.has(h.category));

  const now = new Date().toISOString();
  const updated = [];
  const failed  = [];

  const stockResults = await Promise.allSettled(
    stocks.map(h => fetchStockPrice(h.ticker.trim()).then(price => ({ id: h.id, price })))
  );
  stockResults.forEach((r, i) => {
    if (r.status === 'fulfilled') updated.push({ id: r.value.id, price: r.value.price, priceUpdatedAt: now });
    else failed.push({ id: stocks[i].id, ticker: stocks[i].ticker, error: r.reason?.message || 'Unknown' });
  });

  if (cryptos.length > 0) {
    const tickers = cryptos.map(h => h.ticker.trim());
    const { prices, failures } = await fetchCryptoPricesBatch(tickers);
    for (const h of cryptos) {
      const ticker = h.ticker.trim();
      if (prices.has(ticker)) updated.push({ id: h.id, price: prices.get(ticker), priceUpdatedAt: now });
      else failed.push({ id: h.id, ticker, error: failures.get(ticker) || 'No price' });
    }
  }

  return { updated, failed };
}

// ── Historical prices ─────────────────────────────────────────────────────────

async function fetchStockHistory(ticker) {
  const url = `/api/yahoo/v8/finance/chart/${encodeURIComponent(ticker)}?range=2y&interval=1d`;
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No data returned');

    const timestamps = result.timestamp || [];
    const closes     = result.indicators?.quote?.[0]?.close || [];

    const priceMap = new Map();
    timestamps.forEach((ts, i) => {
      const price = closes[i];
      if (price != null) {
        const dateStr = new Date(ts * 1000).toISOString().slice(0, 10);
        priceMap.set(dateStr, price);
      }
    });
    return priceMap;
  });
}

async function fetchCryptoHistory(ticker) {
  // Binance public API — no key required, CORS-friendly
  const symbol = `${ticker.toUpperCase()}USDT`;
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=730`;
  return withRetry(async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance HTTP ${res.status} for ${symbol}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error(`No Binance data for ${symbol}`);

    // kline format: [openTime, open, high, low, close, ...]
    const priceMap = new Map();
    for (const kline of data) {
      const dateStr = new Date(kline[0]).toISOString().slice(0, 10);
      const close   = parseFloat(kline[4]);
      if (!isNaN(close)) priceMap.set(dateStr, close);
    }
    return priceMap;
  });
}

/**
 * Fetch 2y of daily closing prices for all holdings with tickers.
 * Returns { histMap: Map<holdingId, Map<dateStr, price>>, skipped: [{name, ticker, reason}] }
 */
export async function fetchAllHistoricalPrices(holdings) {
  const withTicker    = holdings.filter(h => h.ticker?.trim());
  const withoutTicker = holdings.filter(h => !h.ticker?.trim());
  const stocks  = withTicker.filter(h => !CRYPTO_CATEGORIES.has(h.category));
  const cryptos = withTicker.filter(h =>  CRYPTO_CATEGORIES.has(h.category));

  const histMap = new Map();
  const skipped = withoutTicker.map(h => ({ name: h.name, ticker: null, reason: 'No ticker set' }));

  await Promise.allSettled([
    ...stocks.map(async h => {
      try {
        histMap.set(h.id, await fetchStockHistory(h.ticker.trim()));
      } catch (e) {
        skipped.push({ name: h.name, ticker: h.ticker, reason: e.message });
      }
    }),
    ...cryptos.map(async h => {
      try {
        histMap.set(h.id, await fetchCryptoHistory(h.ticker.trim()));
      } catch (e) {
        skipped.push({ name: h.name, ticker: h.ticker, reason: e.message });
      }
    }),
  ]);

  return { histMap, skipped };
}

// ── Portfolio series ──────────────────────────────────────────────────────────

export const CHART_RANGES = ['1M', '3M', '6M', 'YTD', '1Y', '2Y'];

function getRangeStart(rangeKey) {
  const today = new Date();
  if (rangeKey === 'YTD') return `${today.getFullYear()}-01-01`;
  const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '2Y': 730 }[rangeKey] || 365;
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Return the number of units of a holding active on a given date.
 * Uses tranches[] if present, otherwise falls back to flat units field.
 */
function getActiveUnits(holding, dateStr) {
  const tranches = holding.tranches;
  if (tranches?.length > 0) {
    return tranches
      .filter(t => !t.date || t.date <= dateStr)
      .reduce((s, t) => s + (+t.units || 0), 0);
  }
  // Legacy holding — always active
  return +holding.units || 0;
}

/**
 * Binary search: find the last price on or before dateStr in a sorted
 * [[dateStr, price], ...] array. Returns null if none found.
 */
function lastKnownPrice(sorted, dateStr) {
  let lo = 0, hi = sorted.length - 1, result = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid][0] <= dateStr) { result = sorted[mid][1]; lo = mid + 1; }
    else                           { hi = mid - 1; }
  }
  return result;
}

/**
 * Build a [{date, value}] series for the full portfolio in USD.
 * Uses forward-fill so weekends/holidays don't create artificial drops.
 * histMap: Map<holdingId, Map<dateStr, price>>
 */
export function buildPortfolioSeries(holdings, histMap, rangeKey) {
  const startDate = getRangeStart(rangeKey);
  const todayStr  = new Date().toISOString().slice(0, 10);

  // Pre-sort each holding's price entries once
  const sortedPrices = new Map();
  for (const [id, priceMap] of histMap) {
    sortedPrices.set(id, [...priceMap.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }

  // Collect all dates in range across all holdings
  const allDates = new Set();
  for (const [, priceMap] of histMap) {
    for (const d of priceMap.keys()) {
      if (d >= startDate && d <= todayStr) allDates.add(d);
    }
  }

  const dates = [...allDates].sort();
  if (dates.length === 0) return [];

  return dates.map(dateStr => {
    let total = 0;
    for (const h of holdings) {
      const sorted = sortedPrices.get(h.id);
      if (!sorted?.length) continue;
      const units = getActiveUnits(h, dateStr);
      if (units === 0) continue;
      // Forward-fill: use last known price if no exact match for this date
      const price = lastKnownPrice(sorted, dateStr);
      if (price != null) total += units * price;
    }
    return { date: dateStr, value: Math.round(total * 100) / 100 };
  });
}
