import { useState, useRef, useMemo, useCallback } from 'react';
import { useInvestment, useUndoDelete } from '../../store/hooks';
import { useNavigate } from '../../contexts/NavigationContext';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { SectionHeader, Card } from '../../components/ui';
import TxModal from '../../components/investments/TxModal';
import QuoteLookup from '../../components/investments/QuoteLookup';
import WatchlistRow from '../../components/investments/WatchlistRow';
import WatchlistEditModal from '../../components/investments/WatchlistEditModal';
import ConvertToAssetModal from '../../components/investments/ConvertToAssetModal';
import { createWatchlistItem } from '../../models/WatchlistItem';
import { buildPriceMap, getPortfolioTickers } from '../../utils/finance/watchlist';
import { today } from '../../utils/finance/dates';

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
  const undoDelete = useUndoDelete();

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
    const name = items.find(i => i.id === id)?.name || 'Watchlist item';
    undoDelete({
      label: `${name} removed`,
      domain: 'investment',
      snapshot: { watchlist: items },
      applyFn: () => setInvestment('watchlist', items.filter(i => i.id !== id)),
    });
    if (expandedId === id) setExpandedId(null);
  }, [items, expandedId, setInvestment, undoDelete]);

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

      {/* Single card: quote bar + watchlist */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="tag" size={15} /> Watchlist</>}
          subtitle={items.length > 0 ? `${items.length} item${items.length !== 1 ? 's' : ''}` : null}
          actions={<button className="btn-ghost small" onClick={startAdd}>+ Add</button>}
        />

        <QuoteLookup onWatch={watchFromQuote} onAddToPortfolio={startConvert} />

        {items.length === 0 && !adding ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0 8px' }}>
            Nothing on your watchlist yet.{' '}
            <button className="btn-ghost small" onClick={startAdd} style={{ display: 'inline' }}>+ Add Item</button>
          </div>
        ) : (
          <div className="fn-list" style={{ marginTop: 8 }}>
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
        <ConvertToAssetModal
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
