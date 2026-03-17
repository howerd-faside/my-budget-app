import { useState } from 'react';
import { calcFortnightlyIncomeAt, calcFortnightlyAssetIncome } from '../utils/finance/savings';
import { useFinance, useUndoDelete } from '../store/hooks';
import { usePeople }  from '../store/hooks';
import { calcNetPay, fmtMoneyRound } from '../utils/finance/tax';
import { fnToAnnual } from '../utils/finance/frequency';
import { createPerson, createSecondaryIncome, createIncomeEvent, createEmploymentRole, createAssetIncome } from '../models/Person';
import { getPersonDependents, cascadeDeletePerson, personDeleteMessage } from '../utils/cascade';
import { validate, personSchema } from '../utils/validation';
import Icon from '../components/Icon';
import { SectionHeader, StatTile, EmptyState, Card, ConfirmDialog } from '../components/ui';
import PersonCard from './people/PersonCard';
import PersonModal from './people/PersonModal';
import AssetIncomeSection from './people/AssetIncomeSection';
import IncomeArchive from './people/IncomeArchive';

const EMPTY_PERSON    = createPerson();
const EMPTY_SECONDARY = createSecondaryIncome();
const EMPTY_EVENT     = createIncomeEvent();
const EMPTY_ROLE      = createEmploymentRole();
const EMPTY_ASSET     = createAssetIncome();

export default function People() {
  const { people, expenses, setPeople, mergePeople } = usePeople();
  const { assetIncomes, setFinance } = useFinance();
  const undoDelete = useUndoDelete();
  const [editing, setEditing]           = useState(null);
  const [form, setForm]                 = useState(EMPTY_PERSON);
  const [errors, setErrors]             = useState({});
  const [openCards, setOpenCards]       = useState(new Set());
  const [incomeArchiveOpen, setIncomeArchiveOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const openNew = () => { setForm({ ...EMPTY_PERSON, id: crypto.randomUUID() }); setErrors({}); setEditing('new'); };
  const openEdit = (p) => {
    setForm({ ...p, incomeEvents: p.incomeEvents || [], employmentHistory: p.employmentHistory || [] });
    setErrors({});
    setEditing(p.id);
  };
  const close = () => { setEditing(null); setForm(EMPTY_PERSON); setErrors({}); };

  const toggleCard = (id) => {
    setOpenCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = () => {
    const currentRole = (form.employmentHistory || []).find(r => !r.endDate);
    const grossAnnual = currentRole ? +currentRole.grossAnnual : +form.grossAnnual;
    const { ok, errors: errs } = validate(personSchema, { ...form, grossAnnual });
    if (!ok) { setErrors(errs); return; }
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
    setConfirmTarget({ id, message: personDeleteMessage(person.name, deps) });
  };

  const executeRemove = () => {
    if (confirmTarget) {
      undoDelete({
        label: 'Person deleted',
        domain: 'people',
        snapshot: { people, expenses },
        applyFn: () => mergePeople(cascadeDeletePerson({ people, expenses }, confirmTarget.id)),
      });
    }
    setConfirmTarget(null);
  };

  const addSecondary = () => {
    setForm(f => ({ ...f, secondaryIncomes: [...(f.secondaryIncomes || []), { ...EMPTY_SECONDARY, id: crypto.randomUUID() }] }));
  };
  const updateSecondary = (id, field, val) => {
    setForm(f => ({ ...f, secondaryIncomes: f.secondaryIncomes.map(s => s.id === id ? { ...s, [field]: val } : s) }));
  };
  const removeSecondary = (id) => {
    setForm(f => ({ ...f, secondaryIncomes: f.secondaryIncomes.filter(s => s.id !== id) }));
  };

  const addEvent = () => {
    setForm(f => ({ ...f, incomeEvents: [...(f.incomeEvents || []), { ...EMPTY_EVENT, id: crypto.randomUUID() }] }));
  };
  const updateEvent = (id, field, val) => {
    setForm(f => ({ ...f, incomeEvents: (f.incomeEvents || []).map(e => e.id === id ? { ...e, [field]: val } : e) }));
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

  const [assetConfirmTarget, setAssetConfirmTarget] = useState(null);
  const removeAsset = (id) => setAssetConfirmTarget(id);
  const executeRemoveAsset = () => {
    if (assetConfirmTarget) {
      const name = (assetIncomes || []).find(a => a.id === assetConfirmTarget)?.name || 'Asset income';
      undoDelete({
        label: `${name} removed`,
        domain: 'finance',
        snapshot: { assetIncomes: assetIncomes || [] },
        applyFn: () => setFinance('assetIncomes', (assetIncomes || []).filter(a => a.id !== assetConfirmTarget)),
      });
    }
    setAssetConfirmTarget(null);
  };

  const today    = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const totalFortnightly = calcFortnightlyIncomeAt(people, today);
  const totalAssetFn     = calcFortnightlyAssetIncome(assetIncomes || []);

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

  return (
    <div className="page-content">
      {people.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="arrow-up" size={15} /> Income Summary</>}
            actions={<span className="text3" style={{ fontSize: 11 }}>{people.length} earner{people.length !== 1 ? 's' : ''}</span>}
          />
          <div className="fn-summary">
            <StatTile label="Combined Net /fn" value={fmtMoneyRound(totalFortnightly)} valueClassName="teal" />
            <StatTile label="Combined Annual"  value={fmtMoneyRound(fnToAnnual(totalFortnightly))} />
            <StatTile label="Earners"          value={people.length} />
          </div>
        </Card>
      )}

      <Card variant="section">
        <SectionHeader
          title={<><Icon name="arrow-up" size={15} /> Income Profiles</>}
          actions={<button className="btn-ghost small" onClick={openNew}>+ Add Person</button>}
        />

        <div className="cards-grid">
          {people.map(p => (
            <PersonCard
              key={p.id}
              person={p}
              isOpen={openCards.has(p.id)}
              onToggle={() => toggleCard(p.id)}
              onEdit={() => openEdit(p)}
              onRemove={() => remove(p.id)}
              today={today}
            />
          ))}

          {people.length === 0 && (
            <EmptyState
              icon="👤"
              title="No income profiles yet"
              action={<button className="btn-primary" onClick={openNew}>Add your first person</button>}
            />
          )}
        </div>
      </Card>

      <AssetIncomeSection
        assetIncomes={assetIncomes}
        totalAssetFn={totalAssetFn}
        editingAsset={editingAsset}
        assetForm={assetForm}
        setAssetForm={setAssetForm}
        onOpenNew={openNewAsset}
        onOpenEdit={openEditAsset}
        onRemove={removeAsset}
        onCloseModal={closeAsset}
        onSaveModal={saveAsset}
      />

      <PersonModal
        editing={editing} form={form} setForm={setForm} errors={errors}
        onClose={close} onSave={save}
        addRole={addRole} updateRole={updateRole} removeRole={removeRole}
        addEvent={addEvent} updateEvent={updateEvent} removeEvent={removeEvent}
        addSecondary={addSecondary} updateSecondary={updateSecondary} removeSecondary={removeSecondary}
      />

      <IncomeArchive
        archive={incomeArchive}
        isOpen={incomeArchiveOpen}
        onToggle={() => setIncomeArchiveOpen(o => !o)}
      />

      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete person"
        message={confirmTarget?.message || ''}
        onConfirm={executeRemove}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmDialog
        open={!!assetConfirmTarget}
        title="Remove asset income"
        message="Remove this asset income source?"
        confirmLabel="Remove"
        onConfirm={executeRemoveAsset}
        onCancel={() => setAssetConfirmTarget(null)}
      />
    </div>
  );
}
