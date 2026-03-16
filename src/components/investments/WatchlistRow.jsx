import Icon from '../Icon';
import { calcPriceDelta, calcTargetGap } from '../../utils/finance/watchlist';
import { fmtCurrency as fmt } from '../../utils/format';

// ── Row ──────────────────────────────────────────────────────────────────────

export default function WatchlistRow({
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
                <span className="tag sm">Target {fmt(item.targetPrice)}</span>
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

// ── Detail pane ──────────────────────────────────────────────────────────────

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
