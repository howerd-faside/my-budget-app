import { useState } from 'react';
import { Modal } from '../ui';
import {
  createPropertyTask,
  TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, TASK_EFFORTS, RECUR_UNITS,
} from '../../models/PropertyTask';
import { validate, propertyTaskSchema } from '../../utils/validation';
import { today } from '../../utils/finance/dates';

const EMPTY_TASK = createPropertyTask();

/**
 * Add / Edit modal for a property task.
 *
 * Props:
 *   isOpen           — modal visibility
 *   task             — null → new task, object → editing existing
 *   properties       — property list (for property + area selects)
 *   selectedPropertyId — pre-select property for new tasks
 *   onSave(taskData) — called with the fully-assembled task object
 *   onClose()        — close without saving
 */
export default function TaskModal({ isOpen, task, properties, selectedPropertyId, onSave, onClose }) {
  const isNew = !task;

  const [form, setForm] = useState(() =>
    isNew
      ? { ...EMPTY_TASK, id: crypto.randomUUID(), propertyId: selectedPropertyId || '', createdAt: today() }
      : { ...EMPTY_TASK, ...task }
  );
  const [errors, setErrors]           = useState({});
  const [recurEnabled, setRecurEnabled]   = useState(() => !!task?.recurring);
  const [recurInterval, setRecurInterval] = useState(() => task?.recurring?.interval || 6);
  const [recurUnit, setRecurUnit]         = useState(() => task?.recurring?.unit || 'months');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    const payload = {
      title:      form.title,
      propertyId: form.propertyId,
      ...(recurEnabled ? { recurInterval } : {}),
    };
    const { ok, errors: errs } = validate(propertyTaskSchema, payload);
    if (!ok) { setErrors(errs); return; }
    setErrors({});

    const taskData = {
      ...form,
      recurring: recurEnabled ? { interval: +recurInterval, unit: recurUnit } : null,
    };
    onSave(taskData);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isNew ? 'Add Task' : 'Edit Task'}
      wide
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>
            {isNew ? 'Add Task' : 'Save'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="form-group full">
          <label>Title *</label>
          <input className={`input${errors.title ? ' input-error' : ''}`} placeholder="What needs doing?" value={form.title} onChange={e => setField('title', e.target.value)} autoFocus />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </div>
        <div className="form-group full">
          <label>Description</label>
          <textarea className="input" rows={2} style={{ resize: 'vertical' }} value={form.description} onChange={e => setField('description', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Property</label>
          <select className={`input${errors.propertyId ? ' input-error' : ''}`} value={form.propertyId} onChange={e => setField('propertyId', e.target.value)}>
            <option value="">— Select —</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.propertyId && <span className="field-error">{errors.propertyId}</span>}
        </div>
        <div className="form-group">
          <label>Area</label>
          <select className="input" value={form.areaId} onChange={e => setField('areaId', e.target.value)}>
            <option value="">— None —</option>
            {(properties.find(p => p.id === form.propertyId)?.areas || []).map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Category</label>
          <select className="input" value={form.category} onChange={e => setField('category', e.target.value)}>
            {TASK_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Priority</label>
          <select className="input" value={form.priority} onChange={e => setField('priority', e.target.value)}>
            {TASK_PRIORITIES.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
            {TASK_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Effort</label>
          <select className="input" value={form.effort} onChange={e => setField('effort', e.target.value)}>
            <option value="">— None —</option>
            {TASK_EFFORTS.map(e => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Due Date</label>
          <input className="input" type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} />
        </div>
        <div className="form-group full">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: recurEnabled ? 10 : 0 }}>
            <input type="checkbox" id="recur" checked={recurEnabled} onChange={e => setRecurEnabled(e.target.checked)} />
            <label htmlFor="recur" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>Recurring task</label>
          </div>
          {recurEnabled && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="text3" style={{ fontSize: 12 }}>Repeat every</span>
                <input className={`input${errors.recurInterval ? ' input-error' : ''}`} type="number" min="1" style={{ width: 60 }} value={recurInterval} onChange={e => setRecurInterval(e.target.value)} />
                <select className="input" style={{ width: 110 }} value={recurUnit} onChange={e => setRecurUnit(e.target.value)}>
                  {RECUR_UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              {errors.recurInterval && <span className="field-error">{errors.recurInterval}</span>}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
