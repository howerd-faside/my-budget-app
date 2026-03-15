import { useState, useRef, useMemo, useCallback } from 'react';
import { useInvestment } from '../../store/hooks';
import { useNavigate } from '../../contexts/NavigationContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { SectionHeader, EmptyState, Card, Modal } from '../../components/ui';
import TxModal from '../../components/investments/TxModal';
import { createWatchlistItem } from '../../models/WatchlistItem';
import { createAsset, ASSET_CATEGORIES } from '../../models/Asset';
import { validate, assetSchema } from '../../utils/validation';
import { calcPriceDelta, calcTargetGap, buildPriceMap, getPortfolioTickers } from '../../utils/finance/watchlist';
import { fetchQuote } from '../../utils/priceService';
import { today } from '../../utils/finance/dates';
import { fmtCurrency as fmt } from '../../utils/format';

// ── Quote lookup ────────────────────────────────────────────────────────────

function QuoteLookup({ onWatch, onAddToPortfolio }) {
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
            <span className="tag">{quote.currency}</span>
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

// ── Watchlist row ───────────────────────────────────────────────────────────

function WatchlistRow({
  item, price, inPortfolio, expanded,
  onToggle, onRemove, onConvert, onEdit,
}) {
  const currentPrice = price?.price ?? null;
  const delta = calcPriceDelta(item, currentPrice);
  const gap   = calcTargetGap(item, currentPrice);

  return (
    <div className={`fn-row${expanded ? ' expanded' : ''}`}>
      <div className="fn-main" style={{ cursor: 'pointer' }} onClick={() => onToggle(item.id)}>
        <div className="fn-left">
          <div className="fn-dates">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="fn-label">{item.ticker || item.name}</span>
              {item.ticker && item.name && (
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>{item.name}</span>
              )}
              {inPortfolio && <span className="dpill teal">In portfolio</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
              {currentPrice != null && (
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{fmt(currentPrice)}</span>
              )}
              {delta && (
                <span className={`mono ${delta.absolute >= 0 ? 'green' : 'red'}`} style={{ fontSize: 11 }}>
                  {delta.absolute >= 0 ? '+' : ''}{delta.percent.toFixed(1)}% since added
                </span>
              )}
              {item.targetPrice != null && (
                <span className="tag">Target {fmt(item.targetPrice)}</span>
              )}
              {item.thesis && (
                <span style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  "{item.thesis}"
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="fn-right" style={{ gap: 6, alignItems: 'center' }}>
          <button className="btn-icon small" onClick={e => { e.stopPropagation(); onToggle(item.id); }}
            aria-label={expanded ? 'Collapse' : 'Expand'}>
            <Icon name="chevronD" size={12} />
          </button>
          <button className="btn-icon small danger" onClick={e => { e.stopPropagation(); onRemove(item.id); }}
            aria-label="Remove from watchlist" title="Remove">
            <Icon name="close" size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <WatchlistDetail
          item={item}
          currentPrice={currentPrice}
          delta={delta}
          gap={gap}
          onEdit={onEdit}
          onConvert={onConvert}
        />
      )}
    </div>
  );
}

function WatchlistDetail({ item, currentPrice, delta, gap, onEdit, onConvert }) {
  return (
    <div className="wl-detail">
      {/* Thesis */}
      <div className="wl-detail-section">
        <span className="wl-detail-label">Thesis</span>
        <p className="wl-detail-text">{item.thesis || 'No thesis recorded.'}</p>
      </div>

      {/* Price context */}
      <div className="wl-detail-grid">
        <div>
          <span className="wl-detail-label">Added</span>
          <span className="mono">{item.addedAt || '—'}</span>
        </div>
        {item.priceAtAdd != null && (
          <div>
            <span className="wl-detail-label">Price at add</span>
            <span className="mono">{fmt(item.priceAtAdd)}</span>
          </div>
        )}
        {currentPrice != null && (
          <div>
            <span className="wl-detail-label">Current</span>
            <span className="mono">{fmt(currentPrice)}</span>
          </div>
        )}
        {delta && (
          <div>
            <span className="wl-detail-label">Change</span>
            <span className={`mono ${delta.absolute >= 0 ? 'green' : 'red'}`}>
              {delta.absolute >= 0 ? '+' : ''}{delta.percent.toFixed(1)}%
            </span>
          </div>
        )}
        {item.targetPrice != null && (
          <div>
            <span className="wl-detail-label">Target</span>
            <span className="mono">{fmt(item.targetPrice)}</span>
          </div>
        )}
        {gap && (
          <div>
            <span className="wl-detail-label">Gap to target</span>
            <span className={`mono ${gap.atTarget ? 'green' : ''}`}>
              {gap.atTarget ? 'At target' : `${gap.percent.toFixed(1)}% above`}
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      {item.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {item.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      )}

      {/* Category + Currency */}
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
        {item.category} · {item.currency}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="btn-ghost small" onClick={() => onEdit(item)}>Edit</button>
        <button className="btn-ghost small" onClick={() => onConvert(item)}>Add to Portfolio</button>
      </div>
    </div>
  );
}

// ── Edit modal ──────────────────────────────────────────────────────────────

function WatchlistEditModal({ item, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...item }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.ticker.trim() && !form.name.trim()) return;
    onSave(form);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Watchlist Item"
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" onClick={handleSave}>Save</button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group">
          <label>Ticker</label>
          <input className="input mono" value={form.ticker}
            onChange={e => set('ticker', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label>Name</label>
          <input className="input" value={form.name}
            onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
            {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Currency</label>
          <input className="input mono" value={form.currency}
            onChange={e => set('currency', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label>Target Price</label>
          <input className="input mono" type="number" step="0.01" placeholder="Optional"
            value={form.targetPrice ?? ''}
            onChange={e => set('targetPrice', e.target.value === '' ? null : +e.target.value)} />
        </div>
        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input className="input" placeholder="e.g. US, Core, Income"
            value={(form.tags || []).join(', ')}
            onChange={e => set('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
        </div>
        <div className="form-group full">
          <label>Thesis / Notes</label>
          <textarea className="input" rows={4} placeholder="Why are you watching this?"
            value={form.thesis} onChange={e => set('thesis', e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

// ── Convert-to-asset modal ──────────────────────────────────────────────────

function ConvertModal({ item, portfolios, selectedPortfolioId, onSave, onClose }) {
  const [portfolioId, setPortfolioId] = useState(selectedPortfolioId || portfolios[0]?.id || '');
  const [form, setForm] = useState(() => createAsset({
    name:     item.name,
    ticker:   item.ticker,
    category: item.category,
    currency: item.currency,
  }));
  const [errors, setErrors] = useState({});
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const full = { ...form, portfolioId };
    const { ok, errors: errs } = validate(assetSchema, full);
    if (!ok) { setErrors(errs); return; }
    setErrors({});
    onSave(full, portfolioId);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Add to Portfolio"
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        <>
          <button className="btn-ghost small" onClick={onClose}>Cancel</button>
          <button className="btn-primary small" onClick={handleSave}>Create Asset</button>
        </>
      }
    >
      <div className="form-grid">
        {portfolios.length > 1 && (
          <div className="form-group full">
            <label>Portfolio</label>
            <select className="input" value={portfolioId}
              onChange={e => setPortfolioId(e.target.value)}>
              {portfolios.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="form-group full">
          <label>Asset Name</label>
          <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Vanguard Total World ETF"
            value={form.name} onChange={e => setField('name', e.target.value)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>
        <div className="form-group">
          <label>Ticker</label>
          <input className="input mono" value={form.ticker}
            onChange={e => setField('ticker', e.target.value.toUpperCase())} />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select className="input" value={form.category} onChange={e => setField('category', e.target.value)}>
            {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Platform / Broker</label>
          <input className="input" placeholder="e.g. Sharesies, Hatch"
            value={form.platform} onChange={e => setField('platform', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Currency</label>
          <input className="input mono" value={form.currency}
            onChange={e => setField('currency', e.target.value.toUpperCase())} />
        </div>
      </div>
    </Modal>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function InvestmentDiscovery() {
  const {
    watchlist, watchlistPrices,
    investmentPortfolios, investmentAssets, investmentTransactions,
    selectedPortfolioId,
    setInvestment,
  } = useInvestment();
  const navigate = useNavigate();
  const toast    = useToast();

  const items  = watchlist || [];
  const prices = watchlistPrices || [];
  const portfolios = (investmentPortfolios || []).filter(p => !p.archived);
  const allAssets  = investmentAssets || [];
  const allTxs     = investmentTransactions || [];

  const [expandedId, setExpandedId]       = useState(null);
  const [editTarget, setEditTarget]       = useState(null);
  const [convertTarget, setConvertTarget] = useState(null);
  const [showTxModal, setShowTxModal]     = useState(false);
  const [txDefaults, setTxDefaults]       = useState({});
  const [txAssets, setTxAssets]           = useState([]);
  const [adding, setAdding]               = useState(false);
  const [addTicker, setAddTicker]         = useState('');
  const [addName, setAddName]             = useState('');
  const addRef = useRef(null);

  // Build lookup maps
  const priceMap = useMemo(() => buildPriceMap(prices), [prices]);
  const portfolioTickers = useMemo(() => getPortfolioTickers(allAssets), [allAssets]);

  // ── Watchlist CRUD ──────────────────────────────────────────────────────

  const addItem = useCallback((data) => {
    const item = createWatchlistItem({
      ...data,
      id: crypto.randomUUID(),
      addedAt: today(),
    });
    setInvestment('watchlist', [...items, item]);

    // Also cache the price if we have it
    if (data.price != null) {
      item.priceAtAdd = data.price;
      // Update watchlistPrices
      const ticker = (data.ticker || '').toUpperCase();
      if (ticker) {
        const existing = prices.filter(p => p.ticker.toUpperCase() !== ticker);
        setInvestment('watchlistPrices', [...existing, {
          ticker,
          price: data.price,
          currency: data.currency || 'NZD',
          updatedAt: new Date().toISOString(),
        }]);
      }
      // Re-save item with priceAtAdd
      setInvestment('watchlist', [...items, item]);
    }
  }, [items, prices, setInvestment]);

  const removeItem = useCallback((id) => {
    setInvestment('watchlist', items.filter(i => i.id !== id));
    if (expandedId === id) setExpandedId(null);
  }, [items, expandedId, setInvestment]);

  const saveEdit = useCallback((form) => {
    setInvestment('watchlist', items.map(i => i.id === form.id ? { ...form } : i));
    setEditTarget(null);
  }, [items, setInvestment]);

  const toggleExpand = useCallback((id) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  // ── Watch from quote ────────────────────────────────────────────────────

  const watchFromQuote = useCallback((quote) => {
    addItem({
      ticker:     quote.ticker,
      name:       quote.name,
      currency:   quote.currency,
      price:      quote.price,
      priceAtAdd: quote.price,
    });
    toast(`Added ${quote.ticker} to watchlist`, 'success');
  }, [addItem, toast]);

  // ── Manual add ──────────────────────────────────────────────────────────

  const startAdd = () => {
    setAdding(true);
    setAddTicker('');
    setAddName('');
    setTimeout(() => addRef.current?.focus(), 0);
  };

  const confirmAdd = () => {
    const t = addTicker.trim().toUpperCase();
    const n = addName.trim();
    if (!t && !n) { setAdding(false); return; }
    addItem({ ticker: t, name: n });
    toast(`Added ${t || n} to watchlist`, 'success');
    setAdding(false);
  };

  // ── Convert flow ────────────────────────────────────────────────────────

  const startConvert = useCallback((itemOrQuote) => {
    // Could be a WatchlistItem (has id) or a quote object
    const item = itemOrQuote.id ? itemOrQuote : createWatchlistItem({
      ticker:   itemOrQuote.ticker,
      name:     itemOrQuote.name,
      category: 'Shares',
      currency: itemOrQuote.currency,
    });
    setConvertTarget(item);
  }, []);

  const handleConvertSave = useCallback((form, portfolioId) => {
    const id = crypto.randomUUID();
    const asset = { ...form, id, portfolioId, createdAt: today() };
    setInvestment('investmentAssets', [...allAssets, asset]);
    setConvertTarget(null);
    toast(`Created asset "${asset.name}" in portfolio`, 'success');

    // Offer to record a buy transaction
    const portAssets = [...allAssets, asset].filter(a => a.portfolioId === portfolioId);
    setTxAssets(portAssets);
    setTxDefaults({ assetId: id, type: 'buy' });
    setShowTxModal(true);
  }, [allAssets, setInvestment, toast]);

  const handleTxSave = useCallback((form) => {
    const tx = {
      ...form,
      id: crypto.randomUUID(),
      portfolioId: form.portfolioId || selectedPortfolioId,
      createdAt: today(),
    };
    setInvestment('investmentTransactions', [...allTxs, tx]);
    setShowTxModal(false);
    toast('Buy transaction recorded', 'success');
  }, [allTxs, selectedPortfolioId, setInvestment, toast]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="page-content">

      {/* Quick Quote */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="trend" size={15} /> Quick Quote</>} />
        <QuoteLookup onWatch={watchFromQuote} onAddToPortfolio={startConvert} />
      </Card>

      {/* Watchlist */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="tag" size={15} /> Watchlist</>}
          subtitle={`${items.length} item${items.length !== 1 ? 's' : ''}`}
          actions={<button className="btn-ghost small" onClick={startAdd}>+ Add</button>}
        />

        {items.length === 0 && !adding ? (
          <EmptyState
            icon={<Icon name="tag" size={38} />}
            title="Nothing on your watchlist yet."
            action={<button className="btn-ghost small" onClick={startAdd}>+ Add Item</button>}
          />
        ) : (
          <div className="fn-list">
            {adding && (
              <div className="fn-row" style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                  <input
                    ref={addRef}
                    className="input mono"
                    placeholder="Ticker"
                    style={{ maxWidth: 100 }}
                    value={addTicker}
                    onChange={e => setAddTicker(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAdding(false); }}
                  />
                  <input
                    className="input"
                    placeholder="Name (optional)"
                    style={{ flex: 1 }}
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') setAdding(false); }}
                    onBlur={confirmAdd}
                  />
                </div>
              </div>
            )}
            {items.map(item => (
              <WatchlistRow
                key={item.id}
                item={item}
                price={priceMap[item.ticker.toUpperCase()]}
                inPortfolio={portfolioTickers.has(item.ticker.toUpperCase())}
                expanded={expandedId === item.id}
                onToggle={toggleExpand}
                onRemove={removeItem}
                onConvert={startConvert}
                onEdit={setEditTarget}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Edit modal */}
      {editTarget && (
        <WatchlistEditModal
          item={editTarget}
          onSave={saveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Convert-to-asset modal */}
      {convertTarget && (
        <ConvertModal
          item={convertTarget}
          portfolios={portfolios}
          selectedPortfolioId={selectedPortfolioId}
          onSave={handleConvertSave}
          onClose={() => setConvertTarget(null)}
        />
      )}

      {/* Optional buy transaction after convert */}
      {showTxModal && (
        <TxModal
          tx={null}
          assets={txAssets}
          defaults={txDefaults}
          onSave={handleTxSave}
          onClose={() => setShowTxModal(false)}
        />
      )}
    </div>
  );
}
