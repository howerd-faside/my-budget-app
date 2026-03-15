/**
 * AssetDetail — full detail view for a single investment asset.
 *
 * Sections:
 *   1. Header — asset name, ticker, category/platform tags, back button
 *   2. Position summary — stat tiles: units, avg cost, current price, market value, unrealised/realised G/L
 *   3. Transaction history — all transactions for this asset, newest first
 *   4. Income history — dividend transactions for this asset
 *   5. Notes / metadata — currency, platform, category, dates, notes
 *   6. Quick actions — Add Buy, Add Sell, Add Dividend buttons → open TxModal pre-filled
 */
import { useState, useMemo, useCallback } from 'react';
import { usePortfolioAnalytics, useInvestment } from '../../store/hooks';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card, ConfirmDialog } from '../../components/ui';
import TxModal from '../../components/investments/TxModal';
import { normalizeInvestmentTransaction, INV_TX_TYPE_PILL } from '../../models/InvestmentTransaction';
import { calcIncomeTotals } from '../../utils/finance/portfolio';
import { CATEGORY_COLORS } from '../../utils/colors';
import { today } from '../../utils/finance/dates';
import { fmtCurrency as fmt } from '../../utils/format';

const TYPE_LABELS = {
  buy: 'Buy', sell: 'Sell', dividend: 'Dividend', fee: 'Fee',
  deposit: 'Deposit', withdrawal: 'Withdrawal', transfer: 'Transfer',
};

