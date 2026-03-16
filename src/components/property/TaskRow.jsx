import { useState, memo } from 'react';
import Icon from '../Icon';
import { ExpandableRow } from '../ui';
import { PRIORITY_PILL, STATUS_NEXT } from '../../models/PropertyTask';
import { PRIORITY_BAR } from '../../utils/colors';
import { today } from '../../utils/finance/dates';

/** Returns a compact, human-readable due-date label relative to today. */
function relativeDue(dateStr) {
  if (!dateStr) return null;
  const todayStr = today();
  const diff = Math.round(
    (new Date(dateStr + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000
  );
  if (diff < 0)   return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff <= 7)  return `${diff}d`;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

const TaskRow = memo(function TaskRow({ task, areas, propName, showProp, onEdit, onDelete, onStatusChange, onAddNote }) {
  const [noteText, setNoteText] = useState('');

  const area      = areas.find(a => a.id === task.areaId);
  const todayStr  = today();
  const isOverdue = task.dueDate && task.dueDate < todayStr && task.status !== 'Done' && task.status !== 'Cancelled';
  const dueLabel  = relativeDue(task.dueDate);
  const isDone    = task.status === 'Done' || task.status === 'Cancelled';

  // Show status tag only when it communicates something actionable
  const showStatusTag = task.status === 'In Progress' || task.status === 'Waiting';

  const submitNote = () => {
    if (!noteText.trim()) return;
    onAddNote(task.id, noteText.trim());
    setNoteText('');
  };

  return (
    <ExpandableRow
      className="expense-row"
      summary={(expanded) => (
        <>
          <div className="exp-cat-bar" style={{ background: PRIORITY_BAR[task.priority] }} />
          <div className="exp-main">
            <div className="exp-top">
              <div className="exp-info">
                <span className={`exp-name ${isDone ? 'line-through' : ''}`}>{task.title}</span>
                {showProp && propName && (
                  <span className="text3" style={{ display: 'block', fontSize: 11, marginTop: 1 }}>
                    {propName}
                  </span>
                )}
                <span className="exp-tags">
                  {showStatusTag && <span className="tag">{task.status}</span>}
                  <span className="tag">{task.category}</span>
                  {area && <span className="tag teal">{area.name}</span>}
                  {task.effort && <span className="tag">{task.effort}</span>}
                  {task.recurring && <span className="tag amber">Recurring</span>}
                  {task.notes?.length > 0 && <span className="tag">{task.notes.length} note{task.notes.length !== 1 ? 's' : ''}</span>}
                </span>
              </div>
              <div className="exp-right">
                <div className="exp-amounts">
                  {dueLabel && (
                    <span className="exp-amount" style={{
                      fontSize: 12,
                      color: isOverdue ? 'var(--red)' : 'var(--text3)',
                      fontFamily: 'var(--mono)',
                      fontWeight: isOverdue ? 600 : 500,
                    }}>
                      {dueLabel}
                    </span>
                  )}
                  <span className={`dpill ${PRIORITY_PILL[task.priority]}`} style={task.priority === 'Low' ? { color: 'var(--text3)' } : {}}>
                    {task.priority}
                  </span>
                </div>
                <div className="exp-actions" onClick={e => e.stopPropagation()}>
                  <button
                    className="btn-icon"
                    title={`Mark as ${STATUS_NEXT[task.status]}`}
                    aria-label={`Mark as ${STATUS_NEXT[task.status]}`}
                    onClick={() => onStatusChange(task)}
                  >
                    {task.status === 'Done'
                      ? <Icon name="check" size={13} />
                      : <Icon name="chevronD" size={13} />}
                  </button>
                  <button className="btn-icon" onClick={() => onEdit(task)} aria-label="Edit task"><Icon name="pencil" /></button>
                  <button className="btn-icon danger" onClick={() => onDelete(task.id)} aria-label="Delete task"><Icon name="trash" /></button>
                </div>
              </div>
            </div>

            {expanded && (
              <div className="exp-detail" onClick={e => e.stopPropagation()}>
                {task.description && (
                  <div className="exp-detail-notes">{task.description}</div>
                )}
                {(task.notes || []).length > 0 && (
                  <div className="change-history" style={{ marginTop: task.description ? 8 : 0 }}>
                    <div className="ch-label">Notes</div>
                    {task.notes.map(n => (
                      <div key={n.id} className="ch-row">
                        <span className="ch-date">{n.date}</span>
                        <span style={{ color: 'var(--text2)' }}>{n.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
                  <input
                    className="input small"
                    style={{ flex: 1 }}
                    placeholder="Add a progress note…"
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitNote(); }}
                  />
                  <button className="btn-ghost small" onClick={submitNote} disabled={!noteText.trim()}>Add</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    />
  );
});

export default TaskRow;
