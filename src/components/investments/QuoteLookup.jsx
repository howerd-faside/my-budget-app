import { useState } from 'react';
import { useToast } from '../Toast';
import { fetchQuote } from '../../utils/priceService';
import { fmtCurrency as fmt } from '../../utils/format';

export default function QuoteLookup({ onWatch, onAddToPortfolio }) {
  const [ticker, setTicker]   = useState('');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote]     = useState(null);
  const [error, setError]     = useState('');
  const toast = useToast();

  const handleLookup = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError('');
    setQuote(null);
    try {
      const q = await fetchQuote(t);
      setQuote(q);
    } catch (e) {
      setError(`Could not find "${t}"`);
    } finally {
      setLoading(false);
    }
  };

  const change = quote?.previousClose
    ? quote.price - quote.previousClose
    : null;
  const changePct = change != null && quote.previousClose
    ? (change / quote.previousClose) * 100
    : null;

  return (
    <>
      <div className="wl-quote-bar">
        <input
          className="input mono"
          placeholder="Enter ticker (e.g. VTI, VT)"
          value={ticker}
          onChange={e => setTicker(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') handleLookup(); }}
          style={{ maxWidth: 220 }}
        />
        <button className="btn-primary small" onClick={handleLookup} disabled={loading || !ticker.trim()}>
          {loading ? 'Looking up…' : 'Look Up'}
        </button>
      </div>

      {error && <div className="wl-quote-error">{error}</div>}

      {quote && (
        <div className="wl-quote-card">
          <div className="wl-quote-header">
            <span className="wl-quote-ticker mono">{quote.ticker}</span>
            <span className="wl-quote-name">{quote.name}</span>
          </div>
          <div className="wl-quote-price-row">
            <span className="wl-quote-price mono">{fmt(quote.price)}</span>
            <span className="tag sm">{quote.currency}</span>
            {change != null && (
              <span className={`mono ${change >= 0 ? 'green' : 'red'}`} style={{ fontSize: 12 }}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePct.toFixed(1)}%)
              </span>
            )}
          </div>
          <div className="wl-quote-actions">
            <button className="btn-ghost small" onClick={() => {
              onWatch(quote);
              setQuote(null);
              setTicker('');
            }}>
              + Watch
            </button>
            <button className="btn-ghost small" onClick={() => {
              onAddToPortfolio(quote);
              setQuote(null);
              setTicker('');
            }}>
              Add to Portfolio
            </button>
          </div>
        </div>
      )}
    </>
  );
}
