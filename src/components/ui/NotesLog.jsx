import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * NotesLog — inline notes list with an add input.
 *
 * Renders the `.change-history` pattern with date + text rows,
 * plus an inline text input + "Add" button.
 *
 * Props:
 *   notes         — array of { id, date, text }
 *   onAdd         — (text: string) => void
 *   placeholder   — input placeholder text
 *   label         — header label (default: "Notes")
 *   showLabel     — whether to show the ch-label header (default: true when notes exist)
 *   reversed      — show newest first (default: false)
 */
export default function NotesLog({
  notes = [],
  onAdd,
  placeholder = 'Add a note…',
  label = 'Notes',
  showLabel,
  reversed = false,
}) {
  const [text, setText] = useState('');

  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim());
    setText('');
  };

  const displayNotes = reversed ? [...notes].reverse() : notes;
  const shouldShowLabel = showLabel ?? notes.length > 0;

  return (
    <>
      {shouldShowLabel && displayNotes.length > 0 && (
        <div className="change-history" style={{ marginTop: 0 }}>
          <div className="ch-label">{label}</div>
          {displayNotes.map(n => (
            <div key={n.id} className="ch-row">
              <span className="ch-date">{n.date}</span>
              <span style={{ color: 'var(--text2)' }}>{n.text}</span>
            </div>
          ))}
        </div>
      )}
      {onAdd && (
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-2)' }}>
          <input
            className="input small"
            style={{ flex: 1 }}
            placeholder={placeholder}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          />
          <button className="btn-ghost small" onClick={submit} disabled={!text.trim()}>Add</button>
        </div>
      )}
    </>
  );
}

NotesLog.propTypes = {
  notes: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    date: PropTypes.string,
    text: PropTypes.string.isRequired,
  })),
  onAdd: PropTypes.func,
  placeholder: PropTypes.string,
  label: PropTypes.string,
  showLabel: PropTypes.bool,
  reversed: PropTypes.bool,
};
