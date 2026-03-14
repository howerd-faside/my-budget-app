import { memo } from 'react';
import { calcNetPay, fmtMoneyRound, fmtMoney } from '../../utils/finance/tax';
import { getPersonIncomeAt } from '../../utils/finance/savings';
import Icon from '../../components/Icon';

function PersonCard({ person: p, isOpen, onToggle, onEdit, onRemove, today }) {
  const pay = calcNetPay(p);
  const hasSecondary = (p.secondaryIncomes || []).length > 0;
  const activeEvent = getPersonIncomeAt(p, today);
  const hasEvent = !!activeEvent.eventLabel;
  const eventPay = hasEvent ? calcNetPay({ ...p, grossAnnual: activeEvent.grossAnnual }) : null;
  const sortedRoles = [...(p.employmentHistory || [])].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const currentRole = sortedRoles.find(r => !r.endDate) || null;

  return (
    <div className="person-card">
      <div className="person-header">
        <div className="person-avatar">{p.name?.[0]?.toUpperCase() || '?'}</div>
        <div className="person-info">
          <div className="person-name">{p.name || 'Unnamed'}</div>
          {currentRole && (
            <div className="person-employer">
              {currentRole.employer}{currentRole.role ? ` · ${currentRole.role}` : ''}
              {currentRole.startDate && <span className="emp-since"> · since {currentRole.startDate}</span>}
            </div>
          )}
          <div className="person-meta">{p.taxCode} · KS {p.kiwiSaverRate > 0 ? `${p.kiwiSaverRate}%` : 'not enrolled'} · {p.payFrequency}</div>
        </div>
        <div className="person-actions">
          <button className="btn-icon" onClick={onEdit} title="Edit" aria-label="Edit person"><Icon name="pencil" /></button>
          <button className="btn-icon danger" onClick={onRemove} title="Remove" aria-label="Delete person"><Icon name="trash" /></button>
        </div>
      </div>

      <div className="person-hero">
        <div className="ph-stat primary">
          <span className="ph-label">{hasEvent ? 'Current Net /fn' : 'Net Fortnightly'}</span>
          <span className={`ph-value ${hasEvent ? 'amber' : 'teal'}`}>
            {fmtMoneyRound(hasEvent ? eventPay.netFortnightly : pay.netFortnightly)}
          </span>
        </div>
        <div className="ph-divider" />
        <div className="ph-stat">
          <span className="ph-label">{hasEvent ? 'Base Gross' : 'Gross Annual'}</span>
          <span className="ph-value">{fmtMoneyRound(p.grossAnnual)}</span>
        </div>
      </div>

      <div className="deduction-pills">
        <span className="dpill red">Tax −{fmtMoneyRound(pay.taxAnnual / 26)}</span>
        <span className="dpill amber">ACC −{fmtMoneyRound(pay.accAnnual / 26)}</span>
        {p.kiwiSaverRate > 0 && <span className="dpill teal">KS {p.kiwiSaverRate}%</span>}
        {pay.studentLoanAnnual > 0 && <span className="dpill purple">SL −{fmtMoneyRound(pay.studentLoanAnnual / 26)}</span>}
        {hasSecondary && <span className="dpill green">+ secondary</span>}
        {(p.incomeEvents || []).length > 0 && (
          <span className="dpill amber">⚑ {(p.incomeEvents || []).length} event{(p.incomeEvents || []).length > 1 ? 's' : ''}</span>
        )}
        {(p.employmentHistory || []).length > 0 && (
          <span className="dpill teal">{(p.employmentHistory || []).length} role{(p.employmentHistory || []).length > 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Active income event banner */}
      {hasEvent && (
        <div className="income-event-banner">
          <span className="iev-dot" />
          <span className="iev-label">{activeEvent.eventLabel}</span>
          <span className="iev-amount">{fmtMoneyRound(eventPay.netFortnightly)}/fn</span>
        </div>
      )}

      <button className="breakdown-toggle" onClick={onToggle}>
        <span className="bt-icon">{isOpen ? '▲' : '▼'}</span>
        {isOpen ? 'Hide breakdown' : 'Tax breakdown'}
      </button>

      {isOpen && (
        <div className="tax-breakdown">
          <div className="tb-row"><span>Gross Annual</span><span>{fmtMoneyRound(pay.grossAnnual)}</span></div>
          <div className="tb-row red"><span>Income Tax</span><span>−{fmtMoneyRound(pay.taxAnnual)}</span></div>
          <div className="tb-row red"><span>ACC Levy</span><span>−{fmtMoneyRound(pay.accAnnual)}</span></div>
          <div className="tb-row red"><span>KiwiSaver ({p.kiwiSaverRate}%)</span><span>−{fmtMoneyRound(pay.kiwiSaverAnnual)}</span></div>
          {pay.studentLoanAnnual > 0 && (
            <div className="tb-row red"><span>Student Loan</span><span>−{fmtMoneyRound(pay.studentLoanAnnual)}</span></div>
          )}
          <div className="tb-divider" />
          <div className="tb-row bold"><span>Net Annual</span><span>{fmtMoneyRound(pay.netAnnual)}</span></div>
          <div className="tb-row bold green"><span>Net Fortnightly</span><span>{fmtMoneyRound(pay.netFortnightly)}</span></div>
          <div className="tb-row"><span>Effective Tax Rate</span><span>{pay.effectiveRate.toFixed(1)}%</span></div>
          {hasSecondary && (
            <>
              <div className="tb-divider" />
              <div className="tb-section-label">Secondary Income (net)</div>
              {p.secondaryIncomes.map(s => (
                <div key={s.id} className="tb-row teal">
                  <span>{s.name} ({s.frequency})</span>
                  <span>+{fmtMoney(s.amount)}</span>
                </div>
              ))}
            </>
          )}
          {(p.incomeEvents || []).length > 0 && (
            <>
              <div className="tb-divider" />
              <div className="tb-section-label">Income Events</div>
              {p.incomeEvents.map(e => {
                const epay = calcNetPay({ ...p, grossAnnual: +e.grossAnnual });
                const isActive = new Date(e.startDate) <= today && (!e.endDate || new Date(e.endDate) > today);
                return (
                  <div key={e.id} className={`tb-row ${isActive ? 'amber' : ''}`}>
                    <span>⚑ {e.label} {e.startDate ? `(from ${e.startDate})` : ''}</span>
                    <span>{fmtMoneyRound(epay.netFortnightly)}/fn</span>
                  </div>
                );
              })}
            </>
          )}
          {(p.employmentHistory || []).length > 0 && (
            <>
              <div className="tb-divider" />
              <div className="tb-section-label">Employment History</div>
              {[...(p.employmentHistory || [])].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map(r => {
                const rpay = calcNetPay({ ...p, grossAnnual: +r.grossAnnual });
                const isCurrent = !r.endDate;
                return (
                  <div key={r.id} className={`tb-row ${isCurrent ? 'teal' : ''}`}>
                    <span>
                      {r.employer || 'Unknown'}{r.role ? ` · ${r.role}` : ''}
                      <span className="tb-date-range"> {r.startDate}–{r.endDate || 'present'}</span>
                    </span>
                    <span>{fmtMoneyRound(rpay.netFortnightly)}/fn</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(PersonCard);
