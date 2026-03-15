import { useState, useRef, useMemo } from 'react';
import { useInvestment } from '../../store/hooks';
import { enrichAllAssets, calcIncomeTotals } from '../../utils/finance/portfolio';
import {
  getPortfolioDependents,
  cascadeDeletePortfolio,
  portfolioDeleteMessage,
} from '../../utils/cascade';
import { today } from '../../utils/finance/dates';
import { fmtCurrency as fmt } from '../../utils/format';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card, ConfirmDialog } from '../../components/ui';

// ── Per-portfolio summary ────────────────────────────────────────────────────

function PortfolioCard({
  portfolio, stats, isSelected, isArchived,
  onSelect, onRename, onArchive, onDelete,
}) {
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal]   = useState('');
  const inputRef = useRef(null);

  const startRename = (e) => {
    e.stopPropagation();
    setNameVal(portfolio.name);
    setRenaming(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitRename = () => {
    const name = nameVal.trim();
    if (name && name !== portfolio.name) onRename(portfolio.id, name);
    setRenaming(false);
  };

  const isGain = stats.totalReturn >= 0;

  return (
    <div
      className={`port-card${isSelected ? ' selected' : ''}${isArchived ? ' archived' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => !isArchived && onSelect(portfolio.id)}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !isArchived) { e.preventDefault(); onSelect(portfolio.id); } }}
    >
      {/* Header */}
      <div className="port-card-header">
        <div className="port-card-title-row">
          {renaming ? (
            <input
              ref={inputRef}
              className="port-card-rename"
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="port-card-name">{portfolio.name}</span>
          )}
          {isSelected && <span className="dpill teal">Active</span>}
          {isArchived && <span className="dpill">Archived</span>}
        </div>

        <div className="port-card-actions">
          {!renaming && (
            <button className="btn-icon small" title="Rename" onClick={startRename}>
              <Icon name="pencil" size={12} />
            </button>
          )}
          <button
            className="btn-icon small"
            title={isArchived ? 'Unarchive' : 'Archive'}
            onClick={e => { e.stopPropagation(); onArchive(portfolio.id, !isArchived); }}
          >
            <Icon name={isArchived ? 'arrow-up' : 'arrow-down'} size={12} />
          </button>
          <button
            className="btn-icon small danger"
            title="Delete"
            onClick={e => { e.stopPropagation(); onDelete(portfolio.id); }}
          >
            <Icon name="trash" size={12} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="port-card-stats">
        <div className="port-card-stat">
          <span className="port-card-stat-label">Assets</span>
          <span className="port-card-stat-val mono">{stats.assetCount}</span>
        </div>
        <div className="port-card-stat">
          <span className="port-card-stat-label">Value</span>
          <span className="port-card-stat-val mono">{fmt(stats.totalValue)}</span>
        </div>
        <div className="port-card-stat">
          <span className="port-card-stat-label">Cost</span>
          <span className="port-card-stat-val mono">{fmt(stats.totalCost)}</span>
        </div>
        <div className="port-card-stat">
          <span className="port-card-stat-label">Return</span>
          <span className={`port-card-stat-val mono ${isGain ? 'green' : 'red'}`}>
            {isGain ? '+' : '−'}{fmt(stats.totalReturn)}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="port-card-meta">
        <span>Created {portfolio.createdAt || '—'}</span>
        <span>{portfolio.currency || 'NZD'} · {portfolio.costBasisMethod || 'average'} cost</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InvestmentPortfolios() {
  const {
    investmentPortfolios, selectedPortfolioId,
    investmentAssets, investmentTransactions, priceCache,
    investments, investmentContributions, investmentDividends,
    setInvestment, mergeInvestment,
  } = useInvestment();

  const portfolios = investmentPortfolios || [];
  const allAssets  = investmentAssets || [];
  const allTxs    = investmentTransactions || [];
  const prices    = priceCache || [];

  const [creating,      setCreating]      = useState(false);
  const [newName,        setNewName]       = useState('');
  const [showArchived,   setShowArchived]  = useState(false);
  const [confirmTarget,  setConfirmTarget] = useState(null);
  const inputRef = useRef(null);

  // ── Per-portfolio stats ────────────────────────────────────────────────────

  const portfolioStats = useMemo(() => {
    const map = {};
    for (const p of portfolios) {
      const pAssets = allAssets.filter(a => a.portfolioId === p.id);
      const pTxs   = allTxs.filter(t => t.portfolioId === p.id);
      const pPriceIds = new Set(pAssets.map(a => a.id));
      const pPrices   = prices.filter(pr => pPriceIds.has(pr.assetId));

      const enriched = enrichAllAssets(pAssets, pTxs, pPrices);
      const income   = calcIncomeTotals(pTxs);

      let totalValue = 0, totalCost = 0, unrealisedGL = 0, realisedGL = 0;
      for (const ea of enriched) {
        totalValue   += ea.currentValue;
        totalCost    += ea.position.totalCost;
        unrealisedGL += ea.unrealisedGL;
        realisedGL   += ea.position.realisedGL;
      }
      const totalReturn = unrealisedGL + realisedGL;

      map[p.id] = {
        assetCount: pAssets.length,
        totalValue,
        totalCost,
        unrealisedGL,
        realisedGL,
        totalReturn,
        returnPct: totalCost > 0 ? (totalReturn / totalCost) * 100 : 0,
        dividendNet: income.dividendNet,
        feesPaid: income.feesPaid,
      };
    }
    return map;
  }, [portfolios, allAssets, allTxs, prices]);

  // ── Aggregate stats ────────────────────────────────────────────────────────

  const aggregate = useMemo(() => {
    const active = portfolios.filter(p => !p.archived);
    let totalValue = 0, totalCost = 0, totalReturn = 0, assetCount = 0, dividendNet = 0;
    for (const p of active) {
      const s = portfolioStats[p.id];
      if (!s) continue;
      totalValue  += s.totalValue;
      totalCost   += s.totalCost;
      totalReturn += s.totalReturn;
      assetCount  += s.assetCount;
      dividendNet += s.dividendNet;
    }
    return { totalValue, totalCost, totalReturn, assetCount, dividendNet, count: active.length };
  }, [portfolios, portfolioStats]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const startCreate = () => {
    setCreating(true);
    setNewName('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const confirmCreate = () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const id = crypto.randomUUID();
    setInvestment('investmentPortfolios', [...portfolios, { id, name, currency: 'NZD', costBasisMethod: 'average', archived: false, createdAt: today() }]);
    setInvestment('selectedPortfolioId', id);
    setCreating(false);
  };

  const renamePortfolio = (id, name) => {
    setInvestment('investmentPortfolios', portfolios.map(p => p.id === id ? { ...p, name } : p));
  };

  const archivePortfolio = (id, archived) => {
    setInvestment('investmentPortfolios', portfolios.map(p => p.id === id ? { ...p, archived } : p));
    // If archiving the selected portfolio, switch to another active one
    if (archived && selectedPortfolioId === id) {
      const next = portfolios.find(p => p.id !== id && !p.archived);
      setInvestment('selectedPortfolioId', next?.id ?? null);
    }
    // If unarchiving, select it
    if (!archived) {
      setInvestment('selectedPortfolioId', id);
    }
  };

  const requestDelete = (id) => {
    const portfolio = portfolios.find(p => p.id === id);
    if (!portfolio) return;
    const invState = {
      investmentPortfolios, selectedPortfolioId,
      investments, investmentContributions, investmentDividends,
      investmentAssets, investmentTransactions, priceCache,
    };
    const deps = getPortfolioDependents(invState, id);
    const msg = portfolioDeleteMessage(portfolio.name, deps);
    setConfirmTarget({ id, message: msg, invState });
  };

  const executeDelete = () => {
    if (confirmTarget) mergeInvestment(cascadeDeletePortfolio(confirmTarget.invState, confirmTarget.id));
    setConfirmTarget(null);
  };

  const selectPortfolio = (id) => {
    setInvestment('selectedPortfolioId', id);
  };

  // ── Split portfolios ───────────────────────────────────────────────────────

  const activePortfolios  = portfolios.filter(p => !p.archived);
  const archivedPortfolios = portfolios.filter(p => p.archived);

  const isAggGain = aggregate.totalReturn >= 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-content">

      {/* ── Aggregate summary ── */}
      {activePortfolios.length > 1 && (
        <div className="fn-summary">
          <StatTile label="Total Value" value={fmt(aggregate.totalValue)} />
          <StatTile label="Total Cost" value={fmt(aggregate.totalCost)} />
          <StatTile
            label="Total Return"
            value={`${isAggGain ? '+' : '−'}${fmt(aggregate.totalReturn)}`}
            valueClassName={isAggGain ? 'green' : 'red'}
          />
          <StatTile label="Total Assets" value={String(aggregate.assetCount)} />
          <StatTile label="Dividends" value={fmt(aggregate.dividendNet)} valueClassName="green" />
          <StatTile label="Portfolios" value={String(aggregate.count)} />
        </div>
      )}

      {/* ── Active portfolios ── */}
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="layers" size={15} /> Portfolios</>}
          subtitle={`${activePortfolios.length} active${archivedPortfolios.length > 0 ? ` · ${archivedPortfolios.length} archived` : ''}`}
          actions={
            <button className="btn-ghost small" onClick={startCreate}>+ New Portfolio</button>
          }
        />

        {activePortfolios.length === 0 && !creating && (
          <EmptyState
            icon={<Icon name="layers" size={38} />}
            title="No portfolios yet. Create one to get started."
          />
        )}

        <div className="port-grid">
          {activePortfolios.map(p => (
            <PortfolioCard
              key={p.id}
              portfolio={p}
              stats={portfolioStats[p.id] || { assetCount: 0, totalValue: 0, totalCost: 0, totalReturn: 0 }}
              isSelected={p.id === selectedPortfolioId}
              isArchived={false}
              onSelect={selectPortfolio}
              onRename={renamePortfolio}
              onArchive={archivePortfolio}
              onDelete={requestDelete}
            />
          ))}

          {creating && (
            <div className="port-card creating">
              <input
                ref={inputRef}
                className="port-card-new-input"
                placeholder="Portfolio name…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onBlur={confirmCreate}
                onKeyDown={e => { if (e.key === 'Enter') confirmCreate(); if (e.key === 'Escape') setCreating(false); }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* ── Archived portfolios ── */}
      {archivedPortfolios.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="arrow-down" size={15} /> Archived</>}
            subtitle={`${archivedPortfolios.length} archived portfolio${archivedPortfolios.length !== 1 ? 's' : ''}`}
            actions={
              <button className="btn-ghost small" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Hide' : 'Show'}
              </button>
            }
          />

          {showArchived && (
            <div className="port-grid">
              {archivedPortfolios.map(p => (
                <PortfolioCard
                  key={p.id}
                  portfolio={p}
                  stats={portfolioStats[p.id] || { assetCount: 0, totalValue: 0, totalCost: 0, totalReturn: 0 }}
                  isSelected={false}
                  isArchived={true}
                  onSelect={selectPortfolio}
                  onRename={renamePortfolio}
                  onArchive={archivePortfolio}
                  onDelete={requestDelete}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete portfolio"
        message={confirmTarget?.message || ''}
        onConfirm={executeDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
