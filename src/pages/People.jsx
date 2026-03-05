import { useState } from 'react';
import { useApp, calcFortnightlyIncome, calcFortnightlyAssetIncome, getPersonIncomeAt } from '../store';
import { calcNetPay, TAX_CODES, KIWISAVER_RATES, PAY_FREQUENCIES, fmtMoneyRound, fmtMoney } from '../utils/tax';
import Icon from '../components/Icon';

const EMPTY_PERSON = {
  name: '', grossAnnual: '', taxCode: 'M', kiwiSaverRate: 3,
  payFrequency: 'fortnightly', secondaryIncomes: [], incomeEvents: [],
};

const EMPTY_SECONDARY = { id: '', name: '', amount: '', frequency: 'monthly' };
const EMPTY_EVENT = { id: '', label: '', startDate: '', endDate: '', grossAnnual: '' };

const EMPTY_ASSET = { id: '', name: '', type: 'rental', amount: '', frequency: 'monthly', notes: '' };

const ASSET_TYPES = [
  { value: 'rental',   label: 'Rental Property' },
  { value: 'dividend', label: 'Dividend / Investment' },
  { value: 'business', label: 'Business' },
  { value: 'trust',    label: 'Trust' },
  { value: 'other',    label: 'Other' },
];
const ASSET_TYPE_LABEL = Object.fromEntries(ASSET_TYPES.map(t => [t.value, t.label]));

