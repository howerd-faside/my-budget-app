import { useState } from 'react';
import { calcFortnightlyIncome, calcFortnightlyIncomeAt, calcFortnightlyAssetIncome, getPersonIncomeAt } from '../store';
import { useFinance } from '../store/hooks';
import { usePeople }  from '../store/hooks';
import { calcNetPay, TAX_CODES, KIWISAVER_RATES, PAY_FREQUENCIES, fmtMoneyRound, fmtMoney } from '../utils/tax';
import { toFortnightly } from '../utils/finance/frequency';
import { createPerson, createSecondaryIncome, createIncomeEvent, createEmploymentRole, createAssetIncome } from '../models/Person';
import { getPersonDependents, cascadeDeletePerson, personDeleteMessage } from '../utils/cascade';
import Icon from '../components/Icon';
import Portal from '../components/Portal';
import { SectionHeader, StatTile, EmptyState, Card } from '../components/ui';

const EMPTY_PERSON    = createPerson();
const EMPTY_SECONDARY = createSecondaryIncome();
const EMPTY_EVENT     = createIncomeEvent();
const EMPTY_ROLE      = createEmploymentRole();
const EMPTY_ASSET     = createAssetIncome();

const ASSET_TYPES = [
  { value: 'rental',   label: 'Rental Property' },
  { value: 'dividend', label: 'Dividend / Investment' },
  { value: 'business', label: 'Business' },
  { value: 'trust',    label: 'Trust' },
  { value: 'other',    label: 'Other' },
];
const ASSET_TYPE_LABEL = Object.fromEntries(ASSET_TYPES.map(t => [t.value, t.label]));



