import { fmtMoneyRound } from '../../utils/finance/tax';
import { toFortnightly, annualInterestToFortnightly, fnToAnnual, fnToMonthly } from '../../utils/finance/frequency';
import { FREQUENCIES, PAYMENT_METHODS } from '../../models/Expense';
import { EXPENSE_GROUPS } from '../../utils/categories';
import Icon from '../../components/Icon';
import Portal from '../../components/Portal';

const PAYMENT_TYPES = PAYMENT_METHODS;
const DD_DAYS       = Array.from({ length: 28 }, (_, i) => i + 1);

const toFn          = (e) => toFortnightly(e.amount, e.frequency);
const facToFn       = (f) => toFortnightly(f.amount, f.frequency || 'fortnightly');
const facInterestFn = (f) => annualInterestToFortnightly(f.balance, f.rate);

export default function ExpenseModal({
  editing, form, setForm, errors,
  onClose, onSave,
  addFacility, updateFacility, removeFacility,
}) {
  if (!editing) return null;

  const facilitiesTotalFn = (facs) => (facs || []).reduce((s, f) => s + facToFn(f), 0);
  const previewFn = form.type === 'loan' ? facilitiesTotalFn(form.facilities) : toFn(form);

  return (
    <Portal>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editing === 'new' ? 'Add Expense' : 'Edit Expense'}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="modal-body">

          {/* Expense type selector */}
          <div className="exp-type-sel">
            <button className={`ets-btn ${form.type === 'standard' ? 'active' : ''}`}
              onClick={() => setForm(f => ({ ...f, type: 'standard', category: f.category === 'Spending Money' ? 'Groceries' : f.category }))}>
              Regular Expense
            </button>
            <button className={`ets-btn ${form.category === 'Spending Money' ? 'active' : ''}`}
              onClick={() => setForm(f => ({ ...f, type: 'standard', category: 'Spending Money', frequency: 'fortnightly', subtype: 'fixed', paymentMethod: 'Bank Transfer' }))}>
              Spending Money
            </button>
            <button className={`ets-btn ${form.type === 'loan' ? 'active' : ''}`}
              onClick={() => setForm(f => ({ ...f, type: 'loan', category: f.category === 'Groceries' || f.category === 'Spending Money' ? 'Mortgage' : f.category }))}>
              Loan / Mortgage
            </button>
          </div>

          {/* SPENDING MONEY */}
          {form.category === 'Spending Money' && form.type !== 'loan' && (
            <div className="form-grid">
              <div className="form-group full">
                <label>Label</label>
                <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Billy's Spending Money" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label>For Person</label>
                <input className="input" placeholder="e.g. Billy" value={form.forPerson}
                  onChange={e => setForm(f => ({ ...f, forPerson: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Amount ($)</label>
                <input className={`input mono${errors.amount ? ' input-error' : ''}`} type="number" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                {errors.amount && <span className="field-error">{errors.amount}</span>}
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select className="input" value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {FREQUENCIES.map(fr => <option key={fr}>{fr}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Start Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                <input className="input" type="date" value={form.startDate || ''}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>End Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                <input className="input" type="date" value={form.endDate || ''}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Notes</label>
                <input className="input" placeholder="Optional details" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          )}

          {/* STANDARD EXPENSE */}
          {form.type !== 'loan' && form.category !== 'Spending Money' && (
            <div className="form-grid">
              <div className="form-group full">
                <label>Expense Name</label>
                <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. Power — Contact Energy" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label>Category</label>
                <select className="input" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_GROUPS.filter(g => g.id !== 'personal').map(g => (
                    <optgroup key={g.id} label={`${g.icon} ${g.label}`}>
                      {g.cats.map(c => <option key={c}>{c}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select className="input" value={form.subtype}
                  onChange={e => setForm(f => ({ ...f, subtype: e.target.value }))}>
                  <option value="fixed">Fixed</option>
                  <option value="variable">Variable (estimate)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Amount ($)</label>
                <input className={`input mono${errors.amount ? ' input-error' : ''}`} type="number" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                {errors.amount && <span className="field-error">{errors.amount}</span>}
              </div>
              <div className="form-group">
                <label>Frequency</label>
                <select className="input" value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {FREQUENCIES.map(fr => <option key={fr}>{fr}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Payment Method</label>
                <select className="input" value={form.paymentMethod}
                  onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                  {PAYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {form.paymentMethod === 'Direct Debit' && (
                <div className="form-group">
                  <label>DD Day of Month</label>
                  <select className="input" value={form.ddDay}
                    onChange={e => setForm(f => ({ ...f, ddDay: e.target.value }))}>
                    <option value="">— Select —</option>
                    {DD_DAYS.map(d => (
                      <option key={d} value={d}>{d}{d===1?'st':d===2?'nd':d===3?'rd':'th'}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Start Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                <input className="input" type="date" value={form.startDate || ''}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>End Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                <input className="input" type="date" value={form.endDate || ''}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Notes</label>
                <input className="input" placeholder="Optional details" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          )}

          {/* LOAN / MORTGAGE */}
          {form.type === 'loan' && (
            <>
              <div className="form-grid">
                <div className="form-group full">
                  <label>Loan Name</label>
                  <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. ANZ Home Loan" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  {errors.name && <span className="field-error">{errors.name}</span>}
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select className="input" value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    <option value="Mortgage">Mortgage</option>
                    <option value="Vehicle Loan">Vehicle Loan</option>
                    <option value="Personal Loan">Personal Loan</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Lender</label>
                  <input className="input" placeholder="e.g. ANZ, ASB, Kiwibank" value={form.lender}
                    onChange={e => setForm(f => ({ ...f, lender: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Start Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input className="input" type="date" value={form.startDate || ''}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>End Date <span className="text3" style={{ fontWeight: 400 }}>(optional)</span></label>
                  <input className="input" type="date" value={form.endDate || ''}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label>Notes</label>
                  <input className="input" placeholder="Optional" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>

              {/* Facilities */}
              <div className="facilities-section">
                <div className="fac-section-header">
                  <span className="form-section-label">Loan Splits / Facilities</span>
                  <button className="btn-ghost small" onClick={addFacility}>+ Add Split</button>
                </div>
                {errors.facilities && <span className="field-error" style={{ marginBottom: 6 }}>{errors.facilities}</span>}

                {form.facilities.length === 0 && (
                  <div className="fac-empty">Add splits to track each fixed/floating portion separately</div>
                )}

                {form.facilities.map((fac, idx) => {
                  const intFn = facInterestFn(fac);
                  return (
                    <div key={fac.id} className="fac-form-card">
                      <div className="fac-form-header">
                        <div className="fac-form-title">
                          <span className={`fac-type-dot ${fac.rateType}`} />
                          <span className="fac-form-num">Split {idx + 1}</span>
                          {fac.rateType && <span className="fac-form-type">{fac.rateType}</span>}
                        </div>
                        <button className="btn-icon danger small" onClick={() => removeFacility(fac.id)} aria-label="Remove facility"><Icon name="close" size={12} /></button>
                      </div>
                      <div className="form-grid">
                        <div className="form-group full">
                          <label>Label</label>
                          <input className="input" placeholder="e.g. Fixed Rate — Main" value={fac.label}
                            onChange={e => updateFacility(fac.id, 'label', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>Outstanding Balance ($)</label>
                          <input className="input mono" type="number" placeholder="0" value={fac.balance}
                            onChange={e => updateFacility(fac.id, 'balance', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>Interest Rate (% p.a.)</label>
                          <input className="input mono" type="number" step="0.01" placeholder="6.85" value={fac.rate}
                            onChange={e => updateFacility(fac.id, 'rate', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label>Rate Type</label>
                          <select className="input" value={fac.rateType}
                            onChange={e => updateFacility(fac.id, 'rateType', e.target.value)}>
                            <option value="fixed">Fixed</option>
                            <option value="floating">Floating</option>
                            <option value="revolving">Revolving Credit</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Repayment Type</label>
                          <select className="input" value={fac.repaymentType}
                            onChange={e => updateFacility(fac.id, 'repaymentType', e.target.value)}>
                            <option value="P&I">Principal &amp; Interest</option>
                            <option value="IO">Interest Only</option>
                          </select>
                        </div>
                        {fac.rateType === 'fixed' && (
                          <div className="form-group">
                            <label>Fixed Term Expiry</label>
                            <input className="input" type="month" value={fac.fixedTermExpiry}
                              onChange={e => updateFacility(fac.id, 'fixedTermExpiry', e.target.value)} />
                          </div>
                        )}
                        <div className="form-group">
                          <label>Fortnightly Repayment ($)</label>
                          <input className="input mono" type="number" step="0.01" placeholder="0.00" value={fac.amount}
                            onChange={e => updateFacility(fac.id, 'amount', e.target.value)} />
                        </div>
                        {fac.balance && fac.rate && (
                          <div className="form-group">
                            <label>Est. Interest component/fn</label>
                            <div className="input fac-calc-preview">
                              <span className="red">{fmtMoneyRound(intFn)}</span>
                              {fac.repaymentType === 'P&I' && fac.amount && (
                                <span className="text3"> · principal ~{fmtMoneyRound(Math.max(0, facToFn(fac) - intFn))}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Live preview */}
          {previewFn > 0 && (
            <div className="calc-preview">
              <span>Fortnightly: <strong className="red">{fmtMoneyRound(previewFn)}</strong></span>
              <span>Monthly: <strong>{fmtMoneyRound(fnToMonthly(previewFn))}</strong></span>
              <span>Annual: <strong>{fmtMoneyRound(fnToAnnual(previewFn))}</strong></span>
            </div>
          )}
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
