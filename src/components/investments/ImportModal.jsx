import { useState, useRef, useMemo, useCallback } from 'react';
import { useInvestment, usePortfolioAnalytics } from '../../store/hooks';
import { useToast } from '../Toast';
import Modal from '../ui/Modal';
import Icon from '../Icon';
import {
  parseCSV,
  detectProfile,
  mapRow,
  validateRow,
  markDuplicates,
  buildTransactions,
  processImportBatch,
  IMPORT_PROFILES,
  TEMPLATE_HEADERS,
  TEMPLATE_ROWS,
} from '../../utils/csvImport';
import { exportCSV } from '../../utils/csvExport';
import { fmtCurrency as fmt } from '../../utils/format';

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_PILL = { valid: 'green', warning: 'amber', error: 'red' };
const STATUS_LABEL = { valid: 'OK', warning: 'Warn', error: 'Error' };

// ── Component ───────────────────────────────────────────────────────────────

export default function ImportModal({ isOpen, onClose }) {
  const { investmentTransactions, selectedPortfolioId, setInvestment } = useInvestment();
  const { assets, transactions } = usePortfolioAnalytics();
  const toast = useToast();

  // Step 1 = upload, Step 2 = preview
  const [step, setStep] = useState(1);
  const [profileId, setProfileId] = useState('generic');
  const [fileName, setFileName] = useState('');
  const [csvText, setCsvText] = useState('');
  const [batch, setBatch] = useState(null);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // ── Reset ───────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setStep(1);
    setFileName('');
    setCsvText('');
    setBatch(null);
    setImporting(false);
    setDragOver(false);
    setProfileId('generic');
  }, []);

  const handleClose = () => { reset(); onClose(); };

  // ── File reading ────────────────────────────────────────────────────────

  const readFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast('Please select a .csv file', 'error');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(e.target.result);
    reader.onerror = () => toast('Failed to read file', 'error');
    reader.readAsText(file);
  }, [toast]);

  const handleFileChange = (e) => readFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    readFile(e.dataTransfer.files?.[0]);
  };

  // ── Parse & preview ─────────────────────────────────────────────────────

  const handlePreview = () => {
    if (!csvText.trim()) { toast('No CSV data to import', 'error'); return; }

    const profile = IMPORT_PROFILES.find(p => p.id === profileId) || IMPORT_PROFILES[0];
    const result = processImportBatch(csvText, profile, assets);

    if (result.totalCount === 0) {
      toast('CSV file has no data rows', 'error');
      return;
    }

    // Check for duplicates against existing transactions
    const checked = markDuplicates(result.rows, transactions);
    const warningCount = checked.filter(r => r.status === 'warning').length;
    const errorCount = checked.filter(r => r.status === 'error').length;

    setBatch({
      ...result,
      rows: checked,
      warningCount,
      errorCount,
      validCount: checked.filter(r => r.status === 'valid').length,
    });
    setStep(2);
  };

  // ── Import commit ───────────────────────────────────────────────────────

  const handleImport = () => {
    if (!batch || !selectedPortfolioId) return;

    const importable = batch.rows.filter(r => r.status !== 'error');
    if (importable.length === 0) {
      toast('No valid rows to import', 'error');
      return;
    }

    setImporting(true);

    const newTxs = buildTransactions(batch.rows, selectedPortfolioId);
    const allTxs = investmentTransactions || [];
    setInvestment('investmentTransactions', [...allTxs, ...newTxs]);

    toast(`Imported ${newTxs.length} transaction${newTxs.length !== 1 ? 's' : ''}`, 'success');
    handleClose();
  };

  // ── Template download ───────────────────────────────────────────────────

  const downloadTemplate = () => {
    exportCSV('investment-import-template.csv', TEMPLATE_HEADERS, TEMPLATE_ROWS);
  };

  // ── Preview stats ───────────────────────────────────────────────────────

  const importableCount = batch ? batch.rows.filter(r => r.status !== 'error').length : 0;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? 'Import Transactions' : 'Preview Import'}
      wide
      bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      footer={
        step === 1 ? (
          <>
            <button className="btn-ghost" onClick={handleClose}>Cancel</button>
            <button
              className="btn-primary"
              disabled={!csvText.trim()}
              onClick={handlePreview}
            >
              Preview
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
            <button
              className="btn-primary"
              disabled={importableCount === 0 || importing}
              onClick={handleImport}
            >
              {importing ? 'Importing…' : `Import ${importableCount} Row${importableCount !== 1 ? 's' : ''}`}
            </button>
          </>
        )
      }
    >
      {step === 1 ? (
        <UploadStep
          fileName={fileName}
          profileId={profileId}
          dragOver={dragOver}
          fileRef={fileRef}
          onFileChange={handleFileChange}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onProfileChange={setProfileId}
          onDownloadTemplate={downloadTemplate}
          onClickZone={() => fileRef.current?.click()}
        />
      ) : (
        <PreviewStep batch={batch} assets={assets} />
      )}
    </Modal>
  );
}

