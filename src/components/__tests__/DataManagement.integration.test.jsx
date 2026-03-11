// @vitest-environment jsdom
/**
 * Integration tests for the DataManagement component (backup / restore).
 *
 * Covers:
 *   - Export: clicking "Export Backup" calls exportBackup + downloadBackup
 *   - Import invalid JSON: shows a file-error message
 *   - Import a backup that fails validation: shows the validation error
 *   - Import a valid backup: confirmation modal appears with export date
 *   - Confirm restore: calls applyBackup then window.location.reload
 *   - Cancel restore: modal dismissed, applyBackup NOT called
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../components/Toast';
import DataManagement from '../../components/DataManagement';

// ── mock backup utilities ─────────────────────────────────────────────────────

vi.mock('../../utils/backup', () => ({
  exportBackup: vi.fn(() => ({
    ok: true,
    backup: { exportedAt: '2026-01-15T10:00:00.000Z', formatVersion: 1 },
  })),
  downloadBackup: vi.fn(),
  validateBackup: vi.fn(() => ({ ok: true })),
  applyBackup: vi.fn(() => ({ ok: true })),
}));

import { exportBackup, downloadBackup, validateBackup, applyBackup } from '../../utils/backup';

// ── helpers ───────────────────────────────────────────────────────────────────

function renderDM() {
  return render(
    <ToastProvider>
      <DataManagement />
    </ToastProvider>
  );
}

/** Build a minimal File object whose readAsText returns `content` */
function makeFile(content, name = 'backup.json') {
  const blob = new Blob([content], { type: 'application/json' });
  return new File([blob], name, { type: 'application/json' });
}

// ── setup / teardown ──────────────────────────────────────────────────────────

let reloadMock;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  // Mock window.location.reload (jsdom throws if you try to navigate)
  reloadMock = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
    configurable: true,
  });
  // Mock URL methods used by downloadBackup
  global.URL.createObjectURL = vi.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = vi.fn();
  // Reset all mock call counts
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Export ────────────────────────────────────────────────────────────────────

describe('DataManagement — export', () => {
  it('renders the Export Backup button', () => {
    renderDM();
    expect(screen.getByRole('button', { name: /Export Backup/i })).toBeInTheDocument();
  });

  it('calls exportBackup and downloadBackup when Export is clicked', async () => {
    const user = userEvent.setup();
    renderDM();
    await user.click(screen.getByRole('button', { name: /Export Backup/i }));
    expect(exportBackup).toHaveBeenCalledOnce();
    expect(downloadBackup).toHaveBeenCalledOnce();
  });

  it('shows a toast error if exportBackup returns not-ok', async () => {
    exportBackup.mockReturnValueOnce({ ok: false, error: 'No data found' });
    const user = userEvent.setup();
    renderDM();
    await user.click(screen.getByRole('button', { name: /Export Backup/i }));
    expect(downloadBackup).not.toHaveBeenCalled();
    // Toast message should appear somewhere in the document
    expect(screen.getByText('No data found')).toBeInTheDocument();
  });
});

// ── Import — invalid input ────────────────────────────────────────────────────

describe('DataManagement — import invalid input', () => {
  it('shows an error when the selected file is not valid JSON', async () => {
    const user = userEvent.setup();
    renderDM();

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, makeFile('not-json!!!'));

    await waitFor(() => {
      expect(screen.getByText('Selected file is not valid JSON.')).toBeInTheDocument();
    });
    expect(validateBackup).not.toHaveBeenCalled();
  });

  it('shows the validation error when validateBackup returns not-ok', async () => {
    validateBackup.mockReturnValueOnce({ ok: false, error: 'Unsupported backup version' });
    const user = userEvent.setup();
    renderDM();

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, makeFile(JSON.stringify({ formatVersion: 99 })));

    await waitFor(() => {
      expect(screen.getByText('Unsupported backup version')).toBeInTheDocument();
    });
  });
});

// ── Import — valid backup flow ────────────────────────────────────────────────

describe('DataManagement — valid backup confirmation flow', () => {
  const validBackup = {
    formatVersion: 1,
    appVersion: 'budget_v1',
    exportedAt: '2026-01-15T10:00:00.000Z',
    domains: {
      finance:    { version: 2, data: {} },
      people:     { version: 1, data: {} },
      property:   { version: 1, data: {} },
      investment: { version: 1, data: {} },
    },
  };

  it('shows the confirmation modal after selecting a valid backup file', async () => {
    const user = userEvent.setup();
    renderDM();

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, makeFile(JSON.stringify(validBackup)));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: 'Restore Backup?' })).toBeInTheDocument();
  });

  it('displays the export date in the confirmation modal', async () => {
    const user = userEvent.setup();
    renderDM();

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, makeFile(JSON.stringify(validBackup)));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    // The formatted date string should appear somewhere in the modal body
    const modal = screen.getByRole('dialog');
    const expectedDate = new Date(validBackup.exportedAt).toLocaleString();
    expect(modal).toHaveTextContent(expectedDate);
  });

  it('calls applyBackup and reloads the page when Restore is confirmed', async () => {
    const user = userEvent.setup();
    renderDM();

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, makeFile(JSON.stringify(validBackup)));

    await waitFor(() => screen.getByRole('dialog'));
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(applyBackup).toHaveBeenCalledWith(validBackup);
    expect(reloadMock).toHaveBeenCalledOnce();
  });

  it('dismisses the modal without calling applyBackup when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderDM();

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, makeFile(JSON.stringify(validBackup)));

    await waitFor(() => screen.getByRole('dialog'));
    // Two Cancel buttons exist: icon (aria-label) + footer text button; target footer one
    const cancelBtn = document.querySelector('[role="dialog"] .modal-footer .btn-ghost');
    await user.click(cancelBtn);

    expect(applyBackup).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a toast error if applyBackup returns not-ok', async () => {
    applyBackup.mockReturnValueOnce({ ok: false, error: 'Write failed' });
    const user = userEvent.setup();
    renderDM();

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, makeFile(JSON.stringify(validBackup)));

    await waitFor(() => screen.getByRole('dialog'));
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    expect(reloadMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Write failed')).toBeInTheDocument();
    });
  });
});
