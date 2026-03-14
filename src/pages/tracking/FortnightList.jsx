import { fmtMoney, fmtMoneyRound } from '../../utils/finance/tax';
import Icon from '../../components/Icon';
import { SectionHeader, Card } from '../../components/ui';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * FortnightList — renders the 26 pay-period rows with inline ad-hoc transactions.
 *
 * Props:
 *   year          — selected year
 *   fortnights    — the 26-fortnight row array
 *   currentFnIdx  — index of "now" fortnight (-1 if not current year)
 *   fnIncome      — base fortnightly income (for event detection)
 *   onOpenTxModal — (fnIdx) => void
 *   onRemoveTx    — (fnIdx, txId) => void
 */
export default function FortnightList({
  year, fortnights, currentFnIdx, fnIncome,
  onOpenTxModal, onRemoveTx,
}) {
  const today = new Date();

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="clipboard" size={15} /> Pay Periods — {year}</>}
        actions={<span className="text3" style={{ fontSize: 11 }}>26 fortnights</span>}
      />
      <div className="fn-list">
        {fortnights.map(f => {
          const isCurrent = f.i === currentFnIdx;
          const isPast    = f.end < today;
          const txs       = f.ftData.adhocTransactions || [];
          const startM    = f.start.getMonth();
          const endM      = f.end.getMonth();
          const label     = startM === endM
            ? `${MONTHS[startM]} ${f.start.getDate()}–${f.end.getDate()}`
            : `${MONTHS[startM]} ${f.start.getDate()} – ${MONTHS[endM]} ${f.end.getDate()}`;
          const incomeChanged = Math.abs(f.fnIncomeAt - fnIncome) > 0.5;

          return (
            <div key={f.i} className={`fn-row ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}>
              <div className="fn-main">
                <div className="fn-left">
                  <div className="fn-num">#{f.i + 1}</div>
                  <div className="fn-dates">
                    <div className="fn-dates-primary">
                      <span className="fn-label">{label}</span>
                      {isCurrent && <span className="fn-badge current-badge">Now</span>}
                      {txs.length > 0 && <span className="fn-badge tx-badge">{txs.length} extra</span>}
                    </div>
                    {incomeChanged && (
                      <div className="fn-event-note">⚑ {fmtMoneyRound(f.fnIncomeAt)} /fn</div>
                    )}
                  </div>
                </div>
                <div className="fn-right">
                  {f.adhoc !== 0 && (
                    <span className={`fn-adhoc ${f.adhoc >= 0 ? 'green' : 'red'}`}>{fmtMoney(f.adhoc)}</span>
                  )}
                  <span className={`fn-net ${(isPast && f.balance < 0) ? '' : f.actual >= 0 ? 'green' : 'red'}`}>{fmtMoneyRound(isPast && f.balance < 0 ? 0 : f.actual)}</span>
                  <span className="fn-balance">{fmtMoneyRound(isPast ? Math.max(0, f.balance) : f.balance)}</span>
                  <button
                    className="fn-add-btn"
                    onClick={() => onOpenTxModal(f.i)}
                    title="Log ad-hoc transaction"
                  >
                    <Icon name="plus" size={12} />
                  </button>
                </div>
              </div>

              {txs.length > 0 && (
                <div className="fn-tx-list">
                  {txs.map(tx => (
                    <div key={tx.id} className="fn-tx-row">
                      <span className="fn-tx-date">{tx.date}</span>
                      <span className="tag fn-tx-cat">{tx.category}</span>
                      <span className="fn-tx-desc">{tx.description}</span>
                      {tx.note && <span className="fn-tx-note">{tx.note}</span>}
                      <span className={`fn-tx-amount ${tx.amount >= 0 ? 'green' : 'red'}`}>{fmtMoney(tx.amount)}</span>
                      <button className="btn-icon danger small" onClick={() => onRemoveTx(f.i, tx.id)} aria-label="Remove transaction">
                        <Icon name="close" size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
