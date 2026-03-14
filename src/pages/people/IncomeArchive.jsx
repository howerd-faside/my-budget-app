import { memo } from 'react';
import { calcNetPay, fmtMoneyRound } from '../../utils/finance/tax';
import { Card } from '../../components/ui';

function IncomeArchive({ archive, isOpen, onToggle }) {
  if (archive.length === 0) return null;

  return (
    <Card variant="section">
      <div className="section-header"
        style={{ cursor: 'pointer' }}
        onClick={onToggle}>
        <h3 style={{ color: 'var(--text3)', fontWeight: 500 }}>
          Income History
          <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 6 }}>· {archive.length}</span>
        </h3>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: isOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s', color: 'var(--text3)' }}>
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </div>
      {isOpen && (
        <div className="fn-list" style={{ opacity: 0.8 }}>
          {archive.map(item => {
            const pay = calcNetPay({ ...item.person, grossAnnual: +item.grossAnnual || 0 });
            return (
              <div key={item.id} className="fn-row">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.personName}</div>
                  <div className="text3" style={{ fontSize: 12, marginTop: 2 }}>
                    {item.kind === 'role'
                      ? `${item.employer || 'Unknown employer'}${item.role ? ` · ${item.role}` : ''}`
                      : `${item.label || 'Income event'}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 14 }}>{fmtMoneyRound(pay.netFortnightly)}/fn</div>
                  <div className="text3" style={{ fontSize: 11, marginTop: 2 }}>
                    {item.startDate} → {item.endDate}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default memo(IncomeArchive);