export default function AssetDetail({ assetId, onBack }) {
  const { investmentTransactions, setInvestment } = useInvestment();
  const { enrichedAssets, transactions, assets } = usePortfolioAnalytics();

  // Find the enriched asset
  const enriched = useMemo(
    () => enrichedAssets.find(ea => ea.asset.id === assetId),
    [enrichedAssets, assetId],
  );

  // Transactions for this asset, newest first
  const assetTxs = useMemo(
    () => transactions
      .filter(tx => tx.assetId === assetId)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [transactions, assetId],
  );

  // Dividend transactions only
  const dividendTxs = useMemo(
    () => assetTxs.filter(tx => tx.type === 'dividend'),
    [assetTxs],
  );

  // Income totals for this asset
  const assetIncome = useMemo(
    () => calcIncomeTotals(assetTxs),
    [assetTxs],
  );

  // Modal state
  const [showTxModal, setShowTxModal] = useState(false);
  const [txModalDefaults, setTxModalDefaults] = useState({});
  const [editTarget, setEditTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const allTxs = investmentTransactions || [];
  const pid = enriched?.asset.portfolioId || '';

  const handleSaveTx = useCallback((form) => {
    const normalized = normalizeInvestmentTransaction(form);
    if (form.id) {
      setInvestment('investmentTransactions',
        allTxs.map(t => t.id === form.id
          ? { ...normalized, id: form.id, portfolioId: form.portfolioId, createdAt: form.createdAt }
          : t
        ),
      );
    } else {
      setInvestment('investmentTransactions', [
        ...allTxs,
        { ...normalized, id: crypto.randomUUID(), portfolioId: pid, createdAt: today() },
      ]);
    }
    setShowTxModal(false);
    setEditTarget(null);
  }, [allTxs, pid, setInvestment]);

  const openQuickAction = (type) => {
    setEditTarget(null);
    setTxModalDefaults({ assetId, type });
    setShowTxModal(true);
  };

  const openEditTx = (tx) => {
    setEditTarget(tx);
    setTxModalDefaults({});
    setShowTxModal(true);
  };

  const handleDeleteTx = (id) => setConfirmTarget(id);

  const executeDelete = () => {
    if (confirmTarget) {
      setInvestment('investmentTransactions', allTxs.filter(t => t.id !== confirmTarget));
    }
    setConfirmTarget(null);
  };

  if (!enriched) {
    return (
      <div className="page-content">
        <button className="btn-ghost small" onClick={onBack} style={{ marginBottom: 12 }}>
          <Icon name="chevronD" size={12} style={{ transform: 'rotate(90deg)' }} /> Back to Assets
        </button>
        <EmptyState icon={<Icon name="alertcir" size={38} />} title="Asset not found." />
      </div>
    );
  }

  const { asset, position, currentPrice, currentValue, unrealisedGL, unrealisedGLPct, totalReturn } = enriched;
  const isGain = unrealisedGL >= 0;
  const isRealisedGain = position.realisedGL >= 0;
  const catColor = CATEGORY_COLORS[asset.category] || '#86868B';

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button className="btn-ghost small" onClick={onBack} aria-label="Back to assets">
          <Icon name="chevronD" size={12} style={{ transform: 'rotate(90deg)' }} /> Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{asset.name}</h2>
            {asset.ticker && (
              <span className="tag" style={{ fontFamily: 'var(--mono)', letterSpacing: 0, fontSize: 13 }}>{asset.ticker}</span>
            )}
            <span className="tag" style={{ color: catColor, borderColor: `${catColor}40`, background: `${catColor}12` }}>
              {asset.category}
            </span>
            {asset.platform && <span className="tag">{asset.platform}</span>}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn-ghost small" onClick={() => openQuickAction('buy')}>
          <Icon name="plus" size={12} /> Add Buy
        </button>
        <button className="btn-ghost small" onClick={() => openQuickAction('sell')}>
          <Icon name="plus" size={12} /> Add Sell
        </button>
        <button className="btn-ghost small" onClick={() => openQuickAction('dividend')}>
          <Icon name="plus" size={12} /> Add Dividend
        </button>
      </div>

      {/* Position summary */}
      <div className="fn-summary">
        <StatTile label="Units" value={position.units.toLocaleString('en-NZ', { maximumFractionDigits: 6 })} />
        <StatTile label="Avg Cost" value={fmt(position.avgCost)} />
        <StatTile label="Current Price" value={fmt(currentPrice)} />
        <StatTile label="Market Value" value={fmt(currentValue)} />
        <StatTile
          label="Unrealised G/L"
          value={`${isGain ? '+' : '−'}${fmt(unrealisedGL)}`}
          valueClassName={isGain ? 'green' : 'red'}
          meta={`${isGain ? '+' : ''}${unrealisedGLPct.toFixed(1)}%`}
        />
        {position.realisedGL !== 0 && (
          <StatTile
            label="Realised G/L"
            value={`${isRealisedGain ? '+' : '−'}${fmt(position.realisedGL)}`}
            valueClassName={isRealisedGain ? 'green' : 'red'}
          />
        )}
        <StatTile label="Cost Basis" value={fmt(position.totalCost)} />
        <StatTile
          label="Total Return"
          value={`${totalReturn >= 0 ? '+' : '−'}${fmt(totalReturn)}`}
          valueClassName={totalReturn >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Transaction history */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="swap" size={15} /> Transaction History</>}
          subtitle={`${assetTxs.length} transaction${assetTxs.length !== 1 ? 's' : ''}`}
        />
        {assetTxs.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            No transactions recorded for this asset.
          </div>
        ) : (
          <div className="fn-list">
            {assetTxs.map(tx => {
              const pillColor = INV_TX_TYPE_PILL[tx.type] || '';
              const amountColor =
                tx.type === 'sell' ? 'var(--red)'
                : tx.type === 'dividend' ? 'var(--green)'
                : undefined;

              return (
                <div key={tx.id} className="fn-row">
                  <div className="fn-main" style={{ cursor: 'default' }}>
                    <div className="fn-left">
                      <div className="fn-dates">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`dpill ${pillColor}`}>{TYPE_LABELS[tx.type]}</span>
                          <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{tx.date}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                          {tx.units != null && (
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                              {tx.units.toLocaleString('en-NZ', { maximumFractionDigits: 4 })} units @ {fmt(tx.price || 0)}
                            </span>
                          )}
                          {tx.type === 'dividend' && tx.grossAmount != null && (
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                              Gross {fmt(tx.grossAmount)}
                              {tx.taxAmount != null && +tx.taxAmount > 0 && (
                                <> · Tax {fmt(tx.taxAmount)}</>
                              )}
                            </span>
                          )}
                          {tx.fee > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Fee {fmt(tx.fee)}</span>
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
                        <button className="btn-icon small" onClick={() => openEditTx(tx)} aria-label="Edit transaction">
                          <Icon name="pencil" size={12} />
                        </button>
                        <button className="btn-icon small danger" onClick={() => handleDeleteTx(tx.id)} aria-label="Delete transaction">
                          <Icon name="trash" size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Income history */}
      {(dividendTxs.length > 0 || assetIncome.dividendGross > 0) && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="wallet" size={15} /> Income History</>}
            subtitle={`${dividendTxs.length} dividend${dividendTxs.length !== 1 ? 's' : ''}`}
          />
          <div className="fn-summary" style={{ marginBottom: 8 }}>
            <StatTile label="Gross" value={fmt(assetIncome.dividendGross)} />
            <StatTile label="Tax" value={fmt(assetIncome.dividendTax)} valueClassName="red" />
            <StatTile label="Net" value={fmt(assetIncome.dividendNet)} valueClassName="green" />
          </div>
          <div className="fn-list">
            {dividendTxs.map(tx => (
              <div key={tx.id} className="fn-row">
                <div className="fn-main" style={{ cursor: 'default' }}>
                  <div className="fn-left">
                    <div className="fn-dates">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="dpill green">Dividend</span>
                        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{tx.date}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', fontSize: 11, color: 'var(--text3)' }}>
                        {tx.grossAmount != null && <span>Gross {fmt(tx.grossAmount)}</span>}
                        {tx.taxAmount != null && +tx.taxAmount > 0 && <span>Tax {fmt(tx.taxAmount)}</span>}
                      </div>
                      {tx.notes && (
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{tx.notes}</div>
                      )}
                    </div>
                  </div>
                  <div className="fn-right">
                    <span className="mono green" style={{ fontSize: 15, fontWeight: 600 }}>{fmt(tx.amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Metadata */}
      <Card variant="section">
        <SectionHeader title={<><Icon name="tag" size={15} /> Details</>} />
        <div className="exp-detail-grid" style={{ padding: '4px 0' }}>
          <div className="edg-item">
            <span className="edg-label">Category</span>
            <span className="edg-val">{asset.category}</span>
          </div>
          {asset.platform && (
            <div className="edg-item">
              <span className="edg-label">Platform</span>
              <span className="edg-val">{asset.platform}</span>
            </div>
          )}
          <div className="edg-item">
            <span className="edg-label">Currency</span>
            <span className="edg-val mono">{asset.currency || 'NZD'}</span>
          </div>
          <div className="edg-item">
            <span className="edg-label">Added</span>
            <span className="edg-val mono">{asset.createdAt || '—'}</span>
          </div>
          {asset.ticker && (
            <div className="edg-item">
              <span className="edg-label">Ticker</span>
              <span className="edg-val mono">{asset.ticker}</span>
            </div>
          )}
        </div>
        {asset.notes && (
          <div style={{ fontSize: 13, color: 'var(--text2)', paddingTop: 8, borderTop: '1px solid var(--sep)', marginTop: 8 }}>
            {asset.notes}
          </div>
        )}
      </Card>

      {/* Tx modal */}
      {showTxModal && (
        <TxModal
          tx={editTarget}
          assets={assets}
          defaults={txModalDefaults}
          onSave={handleSaveTx}
          onClose={() => { setShowTxModal(false); setEditTarget(null); }}
        />
      )}

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
