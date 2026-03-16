import { calcNetPay, TAX_CODES, KIWISAVER_RATES, PAY_FREQUENCIES, fmtMoneyRound } from '../../utils/finance/tax';
import Icon from '../../components/Icon';
import Portal from '../../components/Portal';

export default function PersonModal({
  editing, form, setForm, errors = {},
  onClose, onSave,
  addRole, updateRole, removeRole,
  addEvent, updateEvent, removeEvent,
  addSecondary, updateSecondary, removeSecondary,
}) {
  if (!editing) return null;

  const formCurrentRole  = (form.employmentHistory || []).find(r => !r.endDate) || null;
  const formEffectiveGross = formCurrentRole ? +formCurrentRole.grossAnnual : +form.grossAnnual;

  return (
    <Portal>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editing === 'new' ? 'Add Person' : 'Edit Person'}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>

        <div className="modal-body">
          <div className="form-grid">
            <div className="form-group full">
              <label>Full Name</label>
              <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Sarah" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
            <div className="form-group">
              <label>Gross Annual Income ($)</label>
              {formCurrentRole ? (
                <>
                  <input
                    className="input mono"
                    type="text"
                    readOnly
                    value={fmtMoneyRound(+formCurrentRole.grossAnnual || 0)}
                    style={{ opacity: 0.55, cursor: 'default', background: 'var(--bg)' }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--text3)', marginTop: -2 }}>
                    From {formCurrentRole.employer || 'current role'} below
                  </span>
                </>
              ) : (
                <>
                  <input className={`input mono${errors.grossAnnual ? ' input-error' : ''}`} type="number" placeholder="0" value={form.grossAnnual}
                    onChange={e => setForm(f => ({ ...f, grossAnnual: e.target.value }))} />
                  {errors.grossAnnual && <span className="field-error">{errors.grossAnnual}</span>}
                </>
              )}
            </div>
            <div className="form-group">
              <label>Tax Code</label>
              <select className="input" value={form.taxCode}
                onChange={e => setForm(f => ({ ...f, taxCode: e.target.value }))}>
                {TAX_CODES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>KiwiSaver Rate</label>
              <select className="input" value={form.kiwiSaverRate}
                onChange={e => setForm(f => ({ ...f, kiwiSaverRate: +e.target.value }))}>
                {KIWISAVER_RATES.map(r => <option key={r} value={r}>{r === 0 ? 'Not enrolled' : `${r}%`}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Pay Frequency</label>
              <select className="input" value={form.payFrequency}
                onChange={e => setForm(f => ({ ...f, payFrequency: e.target.value }))}>
                {PAY_FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Live preview */}
          {formEffectiveGross > 0 && (() => {
            const pay = calcNetPay({ ...form, grossAnnual: formEffectiveGross });
            return (
              <div className="calc-preview">
                <span>Net Fortnightly: <strong className="teal">{fmtMoneyRound(pay.netFortnightly)}</strong></span>
                <span>Tax Rate: <strong>{pay.effectiveRate.toFixed(1)}%</strong></span>
              </div>
            );
          })()}

          {/* Employment History */}
          <div className="secondary-header" style={{ marginTop: 16 }}>
            <span className="form-section-label">Employment History</span>
            <button className="btn-ghost small" onClick={addRole}>+ Add Role</button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Track roles over time. Leave end date blank for your current job. Each fortnight uses the salary from whichever role was active then.
          </p>

          {(form.employmentHistory || []).length === 0 && (
            <p style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 8 }}>
              No roles added — all fortnights use the Gross Annual field above.
            </p>
          )}

          {[...(form.employmentHistory || [])].sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)).map(r => {
            const previewPay = r.grossAnnual > 0 ? calcNetPay({ ...form, grossAnnual: +r.grossAnnual }) : null;
            const isCurrent = !r.endDate;
            return (
              <div key={r.id} className="income-event-row">
                <div className="ier-main">
                  <input className="input" placeholder="Employer" value={r.employer}
                    onChange={v => updateRole(r.id, 'employer', v.target.value)} style={{ flex: 2 }} />
                  <input className="input" placeholder="Role (optional)" value={r.role}
                    onChange={v => updateRole(r.id, 'role', v.target.value)} style={{ flex: 2 }} />
                  <input className="input mono" type="number" placeholder="Gross /yr" value={r.grossAnnual}
                    onChange={v => updateRole(r.id, 'grossAnnual', v.target.value)} style={{ flex: 1 }} />
                  <button className="btn-icon danger small" onClick={() => removeRole(r.id)} aria-label="Remove role"><Icon name="close" size={12} /></button>
                </div>
                <div className="ier-dates">
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label style={{ fontSize: 10, color: 'var(--text3)' }}>Start Date</label>
                    <input className="input" type="date" value={r.startDate}
                      onChange={v => updateRole(r.id, 'startDate', v.target.value)} />
                  </div>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label style={{ fontSize: 10, color: 'var(--text3)' }}>
                      End Date {isCurrent && <span className="fn-badge current-badge" style={{ fontSize: 9, marginLeft: 4 }}>current</span>}
                    </label>
                    <input className="input" type="date" value={r.endDate}
                      onChange={v => updateRole(r.id, 'endDate', v.target.value)} />
                  </div>
                  {previewPay && (
                    <div className="ier-preview">
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>Net /fn</span>
                      <span className={`mono ${isCurrent ? 'teal' : ''}`} style={{ fontSize: 14 }}>{fmtMoneyRound(previewPay.netFortnightly)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Income Events */}
          <div className="secondary-header" style={{ marginTop: 16 }}>
            <span className="form-section-label">Income Events</span>
            <button className="btn-ghost small" onClick={addEvent}>+ Add Event</button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Use events for planned income changes within a role (e.g. maternity leave, pay rise). These override employment history for their period.
          </p>

          {(form.incomeEvents || []).map(e => {
            const previewPay = e.grossAnnual > 0 ? calcNetPay({ ...form, grossAnnual: +e.grossAnnual }) : null;
            return (
              <div key={e.id} className="income-event-row">
                <div className="ier-main">
                  <input className="input" placeholder="Label (e.g. Maternity Leave)" value={e.label}
                    onChange={v => updateEvent(e.id, 'label', v.target.value)} style={{ flex: 2 }} />
                  <input className="input mono" type="number" placeholder="Gross /yr" value={e.grossAnnual}
                    onChange={v => updateEvent(e.id, 'grossAnnual', v.target.value)} style={{ flex: 1 }} />
                  <button className="btn-icon danger small" onClick={() => removeEvent(e.id)} aria-label="Remove income event"><Icon name="close" size={12} /></button>
                </div>
                <div className="ier-dates">
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label style={{ fontSize: 10, color: 'var(--text3)' }}>From</label>
                    <input className="input" type="date" value={e.startDate}
                      onChange={v => updateEvent(e.id, 'startDate', v.target.value)} />
                  </div>
                  <div className="form-group" style={{ flex: 1, margin: 0 }}>
                    <label style={{ fontSize: 10, color: 'var(--text3)' }}>To (optional)</label>
                    <input className="input" type="date" value={e.endDate}
                      onChange={v => updateEvent(e.id, 'endDate', v.target.value)} />
                  </div>
                  {previewPay && (
                    <div className="ier-preview">
                      <span style={{ fontSize: 10, color: 'var(--text3)' }}>Net /fn</span>
                      <span className="mono amber" style={{ fontSize: 14 }}>{fmtMoneyRound(previewPay.netFortnightly)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Secondary Incomes */}
          <div className="secondary-header" style={{ marginTop: 16 }}>
            <span className="form-section-label">Secondary Incomes</span>
            <button className="btn-ghost small" onClick={addSecondary}>+ Add</button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
            Net amounts added on top (e.g. freelance, rental cash, side work).
          </p>

          {(form.secondaryIncomes || []).map(s => (
            <div key={s.id} className="secondary-row">
              <input className="input" placeholder="Name (e.g. Freelance)" value={s.name}
                onChange={e => updateSecondary(s.id, 'name', e.target.value)} />
              <input className="input mono" type="number" placeholder="Net amount" value={s.amount}
                onChange={e => updateSecondary(s.id, 'amount', +e.target.value)} />
              <select className="input" value={s.frequency}
                onChange={e => updateSecondary(s.id, 'frequency', e.target.value)}>
                {PAY_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <button className="btn-icon danger small" onClick={() => removeSecondary(s.id)} aria-label="Remove secondary income"><Icon name="close" size={12} /></button>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
