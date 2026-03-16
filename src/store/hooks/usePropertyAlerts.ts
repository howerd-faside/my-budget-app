import { useMemo } from 'react';
import { useProperty } from './useProperty';
import { today, daysBetween } from '../../utils/finance/dates';

export interface PropertyAlertItem {
  id:       string;
  icon:     string;
  label:    string;
  detail?:  string;
  severity: 'info' | 'warn' | 'urgent';
}

export interface PropertyAlerts {
  items:         PropertyAlertItem[];
  hasProperties: boolean;
}

/**
 * Derived hook — cross-property alert items for the Home dashboard.
 *
 * Aggregates overdue tasks, urgent tasks, asset condition/warranty alerts,
 * and active projects across ALL properties (not filtered to selectedPropertyId).
 */
export function usePropertyAlerts(): PropertyAlerts {
  const { properties, propertyTasks, propertyProjects, propertyAssets } = useProperty();

  return useMemo(() => {
    if (properties.length === 0) {
      return { items: [] as PropertyAlertItem[], hasProperties: false };
    }

    const NOW = today();
    const items: PropertyAlertItem[] = [];

    // ── Overdue tasks ─────────────────────────────────────────────────────────
    const openTasks = propertyTasks.filter(
      t => t.status !== 'Done' && t.status !== 'Cancelled',
    );
    const overdue = openTasks.filter(t => t.dueDate && t.dueDate < NOW);
    if (overdue.length > 0) {
      items.push({
        id:       'prop-overdue',
        icon:     'clipboard',
        label:    `${overdue.length} overdue property task${overdue.length !== 1 ? 's' : ''}`,
        severity: 'urgent',
      });
    }

    // ── Urgent-priority tasks (not already overdue) ───────────────────────────
    const urgentNotOverdue = openTasks.filter(
      t => t.priority === 'Urgent' && !(t.dueDate && t.dueDate < NOW),
    );
    if (urgentNotOverdue.length > 0) {
      items.push({
        id:       'prop-urgent',
        icon:     'clipboard',
        label:    `${urgentNotOverdue.length} urgent property task${urgentNotOverdue.length !== 1 ? 's' : ''}`,
        severity: 'warn',
      });
    }

    // ── Asset condition alerts ────────────────────────────────────────────────
    const poorAssets = propertyAssets.filter(
      a => a.condition === 'Poor' || a.condition === 'Critical',
    );
    if (poorAssets.length > 0) {
      const hasCritical = poorAssets.some(a => a.condition === 'Critical');
      items.push({
        id:       'prop-asset-condition',
        icon:     'wrench',
        label:    `${poorAssets.length} asset${poorAssets.length !== 1 ? 's' : ''} in poor/critical condition`,
        severity: hasCritical ? 'urgent' : 'warn',
      });
    }

    // ── Warranty expiring within 90 days ──────────────────────────────────────
    const warrantyExpiring = propertyAssets.filter(a => {
      if (!a.warrantyExpiry) return false;
      const d = daysBetween(NOW, a.warrantyExpiry);
      return d >= 0 && d <= 90;
    });
    if (warrantyExpiring.length > 0) {
      items.push({
        id:       'prop-warranty',
        icon:     'shield',
        label:    `${warrantyExpiring.length} warranty${warrantyExpiring.length !== 1 ? ' expiries' : ' expiry'} within 90 days`,
        severity: 'warn',
      });
    }

    // ── Active projects ───────────────────────────────────────────────────────
    const activeProjects = propertyProjects.filter(
      p => p.status !== 'Completed' && p.status !== 'Cancelled',
    );
    if (activeProjects.length > 0) {
      items.push({
        id:       'prop-projects',
        icon:     'layers',
        label:    `${activeProjects.length} active property project${activeProjects.length !== 1 ? 's' : ''}`,
        severity: 'info',
      });
    }

    return { items, hasProperties: true };
  }, [properties, propertyTasks, propertyProjects, propertyAssets]);
}
