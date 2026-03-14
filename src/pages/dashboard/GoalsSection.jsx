import { useState } from 'react';
import PropTypes from 'prop-types';
import Icon from '../../components/Icon';
import { Modal, ConfirmDialog } from '../../components/ui';

const EMPTY_GOAL = { name: '', amount: '', targetDate: '', notes: '' };

/**
 * Goals list + add/edit modal for the savings trajectory section.
 *
 * @param {object}   props
 * @param {Array}    props.goals           - Raw goals array from store
 * @param {Array}    props.goalsWithDates   - Goals enriched with _hitDate, _monthsRemaining
 * @param {number}   props.currentBal       - Current balance (for progress %)
 * @param {number}   props.nextGoalIdx      - Index of next unachieved goal
 * @param {Function} props.setFinance       - Store setter for 'goals' key
 */
export default function GoalsSection({ goals, goalsWithDates, currentBal, nextGoalIdx, setFinance }) {
  const [editing, setEditing]   = useState(null);
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL);
  const [confirmTarget, setConfirmTarget] = useState(null);

  const openGoal  = () => { setGoalForm({ ...EMPTY_GOAL, id: crypto.randomUUID() }); setEditing('new'); };
  const closeGoal = () => { setEditing(null); setGoalForm(EMPTY_GOAL); };
  const saveGoal  = () => {
    const goal = { ...goalForm, amount: +goalForm.amount };
    if (editing === 'new') setFinance('goals', [...(goals || []), goal]);
    else setFinance('goals', (goals || []).map(g => g.id === goalForm.id ? goal : g));
    closeGoal();
  };
  const removeGoal = (id) => setConfirmTarget(id);
  const executeRemoveGoal = () => {
    setFinance('goals', (goals || []).filter(g => g.id !== confirmTarget));
    setConfirmTarget(null);
  };

  return (
    <>
      {goalsWithDates.length > 0 && (
        <>
          <div className="section-subheader">
            <span>Goals</span>
            <button className="btn-ghost small" onClick={openGoal}>+ Add Goal</button>
          </div>
          <div className="dash-goals">
            {goalsWithDates.map((g, idx) => {
              const pct      = g.amount > 0 ? Math.min(100, Math.round((currentBal / g.amount) * 100)) : 0;
              const achieved = !!g._hitDate;
              const today    = new Date().toISOString().slice(0, 7);
              const overdue  = g.targetDate && g.targetDate < today && !achieved;
              return (
                <div key={g.id} className={`dash-goal-row ${idx === nextGoalIdx ? 'next-goal' : ''}`}>
                  <div className="dg-info">
                    <span className="dg-name">
                      {idx === nextGoalIdx && <span className="dg-next-tag">Next up</span>}
                      {g.name}
                    </span>
                    <span className="dg-target text3">${Math.round(g.amount).toLocaleString('en-NZ')}</span>
                  </div>
                  <div className="dg-bar-wrap">
                    <div className="dg-bar">
                      <div className="dg-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="dg-pct">{pct}%</span>
                  </div>
                  {g._hitDate
                    ? <span className="dg-date teal">{g._hitDate}</span>
                    : <span className="dg-date" style={{ color: overdue ? 'var(--red)' : 'var(--text3)' }}>Beyond range</span>
                  }
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon small" onClick={() => { setGoalForm({ ...g }); setEditing(g.id); }} aria-label="Edit goal"><Icon name="pencil" size={10} /></button>
                    <button className="btn-icon small danger" onClick={() => removeGoal(g.id)} aria-label="Delete goal"><Icon name="trash" size={10} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {(goals || []).length === 0 && (
        <div className="traj-empty">
          <span className="text3">No goals yet —</span>
          <button className="btn-ghost small" onClick={openGoal}>add a savings target</button>
        </div>
      )}

      <Modal
        isOpen={!!editing}
        onClose={closeGoal}
        title={editing === 'new' ? 'Add Goal' : 'Edit Goal'}
        footer={
          <>
            <button className="btn-ghost" onClick={closeGoal}>Cancel</button>
            <button className="btn-primary" onClick={saveGoal} disabled={!goalForm.name || !goalForm.amount}>Save</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group full">
            <label>Goal Name</label>
            <input className="input" placeholder="e.g. New Car" value={goalForm.name}
              onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Target Amount ($)</label>
            <input className="input mono" type="number" placeholder="0" value={goalForm.amount}
              onChange={e => setGoalForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>Target Date (optional)</label>
            <input className="input" type="month" value={goalForm.targetDate}
              onChange={e => setGoalForm(f => ({ ...f, targetDate: e.target.value }))} />
          </div>
          <div className="form-group full">
            <label>Notes</label>
            <input className="input" placeholder="Optional" value={goalForm.notes}
              onChange={e => setGoalForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        title="Remove goal"
        message="Remove this goal?"
        confirmLabel="Remove"
        onConfirm={executeRemoveGoal}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
}

GoalsSection.propTypes = {
  goals: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    amount: PropTypes.number,
    targetDate: PropTypes.string,
    notes: PropTypes.string,
  })).isRequired,
  goalsWithDates: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    amount: PropTypes.number,
    _hitDate: PropTypes.string,
    _monthsRemaining: PropTypes.number,
  })).isRequired,
  currentBal: PropTypes.number.isRequired,
  nextGoalIdx: PropTypes.number.isRequired,
  setFinance: PropTypes.func.isRequired,
};