function toFnAsset(a) {
  const amt = +a.amount || 0;
  if (a.frequency === 'fortnightly') return amt;
  if (a.frequency === 'weekly')      return amt * 2;
  if (a.frequency === 'monthly')     return (amt * 12) / 26;
  if (a.frequency === 'quarterly')   return (amt * 4) / 26;
  if (a.frequency === 'annual')      return amt / 26;
  return amt;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function People() {
  const { state, set } = useApp();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_PERSON);
  const [openCards, setOpenCards] = useState(new Set());

  const openNew = () => { setForm({ ...EMPTY_PERSON, id: uid() }); setEditing('new'); };
  const openEdit = (p) => { setForm({ ...p, incomeEvents: p.incomeEvents || [] }); setEditing(p.id); };
  const close = () => { setEditing(null); setForm(EMPTY_PERSON); };

  const toggleCard = (id) => {
    setOpenCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = () => {
    const pay = calcNetPay({ grossAnnual: +form.grossAnnual, kiwiSaverRate: form.kiwiSaverRate });
    const person = { ...form, grossAnnual: +form.grossAnnual, netFortnightly: pay.netFortnightly };
    if (editing === 'new') {
      set('people', [...state.people, person]);
    } else {
      set('people', state.people.map(p => p.id === form.id ? person : p));
    }
    close();
  };

  const remove = (id) => {
    if (confirm('Remove this person?')) set('people', state.people.filter(p => p.id !== id));
  };

  const addSecondary = () => {
    setForm(f => ({ ...f, secondaryIncomes: [...(f.secondaryIncomes || []), { ...EMPTY_SECONDARY, id: uid() }] }));
  };

  const updateSecondary = (id, field, val) => {
    setForm(f => ({
      ...f,
      secondaryIncomes: f.secondaryIncomes.map(s => s.id === id ? { ...s, [field]: val } : s),
    }));
  };

  const removeSecondary = (id) => {
    setForm(f => ({ ...f, secondaryIncomes: f.secondaryIncomes.filter(s => s.id !== id) }));
  };

  const addEvent = () => {
    setForm(f => ({ ...f, incomeEvents: [...(f.incomeEvents || []), { ...EMPTY_EVENT, id: uid() }] }));
  };

  const updateEvent = (id, field, val) => {
    setForm(f => ({
      ...f,
      incomeEvents: (f.incomeEvents || []).map(e => e.id === id ? { ...e, [field]: val } : e),
    }));
  };

  const removeEvent = (id) => {
    setForm(f => ({ ...f, incomeEvents: (f.incomeEvents || []).filter(e => e.id !== id) }));
  };

  // ── Asset Income state ─────────────────────────────────────────────────────
  const [editingAsset, setEditingAsset] = useState(null);
  const [assetForm, setAssetForm]       = useState(EMPTY_ASSET);

  const openNewAsset  = () => { setAssetForm({ ...EMPTY_ASSET, id: uid() }); setEditingAsset('new'); };
  const openEditAsset = (a) => { setAssetForm({ ...a }); setEditingAsset(a.id); };
  const closeAsset    = () => { setEditingAsset(null); setAssetForm(EMPTY_ASSET); };

  const saveAsset = () => {
    const asset = { ...assetForm, amount: +assetForm.amount };
    if (editingAsset === 'new') {
      set('assetIncomes', [...(state.assetIncomes || []), asset]);
    } else {
      set('assetIncomes', (state.assetIncomes || []).map(a => a.id === assetForm.id ? asset : a));
    }
    closeAsset();
  };

  const removeAsset = (id) => {
    if (confirm('Remove this asset income source?'))
      set('assetIncomes', (state.assetIncomes || []).filter(a => a.id !== id));
  };

  const totalFortnightly = calcFortnightlyIncome(state.people);
  const totalAssetFn     = calcFortnightlyAssetIncome(state.assetIncomes || []);
  const today = new Date();

  return (
    <div className="page-content">
      {state.people.length > 0 && (
        <div className="dash-section">
          <div className="section-header">
            <h3>Income Summary</h3>
            <span className="text3" style={{ fontSize: 11 }}>{state.people.length} earner{state.people.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="fn-summary">
            <div className="fns-item">
              <span>Combined Net /fn</span>
              <span className="mono teal">{fmtMoneyRound(totalFortnightly)}</span>
            </div>
            <div className="fns-item">
              <span>Combined Annual</span>
              <span className="mono">{fmtMoneyRound(totalFortnightly * 26)}</span>
            </div>
            <div className="fns-item">
              <span>Earners</span>
              <span className="mono">{state.people.length}</span>
            </div>
          </div>
        </div>
      )}

      <div className="dash-section">
        <div className="section-header">
          <h3>Income Profiles</h3>
          <button className="btn-ghost small" onClick={openNew}>+ Add Person</button>
        </div>

        <div className="cards-grid">
        {state.people.map(p => {
          const pay = calcNetPay(p);
          const isOpen = openCards.has(p.id);
          const hasSecondary = (p.secondaryIncomes || []).length > 0;
          const activeEvent = getPersonIncomeAt(p, today);
          const hasEvent = !!activeEvent.eventLabel;
          const eventPay = hasEvent ? calcNetPay({ ...p, grossAnnual: activeEvent.grossAnnual }) : null;

          return (
            <div key={p.id} className="person-card">
              <div className="person-header">
                <div className="person-avatar">{p.name?.[0]?.toUpperCase() || '?'}</div>
                <div className="person-info">
                  <div className="person-name">{p.name || 'Unnamed'}</div>
                  <div className="person-meta">{p.taxCode} · KS {p.kiwiSaverRate > 0 ? `${p.kiwiSaverRate}%` : 'not enrolled'} · {p.payFrequency}</div>
                </div>
                <div className="person-actions">
                  <button className="btn-icon" onClick={() => openEdit(p)} title="Edit"><Icon name="pencil" /></button>
                  <button className="btn-icon danger" onClick={() => remove(p.id)} title="Remove"><Icon name="trash" /></button>
                </div>
              </div>

              {/* Active income event banner */}
              {hasEvent && (
                <div className="income-event-banner">
                  <span className="iev-dot" />
                  <span className="iev-label">{activeEvent.eventLabel}</span>
                  <span className="iev-amount">{fmtMoneyRound(eventPay.netFortnightly)}/fn</span>
                </div>
              )}

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
              </div>

              <button className="breakdown-toggle" onClick={() => toggleCard(p.id)}>
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
                </div>
              )}
            </div>
          );
        })}

        {state.people.length === 0 && (
          <div className="empty-state">
            <div className="es-icon">👤</div>
            <div className="es-text">No income profiles yet</div>
            <button className="btn-primary" onClick={openNew}>Add your first person</button>
          </div>
        )}
        </div>
      </div>

      {/* ── ASSET INCOME ─────────────────────────────────────────────────── */}
      <div className="dash-section">
        <div className="section-header">
          <h3>Asset Income</h3>
          <button className="btn-ghost small" onClick={openNewAsset}>+ Add Asset</button>
        </div>

        {(state.assetIncomes || []).length > 0 && (
          <div className="fn-summary">
            <div className="fns-item">
              <span>Asset Income /fn</span>
              <span className="mono teal">{fmtMoneyRound(totalAssetFn)}</span>
            </div>
            <div className="fns-item">
              <span>Annual</span>
              <span className="mono">{fmtMoneyRound(totalAssetFn * 26)}</span>
            </div>
            <div className="fns-item">
              <span>Sources</span>
              <span className="mono">{(state.assetIncomes || []).length}</span>
            </div>
          </div>
        )}

        <div className="cards-grid">
          {(state.assetIncomes || []).map(a => (
            <div key={a.id} className="asset-card">
              <div className="asset-header">
                <div>
                  <div className="asset-name">{a.name}</div>
                  <span className="asset-type-tag">{ASSET_TYPE_LABEL[a.type] || a.type}</span>
                </div>
                <div className="person-actions">
                  <button className="btn-icon" onClick={() => openEditAsset(a)} title="Edit"><Icon name="pencil" /></button>
                  <button className="btn-icon danger" onClick={() => removeAsset(a.id)} title="Remove"><Icon name="trash" /></button>
                </div>
              </div>
              <div className="asset-amount">
                <span className="mono teal">{fmtMoneyRound(toFnAsset(a))}</span>
                <span className="text3"> /fn</span>
              </div>
              <div className="asset-detail">
                <span className="text3">{fmtMoneyRound(+a.amount || 0)} {a.frequency}</span>
                <span className="mono text3">{fmtMoneyRound(toFnAsset(a) * 26)}/yr</span>
              </div>
              {a.notes && <div className="asset-notes">{a.notes}</div>}
            </div>
          ))}

          {(state.assetIncomes || []).length === 0 && (
            <div className="empty-state">
              <div className="es-icon">🏠</div>
              <div className="es-text">No asset income yet — add rental, dividend or other sources</div>
              <button className="btn-primary" onClick={openNewAsset}>Add your first asset</button>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL ── */}
      {editing && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editing === 'new' ? 'Add Person' : 'Edit Person'}</h3>
              <button className="btn-icon" onClick={close}><Icon name="close" /></button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Full Name</label>
                  <input className="input" placeholder="e.g. Sarah" value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Gross Annual Income ($)</label>
                  <input className="input mono" type="number" placeholder="0" value={form.grossAnnual}
                    onChange={e => setForm(f => ({ ...f, grossAnnual: e.target.value }))} />
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
              {form.grossAnnual > 0 && (() => {
                const pay = calcNetPay({ grossAnnual: +form.grossAnnual, kiwiSaverRate: form.kiwiSaverRate });
                return (
                  <div className="calc-preview">
                    <span>Net Fortnightly: <strong className="teal">{fmtMoneyRound(pay.netFortnightly)}</strong></span>
                    <span>Tax Rate: <strong>{pay.effectiveRate.toFixed(1)}%</strong></span>
                  </div>
                );
              })()}

              {/* Secondary incomes */}
              <div className="secondary-header">
                <span className="form-section-label">Secondary Incomes</span>
                <button className="btn-ghost small" onClick={addSecondary}>+ Add</button>
              </div>

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
                  <button className="btn-icon danger small" onClick={() => removeSecondary(s.id)}><Icon name="close" size={12} /></button>
                </div>
              ))}

              {/* Income Events */}
              <div className="secondary-header" style={{ marginTop: 16 }}>
                <span className="form-section-label">Income Events</span>
                <button className="btn-ghost small" onClick={addEvent}>+ Add Event</button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
                Use events for planned income changes (e.g. maternity leave, pay rise). Past fortnights are unaffected.
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
                      <button className="btn-icon danger small" onClick={() => removeEvent(e.id)}><Icon name="close" size={12} /></button>
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
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!form.name || !form.grossAnnual}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSET MODAL ── */}
      {editingAsset && (
        <div className="modal-overlay" onClick={closeAsset}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAsset === 'new' ? 'Add Asset Income' : 'Edit Asset Income'}</h3>
              <button className="btn-icon" onClick={closeAsset}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full">
                  <label>Asset Name</label>
                  <input className="input" placeholder="e.g. 5 Smith Street" value={assetForm.name}
                    onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select className="input" value={assetForm.type}
                    onChange={e => setAssetForm(f => ({ ...f, type: e.target.value }))}>
                    {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Income Amount ($)</label>
                  <input className="input mono" type="number" placeholder="0" value={assetForm.amount}
                    onChange={e => setAssetForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Frequency</label>
                  <select className="input" value={assetForm.frequency}
                    onChange={e => setAssetForm(f => ({ ...f, frequency: e.target.value }))}>
                    {['weekly', 'fortnightly', 'monthly', 'quarterly', 'annual'].map(fr => (
                      <option key={fr} value={fr}>{fr.charAt(0).toUpperCase() + fr.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group full">
                  <label>Notes (optional)</label>
                  <input className="input" placeholder="e.g. After mortgage deduction" value={assetForm.notes}
                    onChange={e => setAssetForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              {assetForm.amount > 0 && (
                <div className="calc-preview">
                  <span>Fortnightly: <strong className="teal">{fmtMoneyRound(toFnAsset(assetForm))}</strong></span>
                  <span>Annual: <strong>{fmtMoneyRound(toFnAsset(assetForm) * 26)}</strong></span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeAsset}>Cancel</button>
              <button className="btn-primary" onClick={saveAsset} disabled={!assetForm.name || !assetForm.amount}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
