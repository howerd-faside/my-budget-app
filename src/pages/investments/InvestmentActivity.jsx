import { useState, useMemo, useCallback } from 'react';
import { usePortfolioAnalytics, useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card, ConfirmDialog } from '../../components/ui';
import TxModal from '../../components/investments/TxModal';
import {
  normalizeInvestmentTransaction,
  INV_TX_TYPES,
  INV_TX_TYPE_PILL,
} from '../../models/InvestmentTransaction';
import { filterTxByDateRange, filterTxByType } from '../../utils/finance/portfolio';
import { today } from '../../utils/finance/dates';
import { fmtCurrency as fmt } from '../../utils/format';
import ImportModal from '../../components/investments/ImportModal';

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_FILTER = ['All', ...INV_TX_TYPES];

const TYPE_LABELS = {
  buy: 'Buy', sell: 'Sell', dividend: 'Dividend', fee: 'Fee',
  deposit: 'Deposit', withdrawal: 'Withdrawal', transfer: 'Transfer',
};

// ── Main component ───────────────────────────────────────────────────────────

export default function InvestmentActivity() {
  const {
    investmentTransactions, investmentAssets,
    setInvestment,
  } = useInvestment();
  const { assets, transactions } = usePortfolioAnalytics();

  const [typeFilter,  setTypeFilter]  = useState('All');
  const [assetFilter, setAssetFilter] = useState('All');
  const [platFilter,  setPlatFilter]  = useState('All');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');

  const [showModal,     setShowModal]     = useState(false);
  const [showImport,    setShowImport]    = useState(false);
  const [editTarget,    setEditTarget]    = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Build asset name map and platform list
  const assetMap = useMemo(() => {
    const m = {};
    for (const a of assets) m[a.id] = a;
    return m;
  }, [assets]);

  const platforms = useMemo(() => {
    const set = new Set(assets.map(a => a.platform).filter(Boolean));
    return ['All', ...Array.from(set).sort()];
  }, [assets]);

  // Apply filters
  const filtered = useMemo(() => {
    let list = transactions;

    if (typeFilter !== 'All') list = filterTxByType(list, typeFilter);

    if (dateFrom || dateTo) {
      const from = dateFrom || '0000-01-01';
      const to   = dateTo   || '9999-12-31';
      list = filterTxByDateRange(list, from, to);
    }

    if (assetFilter !== 'All') {
      list = list.filter(tx => tx.assetId === assetFilter);
    }

    if (platFilter !== 'All') {
      const assetIds = new Set(assets.filter(a => a.platform === platFilter).map(a => a.id));
      list = list.filter(tx => assetIds.has(tx.assetId));
    }

    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [transactions, typeFilter, assetFilter, platFilter, dateFrom, dateTo, assets]);

  const hasActiveFilters = typeFilter !== 'All' || assetFilter !== 'All' || platFilter !== 'All' || dateFrom || dateTo;

  // ── Context-aware stats ──────────────────────────────────────────────────

  const stats = useMemo(() => {
    let buys = 0, sells = 0, dividendNet = 0, dividendGross = 0, dividendTax = 0;
    let fees = 0, deposits = 0, withdrawals = 0;

    for (const tx of filtered) {
      switch (tx.type) {
        case 'buy':        buys += tx.amount; break;
        case 'sell':       sells += tx.amount; break;
        case 'dividend':
          dividendNet   += tx.amount;
          dividendGross += tx.grossAmount ?? 0;
          dividendTax   += tx.taxAmount   ?? 0;
          break;
        case 'fee':        fees += tx.amount; break;
        case 'deposit':    deposits += tx.amount; break;
        case 'withdrawal': withdrawals += tx.amount; break;
      }
    }

    // Period totals for deposits
    const thisYear  = String(new Date().getFullYear());
    const thisMonth = new Date().toISOString().slice(0, 7);
    const depositThisYear  = filtered.filter(tx => tx.type === 'deposit' && tx.date?.startsWith(thisYear)).reduce((s, tx) => s + tx.amount, 0);
    const depositThisMonth = filtered.filter(tx => tx.type === 'deposit' && tx.date?.startsWith(thisMonth)).reduce((s, tx) => s + tx.amount, 0);

    return {
      count: filtered.length,
      buys, sells, dividendNet, dividendGross, dividendTax,
      fees, deposits, withdrawals,
      depositThisYear, depositThisMonth,
    };
  }, [filtered]);

  // ── CRUD handlers ────────────────────────────────────────────────────────

  const allTxs = investmentTransactions || [];
  const pid = assets.length > 0 ? assets[0].portfolioId : '';

  const handleSave = (form) => {
    const normalized = normalizeInvestmentTransaction(form);
    if (form.id) {
      setInvestment('investmentTransactions', allTxs.map(t => t.id === form.id ? { ...normalized, id: form.id, portfolioId: form.portfolioId, createdAt: form.createdAt } : t));
    } else {
      setInvestment('investmentTransactions', [
        ...allTxs,
        { ...normalized, id: crypto.randomUUID(), portfolioId: pid, createdAt: today() },
      ]);
    }
    setShowModal(false);
    setEditTarget(null);
  };

  const handleDelete = useCallback((id) => {
    setConfirmTarget(id);
  }, []);

  const executeDelete = () => {
    if (confirmTarget) {
      setInvestment('investmentTransactions', allTxs.filter(t => t.id !== confirmTarget));
    }
    setConfirmTarget(null);
  };

  const openEdit = useCallback((tx) => { setEditTarget(tx); setShowModal(true); }, []);
  const openAdd  = (defaultType) => {
    setEditTarget(null);
    setShowModal(true);
    // Store desired default type so TxModal can pick it up
    if (defaultType) setAddDefaults({ type: defaultType });
    else setAddDefaults(null);
  };
  const [addDefaults, setAddDefaults] = useState(null);

  const clearFilters = () => {
    setTypeFilter('All'); setAssetFilter('All'); setPlatFilter('All');
    setDateFrom(''); setDateTo('');
  };

  // ── Render stats (context-aware) ──────────────────────────────────────────

  const renderStats = () => {
    if (transactions.length === 0) return null;

    // Dividend-focused stats
    if (typeFilter === 'dividend') {
      return (
        <div className="fn-summary">
          <StatTile label="Transactions" value={String(stats.count)} />
          <StatTile label="Gross Total"  value={fmt(stats.dividendGross)} />
          <StatTile label="Tax Withheld" value={fmt(stats.dividendTax)} valueClassName={stats.dividendTax > 0 ? 'red' : undefined} />
          <StatTile label="Net Received" value={fmt(stats.dividendNet)} valueClassName="green" />
        </div>
      );
    }

    // Deposit-focused stats
    if (typeFilter === 'deposit') {
      return (
        <div className="fn-summary">
          <StatTile label="Transactions"  value={String(stats.count)} />
          <StatTile label="All Time"      value={fmt(stats.deposits)} />
          <StatTile label="This Year"     value={fmt(stats.depositThisYear)} />
          <StatTile label="This Month"    value={fmt(stats.depositThisMonth)} />
        </div>
      );
    }

    // Default stats
    return (
      <div className="fn-summary">
        <StatTile label="Transactions" value={String(stats.count)} />
        <StatTile label="Buys"         value={fmt(stats.buys)} />
        <StatTile label="Sells"        value={fmt(stats.sells)} />
        <StatTile label="Dividends"    value={fmt(stats.dividendNet)} valueClassName="green" />
        {stats.deposits > 0 && (
          <StatTile label="Deposits"   value={fmt(stats.deposits)} />
        )}
        {stats.fees > 0 && (
          <StatTile label="Fees"       value={fmt(stats.fees)} valueClassName="red" />
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Contextual add button label
  const addLabel = typeFilter === 'dividend' ? '+ Add Dividend'
                 : typeFilter === 'deposit'  ? '+ Add Deposit'
                 : '+ Add Transaction';

  return (
    <div className="page-content">

      {/* Stats */}
      {renderStats()}

      {/* Filter bar */}
      {transactions.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="filter" size={15} /> Filters</>}
            actions={
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost small" onClick={() => setShowImport(true)}>Import CSV</button>
                <button className="btn-ghost small" onClick={() => openAdd(typeFilter !== 'All' ? typeFilter : undefined)}>
                  {addLabel}
                </button>
              </div>
            }
          />

          {/* Type tabs */}
          <div className="filter-tabs">
            {TYPE_FILTER.map(t => (
              <button
                key={t}
                className={`filter-tab ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === 'All' ? 'All' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Date range + Asset + Platform */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="input mono"
              type="date"
              style={{ maxWidth: 150, fontSize: 12 }}
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              title="From date"
            />
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>to</span>
            <input
              className="input mono"
              type="date"
              style={{ maxWidth: 150, fontSize: 12 }}
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              title="To date"
            />

            {assets.length > 0 && (
              <select
                className="input"
                style={{ maxWidth: 200, fontSize: 12 }}
                value={assetFilter}
                onChange={e => setAssetFilter(e.target.value)}
              >
                <option value="All">All Assets</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}{a.ticker ? ` (${a.ticker})` : ''}
                  </option>
                ))}
              </select>
            )}

            {platforms.length > 2 && (
              <select
                className="input"
                style={{ maxWidth: 160, fontSize: 12 }}
                value={platFilter}
                onChange={e => setPlatFilter(e.target.value)}
              >
                {platforms.map(p => (
                  <option key={p} value={p}>{p === 'All' ? 'All Platforms' : p}</option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button className="btn-ghost small" onClick={clearFilters}>Clear</button>
            )}
          </div>
        </Card>
      )}

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Icon name="swap" size={38} />}
          title={
            transactions.length === 0
              ? 'No activity yet. Record your first investment transaction.'
              : 'No activity matches your filters.'
          }
          action={transactions.length === 0 && (
            <button className="btn-ghost small" onClick={() => openAdd()}>+ Add Transaction</button>
          )}
        />
      ) : (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="swap" size={15} /> Activity</>}
            subtitle={`${filtered.length} transaction${filtered.length !== 1 ? 's' : ''}`}
          />
          <div className="fn-list">
            {filtered.map(tx => {
              const asset = assetMap[tx.assetId];
              const pillColor = INV_TX_TYPE_PILL[tx.type] || '';
              const displayName = asset?.name || tx.label || TYPE_LABELS[tx.type];
              const amountColor =
                tx.type === 'sell' || tx.type === 'withdrawal' ? 'var(--red)'
                : tx.type === 'dividend' || tx.type === 'deposit' ? 'var(--green)'
                : undefined;

              return (
                <div key={tx.id} className="fn-row">
                  <div className="fn-main" style={{ cursor: 'default' }}>
                    <div className="fn-left">
                      <div className="fn-dates">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="fn-label">{displayName}</span>
                          <span className={`dpill ${pillColor}`}>{TYPE_LABELS[tx.type]}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{tx.date}</span>
                          {asset?.ticker && (
                            <span className="tag sm" style={{ fontFamily: 'var(--mono)', letterSpacing: 0 }}>{asset.ticker}</span>
                          )}
                          {asset?.platform && <span className="tag sm">{asset.platform}</span>}
                          {tx.units != null && (
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                              {tx.units.toLocaleString('en-NZ', { maximumFractionDigits: 4 })} units @ {fmt(tx.price || 0)}
                            </span>
                          )}
                          {tx.type === 'dividend' && tx.grossAmount != null && tx.taxAmount != null && +tx.taxAmount > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--red)' }}>Tax {fmt(tx.taxAmount)}</span>
                          )}
                          {tx.type === 'dividend' && tx.grossAmount != null && +tx.grossAmount > 0 && (
                            <span style={{ fontSize: 10, color: 'var(--text3)' }}>gross {fmt(tx.grossAmount)}</span>
                          )}
                          {tx.label && tx.type === 'deposit' && (
                            <span className="tag sm">{tx.label}</span>
                          )}
                        </div>
                        {tx.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{tx.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="fn-right" style={{ alignItems: 'flex-end', gap: 6 }}>
                      <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: amountColor }}>
                        {fmt(tx.amount)}
                      </span>
                      <div className="exp-actions">
                        <button className="btn-icon small" onClick={() => openEdit(tx)} aria-label="Edit transaction">
                          <Icon name="pencil" size={12} />
                        </button>
                        <button className="btn-icon small danger" onClick={() => handleDelete(tx.id)} aria-label="Delete transaction">
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Modal */}
      {showModal && (
        <TxModal
          tx={editTarget}
          assets={assets}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); setAddDefaults(null); }}
          defaults={addDefaults || {}}
        />
      )}

      {/* Import modal */}
      <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} />

      {/* Confirm delete */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="Remove transaction"
        message="Remove this transaction? This may affect position calculations."
        confirmLabel="Remove"
        onConfirm={executeDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
