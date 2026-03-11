import { useState, useRef } from 'react';
import { exportBackup, downloadBackup, validateBackup, applyBackup } from '../utils/backup';
import { useToast } from './Toast';
import Icon from './Icon';

/**
 * DataManagement — Export and restore all persisted app data.
 *
 * Export: packages the full budget_v1 localStorage slice into a dated .json file.
 * Import: reads a .json file, validates it, asks for confirmation, then writes
 *         the data back to localStorage and reloads so Zustand re-hydrates.
 */
export default function DataManagement() {
  const toast   = useToast();
  const fileRef = useRef(null);

  // Holds a validated backup that is waiting for user confirmation
  const [pendingBackup, setPendingBackup] = useState(null);
  // Holds a validation error message from a rejected file
  const [fileError,     setFileError]     = useState(null);

  // ── Export ──────────────────────────────────────────────────────────────────

  function handleExport() {
    const result = exportBackup();
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    downloadBackup(result.backup);
    toast('Backup downloaded.', 'success');
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input so the same file can be re-selected after an error
    e.target.value = '';
    setFileError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      let parsed;
      try {
        parsed = JSON.parse(ev.target.result);
      } catch {
        setFileError('Selected file is not valid JSON.');
        return;
      }

      const validation = validateBackup(parsed);
      if (!validation.ok) {
        setFileError(validation.error);
        return;
      }

      // Valid — hand off to the confirmation step
      setPendingBackup(parsed);
    };
    reader.readAsText(file);
  }

  // ── Restore (post-confirmation) ─────────────────────────────────────────────

  function handleConfirmRestore() {
    if (!pendingBackup) return;

    const result = applyBackup(pendingBackup);
    setPendingBackup(null);

    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }

    // Reload so Zustand re-hydrates (and runs any pending migrations) from new data
    window.location.reload();
  }

  function handleCancelRestore() {
    setPendingBackup(null);
    setFileError(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const exportedDate = pendingBackup
    ? new Date(pendingBackup.exportedAt).toLocaleString()
    : null;

  return (
    <div className="dm-page">

      <div className="dm-header">
        <div className="dm-header-icon"><Icon name="shield" size={22} strokeWidth={1.4} /></div>
        <div>
          <h1 className="dm-title">Data Management</h1>
          <p className="dm-subtitle">Export a backup of your data or restore from a previous backup.</p>
        </div>
      </div>

      <div className="dm-cards">

        {/* ── Export card ─────────────────────────────────────────────────── */}
        <div className="dash-section dm-card">
          <div className="dm-card-icon dm-card-icon--teal">
            <Icon name="download" size={20} strokeWidth={1.5} />
          </div>
          <h2 className="dm-card-title">Export Backup</h2>
          <p className="dm-card-desc">
            Download a complete snapshot of all your financial, property, and
            investment data as a JSON file. Store it somewhere safe.
          </p>
          <div className="dm-card-includes">
            <span className="dpill teal">Finances</span>
            <span className="dpill teal">People &amp; Expenses</span>
            <span className="dpill teal">Property</span>
            <span className="dpill teal">Investments</span>
          </div>
          <button className="btn-primary dm-card-btn" onClick={handleExport}>
            <Icon name="download" size={13} />
            Export Backup
          </button>
        </div>

        {/* ── Import card ─────────────────────────────────────────────────── */}
        <div className="dash-section dm-card">
          <div className="dm-card-icon dm-card-icon--amber">
            <Icon name="upload" size={20} strokeWidth={1.5} />
          </div>
          <h2 className="dm-card-title">Restore from Backup</h2>
          <p className="dm-card-desc">
            Replace all current data with a previously exported backup file.
            You&apos;ll be asked to confirm before anything is overwritten.
          </p>
          <div className="dm-card-includes">
            <span className="dpill amber">Replaces all data</span>
            <span className="dpill amber">Requires confirmation</span>
          </div>
          <button className="btn-ghost dm-card-btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={13} />
            Select Backup File
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-hidden="true"
          />

          {/* Validation error */}
          {fileError && (
            <div className="dm-file-error">
              <Icon name="alertcir" size={13} />
              <span>{fileError}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirmation modal ─────────────────────────────────────────────── */}
      {pendingBackup && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dm-confirm-title">
          <div className="modal">
            <div className="modal-header">
              <h3 id="dm-confirm-title">Restore Backup?</h3>
              <button className="btn-icon" onClick={handleCancelRestore} aria-label="Cancel">
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                This will <strong style={{ color: 'var(--text)' }}>replace all current app data</strong> with
                the backup exported on:
              </p>
              <div className="dm-confirm-date">{exportedDate}</div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                This action cannot be undone. Export a fresh backup first if you want
                to keep your current data.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={handleCancelRestore}>Cancel</button>
              <button className="btn-primary" style={{ background: 'var(--red)' }} onClick={handleConfirmRestore}>
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