// ── Step 1: Upload ──────────────────────────────────────────────────────────

function UploadStep({
  fileName, profileId, dragOver, fileRef,
  onFileChange, onDrop, onDragOver, onDragLeave,
  onProfileChange, onDownloadTemplate, onClickZone,
}) {
  return (
    <>
      {/* Drop zone */}
      <div
        className={`import-dropzone${dragOver ? ' drag-over' : ''}`}
        onClick={onClickZone}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickZone(); } }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
        <Icon name="arrow-up" size={24} />
        {fileName ? (
          <span className="import-filename">{fileName}</span>
        ) : (
          <span className="import-prompt">Drop a CSV file here or click to browse</span>
        )}
      </div>

      {/* Profile selector */}
      <div className="form-group">
        <label>Import Format</label>
        <select
          className="input"
          value={profileId}
          onChange={e => onProfileChange(e.target.value)}
        >
          {IMPORT_PROFILES.map(p => (
            <option key={p.id} value={p.id}>{p.name} — {p.description}</option>
          ))}
        </select>
      </div>

      {/* Template download */}
      <div className="import-template-row">
        <button className="btn-ghost small" onClick={onDownloadTemplate}>
          Download Template CSV
        </button>
        <span className="import-template-hint">
          Use the template for correct column ordering
        </span>
      </div>
    </>
  );
}

// ── Step 2: Preview ─────────────────────────────────────────────────────────

function PreviewStep({ batch, assets }) {
  if (!batch) return null;

  const assetMap = {};
  for (const a of assets) assetMap[a.id] = a;

  return (
    <>
      {/* Summary pills */}
      <div className="import-summary">
        <span className="dpill green">{batch.validCount} valid</span>
        {batch.warningCount > 0 && (
          <span className="dpill amber">{batch.warningCount} warning{batch.warningCount !== 1 ? 's' : ''}</span>
        )}
        {batch.errorCount > 0 && (
          <span className="dpill red">{batch.errorCount} error{batch.errorCount !== 1 ? 's' : ''}</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>
          {batch.totalCount} row{batch.totalCount !== 1 ? 's' : ''} total
        </span>
      </div>

      {batch.errorCount > 0 && (
        <div className="import-notice red">
          Rows with errors will be skipped. Fix the CSV and re-import to include them.
        </div>
      )}

      {/* Preview table */}
      <div className="import-table-wrap">
        <table className="perf-table import-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Status</th>
              <th>Date</th>
              <th>Type</th>
              <th>Asset</th>
              <th className="r">Units</th>
              <th className="r">Price</th>
              <th className="r">Amount</th>
              <th>Issues</th>
            </tr>
          </thead>
          <tbody>
            {batch.rows.map((row) => {
              const d = row.resolved;
              const asset = d.assetId ? assetMap[d.assetId] : null;
              const assetLabel = asset
                ? (asset.ticker || asset.name)
                : (row.assetMatch.query || '—');
              const issues = [
                ...Object.values(row.errors),
                ...row.warnings,
              ];

              return (
                <tr key={row.rowIndex} className={row.status === 'error' ? 'import-row-error' : ''}>
                  <td className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{row.rowIndex + 1}</td>
                  <td>
                    <span className={`dpill ${STATUS_PILL[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="mono">{d.date || row.mapped.date || '—'}</td>
                  <td>{d.type || row.mapped.type || '—'}</td>
                  <td>{assetLabel}</td>
                  <td className="r mono">{d.units != null && d.units !== '' ? d.units : '—'}</td>
                  <td className="r mono">{d.price != null && d.price !== '' ? d.price : '—'}</td>
                  <td className="r mono">{d.amount != null && d.amount !== '' ? fmt(parseFloat(d.amount) || 0) : '—'}</td>
                  <td>
                    {issues.length > 0 && (
                      <span className="import-issues" title={issues.join('\n')}>
                        {issues[0]}{issues.length > 1 ? ` (+${issues.length - 1})` : ''}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