export default function People() {
  const { people, expenses, setPeople, mergePeople } = usePeople();
  const { assetIncomes, setFinance } = useFinance();
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(EMPTY_PERSON);
  const [openCards, setOpenCards]       = useState(new Set());
  const [incomeArchiveOpen, setIncomeArchiveOpen] = useState(false);

  const openNew = () => { setForm({ ...EMPTY_PERSON, id: crypto.randomUUID() }); setEditing('new'); };
  const openEdit = (p) => {
    setForm({ ...p, incomeEvents: p.incomeEvents || [], employmentHistory: p.employmentHistory || [] });
    setEditing(p.id);
  };
  const close = () => { setEditing(null); setForm(EMPTY_PERSON); };

  const toggleCard = (id) => {
    setOpenCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = () => {
    // If an open-ended role exists, sync grossAnnual from it so cards/summaries stay accurate
    const currentRole = (form.employmentHistory || []).find(r => !r.endDate);
    const grossAnnual = currentRole ? +currentRole.grossAnnual : +form.grossAnnual;
    const pay = calcNetPay({ ...form, grossAnnual });
    const person = { ...form, grossAnnual, netFortnightly: pay.netFortnightly };
    if (editing === 'new') {
      setPeople('people', [...people, person]);
    } else {
      setPeople('people', people.map(p => p.id === form.id ? person : p));
    }
    close();
  };

  const remove = (id) => {
    const person = people.find(p => p.id === id);
    if (!person) return;
    const deps = getPersonDependents({ expenses }, id);
    if (!confirm(personDeleteMessage(person.name, deps))) return;
    mergePeople(cascadeDeletePerson({ people, expenses }, id));
  };

  const addSecondary = () => {
    setForm(f => ({ ...f, secondaryIncomes: [...(f.secondaryIncomes || []), { ...EMPTY_SECONDARY, id: crypto.randomUUID() }] }));
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
    setForm(f => ({ ...f, incomeEvents: [...(f.incomeEvents || []), { ...EMPTY_EVENT, id: crypto.randomUUID() }] }));
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

  const addRole = () => {
    setForm(f => ({ ...f, employmentHistory: [...(f.employmentHistory || []), { ...EMPTY_ROLE, id: crypto.randomUUID() }] }));
  };
  const updateRole = (id, field, val) => {
    setForm(f => ({ ...f, employmentHistory: (f.employmentHistory || []).map(r => r.id === id ? { ...r, [field]: val } : r) }));
  };
  const removeRole = (id) => {
    setForm(f => ({ ...f, employmentHistory: (f.employmentHistory || []).filter(r => r.id !== id) }));
  };

  // ── Asset Income state ─────────────────────────────────────────────────────
  const [editingAsset, setEditingAsset] = useState(null);
  const [assetForm, setAssetForm]       = useState(EMPTY_ASSET);

  const openNewAsset  = () => { setAssetForm({ ...EMPTY_ASSET, id: crypto.randomUUID() }); setEditingAsset('new'); };
  const openEditAsset = (a) => { setAssetForm({ ...a }); setEditingAsset(a.id); };
  const closeAsset    = () => { setEditingAsset(null); setAssetForm(EMPTY_ASSET); };

  const saveAsset = () => {
    const asset = { ...assetForm, amount: +assetForm.amount };
    if (editingAsset === 'new') {
      setFinance('assetIncomes', [...(assetIncomes || []), asset]);
    } else {
      setFinance('assetIncomes', (assetIncomes || []).map(a => a.id === assetForm.id ? asset : a));
    }
    closeAsset();
  };

  const removeAsset = (id) => {
    if (confirm('Remove this asset income source?'))
      setFinance('assetIncomes', (assetIncomes || []).filter(a => a.id !== id));
  };

  const today    = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const totalFortnightly = calcFortnightlyIncomeAt(people, today);
  const totalAssetFn     = calcFortnightlyAssetIncome(assetIncomes || []);

  // Collect all ended roles + events for the income archive
  const incomeArchive = people.flatMap(p =>
    [
      ...(p.employmentHistory || [])
        .filter(r => r.endDate && r.endDate < todayStr)
        .map(r => ({ ...r, personName: p.name, person: p, kind: 'role' })),
      ...(p.incomeEvents || [])
        .filter(e => e.endDate && e.endDate < todayStr)
        .map(e => ({ ...e, personName: p.name, person: p, kind: 'event' })),
    ]
  ).sort((a, b) => b.endDate.localeCompare(a.endDate));
  // Effective gross for the modal — current open-ended role takes precedence over the bare field
  const formCurrentRole  = (form.employmentHistory || []).find(r => !r.endDate) || null;
  const formEffectiveGross = formCurrentRole ? +formCurrentRole.grossAnnual : +form.grossAnnual;

  return (
    <div className="page-content">
      {people.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title="Income Summary"
            actions={<span className="text3" style={{ fontSize: 11 }}>{people.length} earner{people.length !== 1 ? 's' : ''}</span>}
          />
          <div className="fn-summary">
            <StatTile label="Combined Net /fn" value={fmtMoneyRound(totalFortnightly)} valueClassName="teal" />
            <StatTile label="Combined Annual"  value={fmtMoneyRound(totalFortnightly * 26)} />
            <StatTile label="Earners"          value={people.length} />
          </div>
        </Card>
      )}

      <Card variant="section">
        <SectionHeader
          title="Income Profiles"
          actions={<button className="btn-ghost small" onClick={openNew}>+ Add Person</button>}
        />

        <div className="cards-grid">
        {people.map(p => {
          const pay = calcNetPay(p);
          const isOpen = openCards.has(p.id);
          const hasSecondary = (p.secondaryIncomes || []).length > 0;
          const activeEvent = getPersonIncomeAt(p, today);
          const hasEvent = !!activeEvent.eventLabel;
          const eventPay = hasEvent ? calcNetPay({ ...p, grossAnnual: activeEvent.grossAnnual }) : null;
          // Current role = open-ended, else most-recent closed role
          const sortedRoles = [...(p.employmentHistory || [])].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
          const currentRole = sortedRoles.find(r => !r.endDate) || null;

          return (
            <div key={p.id} className="person-card">
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
                  <button className="btn-icon" onClick={() => openEdit(p)} title="Edit"><Icon name="pencil" /></button>
                  <button className="btn-icon danger" onClick={() => remove(p.id)} title="Remove"><Icon name="trash" /></button>
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
        })}

        {people.length === 0 && (
          <EmptyState
            icon="👤"
            title="No income profiles yet"
            action={<button className="btn-primary" onClick={openNew}>Add your first person</button>}
          />
        )}
        </div>
      </Card>

      {/* ── ASSET INCOME ─────────────────────────────────────────────────── */}
      <Card variant="section">
        <SectionHeader
          title="Asset Income"
          actions={<button className="btn-ghost small" onClick={openNewAsset}>+ Add Asset</button>}
        />

        {(assetIncomes || []).length > 0 && (
          <div className="fn-summary">
            <StatTile label="Asset Income /fn" value={fmtMoneyRound(totalAssetFn)} valueClassName="teal" />
            <StatTile label="Annual"           value={fmtMoneyRound(totalAssetFn * 26)} />
            <StatTile label="Sources"          value={(assetIncomes || []).length} />
          </div>
        )}

        <div className="cards-grid">
          {(assetIncomes || []).map(a => (
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
                <span className="mono teal">{fmtMoneyRound(toFortnightly(a.amount, a.frequency))}</span>
                <span className="text3"> /fn</span>
              </div>
              <div className="asset-detail">
                <span className="text3">{fmtMoneyRound(+a.amount || 0)} {a.frequency}</span>
                <span className="mono text3">{fmtMoneyRound(toFortnightly(a.amount, a.frequency) * 26)}/yr</span>
              </div>
              {a.notes && <div className="asset-notes">{a.notes}</div>}
            </div>
          ))}

          {(assetIncomes || []).length === 0 && (
            <EmptyState
              icon="🏠"
              title="No asset income yet — add rental, dividend or other sources"
              action={<button className="btn-primary" onClick={openNewAsset}>Add your first asset</button>}
            />
          )}
        </div>
      </Card>

      {/* ── MODAL ── */}
      {editing && (
        <Portal>
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
                    <input className="input mono" type="number" placeholder="0" value={form.grossAnnual}
                      onChange={e => setForm(f => ({ ...f, grossAnnual: e.target.value }))} />
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

              {/* Live preview — always reflects effective salary (role or base field) */}
              {formEffectiveGross > 0 && (() => {
                const pay = calcNetPay({ ...form, grossAnnual: formEffectiveGross });
                return (
                  <div className="calc-preview">
                    <span>Net Fortnightly: <strong className="teal">{fmtMoneyRound(pay.netFortnightly)}</strong></span>
                    <span>Tax Rate: <strong>{pay.effectiveRate.toFixed(1)}%</strong></span>
                  </div>
                );
              })()}

              {/* Employment History — defines primary income per date range */}
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
                      <button className="btn-icon danger small" onClick={() => removeRole(r.id)}><Icon name="close" size={12} /></button>
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

              {/* Secondary Incomes — always additive on top of primary employment income */}
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
                  <button className="btn-icon danger small" onClick={() => removeSecondary(s.id)}><Icon name="close" size={12} /></button>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn-ghost" onClick={close}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={!form.name || !formEffectiveGross}>Save</button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* ── INCOME HISTORY ARCHIVE ── */}
      {incomeArchive.length > 0 && (
        <Card variant="section">
          <div className="section-header"
            style={{ cursor: 'pointer' }}
            onClick={() => setIncomeArchiveOpen(o => !o)}>
            <h3 style={{ color: 'var(--text3)', fontWeight: 500 }}>
              Income History
              <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 6 }}>· {incomeArchive.length}</span>
            </h3>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: incomeArchiveOpen ? 'rotate(180deg)' : '', transition: 'transform 0.2s', color: 'var(--text3)' }}>
              <path d="M4 6l4 4 4-4"/>
            </svg>
          </div>
          {incomeArchiveOpen && (
            <div className="fn-list" style={{ opacity: 0.8 }}>
              {incomeArchive.map(item => {
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
      )}

      {/* ── ASSET MODAL ── */}
      {editingAsset && (
        <Portal>
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
                  <span>Fortnightly: <strong className="teal">{fmtMoneyRound(toFortnightly(assetForm.amount, assetForm.frequency))}</strong></span>
                  <span>Annual: <strong>{fmtMoneyRound(toFortnightly(assetForm.amount, assetForm.frequency) * 26)}</strong></span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={closeAsset}>Cancel</button>
              <button className="btn-primary" onClick={saveAsset} disabled={!assetForm.name || !assetForm.amount}>Save</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  );
}
