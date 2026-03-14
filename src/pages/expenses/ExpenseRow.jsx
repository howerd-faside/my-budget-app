import { memo } from 'react';
import { fmtMoney, fmtMoneyRound } from '../../utils/finance/tax';
import { toFortnightly, annualInterestToFortnightly } from '../../utils/finance/frequency';
import Icon from '../../components/Icon';
import { getCatColor } from '../../utils/categories';

const toFn         = (e) => toFortnightly(e.amount, e.frequency);
const facToFn      = (f) => toFortnightly(f.amount, f.frequency || 'fortnightly');
const facInterestFn = (f) => annualInterestToFortnightly(f.balance, f.rate);

function fixedExpiryStatus(expiry) {
  if (!expiry) return null;
  const exp    = new Date(expiry + '-01');
  const today  = new Date();
  const months = (exp.getFullYear() - today.getFullYear()) * 12 + exp.getMonth() - today.getMonth();
  if (months < 0)  return 'expired';
  if (months <= 6) return 'soon';
  return 'ok';
}

function ExpenseRow({ expense: e, expanded, onToggle, onEdit, onRemove, archived = false }) {
  const isLoan     = e.type === 'loan';
  const isSpending = e.category === 'Spending Money';
  const fn         = toFn(e);
  const catColor   = isSpending ? '#30d158' : getCatColor(e.category);

  return (
    <div className={`expense-row ${isLoan ? 'loan-row' : ''} ${expanded ? 'expanded' : ''} ${archived ? 'archived-row' : ''}`}
      onClick={onToggle}>
      <div className="exp-cat-bar" style={{ background: catColor }} />
      <div className="exp-main">
        <div className="exp-top">
          <div className="exp-info">
            <span className="exp-name">
              {isSpending && e.forPerson && (
                <span className="spending-avatar">{e.forPerson[0]?.toUpperCase()}</span>
              )}
              {e.name}
              {isLoan && <span className="loan-badge">LOAN</span>}
              {archived && <span className="loan-badge" style={{ background: 'var(--text3)' }}>ENDED</span>}
            </span>
            <span className="exp-tags">
              {isSpending ? (
                <>
                  {e.forPerson && <span className="tag green">{e.forPerson}</span>}
                  <span className="tag green">Spending Money</span>
                  <span className="tag">{e.frequency}</span>
                </>
              ) : (
                <>
                  <span className="tag">{e.category}</span>
                  {isLoan && e.lender && <span className="tag teal">{e.lender}</span>}
                  {isLoan && <span className="tag">{(e.facilities || []).length} split{(e.facilities || []).length !== 1 ? 's' : ''}</span>}
                  {!isLoan && <span className="tag">{e.frequency}</span>}
                  {!isLoan && e.paymentMethod && <span className="tag">{e.paymentMethod}</span>}
                  {!isLoan && e.ddDay && <span className="tag teal">DD day {e.ddDay}</span>}
                  {!isLoan && (e.subtype === 'variable' || e.type === 'variable') && <span className="tag amber">variable</span>}
                </>
              )}
              {e.startDate && <span className="tag">from {e.startDate.slice(0, 7)}</span>}
              {e.endDate && <span className="tag">until {e.endDate.slice(0, 7)}</span>}
            </span>
          </div>
          <div className="exp-right">
            <div className="exp-amounts">
              {!isLoan ? (
                <>
                  <span className="exp-amount red">
                    {fmtMoney(e.amount)}
                    <span className="exp-freq">/{e.frequency === 'fortnightly' ? 'fn' : e.frequency.slice(0, 2)}</span>
                  </span>
                  <span className="exp-fn">{fmtMoneyRound(fn)}/fn</span>
                </>
              ) : (
                <span className="exp-amount red">{fmtMoneyRound(fn)}/fn</span>
              )}
            </div>
            <div className="exp-actions">
              <button className="btn-icon" onClick={onEdit} aria-label="Edit expense"><Icon name="pencil" /></button>
              <button className="btn-icon danger" onClick={onRemove} aria-label="Delete expense"><Icon name="trash" /></button>
            </div>
          </div>
        </div>

        {/* Inline expanded detail */}
        {expanded && (
          <div className="exp-detail">
            {e.notes && (
              <div className="exp-detail-notes">{e.notes}</div>
            )}

            {/* Standard expense details */}
            {!isLoan && (
              <div className="exp-detail-grid">
                {e.paymentMethod && !isSpending && (
                  <div className="edg-item">
                    <span className="edg-label">Payment</span>
                    <span className="edg-val">{e.paymentMethod}{e.ddDay ? ` — day ${e.ddDay}` : ''}</span>
                  </div>
                )}
                <div className="edg-item">
                  <span className="edg-label">Monthly</span>
                  <span className="edg-val mono">{fmtMoneyRound(fn * 26 / 12)}</span>
                </div>
                <div className="edg-item">
                  <span className="edg-label">Annual</span>
                  <span className="edg-val mono">{fmtMoneyRound(fn * 26)}</span>
                </div>
              </div>
            )}

            {/* Loan facilities inline */}
            {isLoan && (
              <div className="facility-list">
                {(e.facilities || []).map(f => {
                  const status = f.rateType === 'fixed' ? fixedExpiryStatus(f.fixedTermExpiry) : null;
                  const intFn  = facInterestFn(f);
                  const repFn  = facToFn(f);
                  return (
                    <div key={f.id} className={`facility-row${status === 'expired' ? ' fac-expired' : status === 'soon' ? ' fac-expiring' : ''}`}>
                      <div className="fac-left">
                        <span className={`fac-type-dot ${f.rateType}`} />
                        <div className="fac-info">
                          <span className="fac-label">{f.label || `${f.rateType} facility`}</span>
                          <span className="fac-meta">
                            {f.balance ? `$${Number(f.balance).toLocaleString('en-NZ')} ` : ''}
                            {f.rate ? `@ ${f.rate}% p.a.` : ''}
                            {f.rateType === 'fixed' && f.fixedTermExpiry ? ` · fixed to ${f.fixedTermExpiry}` : ''}
                            {status === 'expired' ? ' · expired' : status === 'soon' ? ' · expiring soon' : ''}
                            {` · ${f.repaymentType}`}
                          </span>
                        </div>
                      </div>
                      <div className="fac-right">
                        <span className="fac-repay">{fmtMoneyRound(repFn)}/fn</span>
                        {f.balance && f.rate && (
                          <span className="fac-interest">~{fmtMoneyRound(intFn)} int.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="fac-total-row">
                  <span>Total repayment</span>
                  <span className="fac-repay red">{fmtMoneyRound(fn)}/fn</span>
                </div>
              </div>
            )}

            {/* Change history */}
            {(e.history || []).length > 0 && (
              <div className="change-history">
                <div className="ch-label">Change History</div>
                {(e.history || []).map((h, i) => (
                  <div key={i} className="ch-row">
                    <span className="ch-date">{h.date}</span>
                    <span className="ch-change">
                      <span className="red">{fmtMoney(h.oldAmount)}</span>
                      <span className="ch-arrow">→</span>
                      <span className="green">{fmtMoney(h.newAmount)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ExpenseRow);
