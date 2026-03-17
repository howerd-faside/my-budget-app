import { memo } from 'react';
import { fmtMoneyRound } from '../../utils/finance/tax';
import { toFortnightly, fnToAnnual } from '../../utils/finance/frequency';
import Icon from '../../components/Icon';
import Portal from '../../components/Portal';
import { SectionHeader, StatTile, EmptyState, Card } from '../../components/ui';

const ASSET_TYPES = [
  { value: 'rental',   label: 'Rental Property' },
  { value: 'dividend', label: 'Dividend / Investment' },
  { value: 'business', label: 'Business' },
  { value: 'trust',    label: 'Trust' },
  { value: 'other',    label: 'Other' },
];
const ASSET_TYPE_LABEL = Object.fromEntries(ASSET_TYPES.map(t => [t.value, t.label]));

function AssetIncomeSection({
  assetIncomes, totalAssetFn,
  editingAsset, assetForm, setAssetForm,
  onOpenNew, onOpenEdit, onRemove,
  onCloseModal, onSaveModal,
}) {
  return (
    <>
      <Card variant="section">
        <SectionHeader
          title={<><Icon name="bank" size={15} /> Asset Income</>}
          actions={<button className="btn-ghost small" onClick={onOpenNew}>+ Add Asset</button>}
        />

        {(assetIncomes || []).length > 0 && (
          <div className="fn-summary">
            <StatTile label="Asset Income /fn" value={fmtMoneyRound(totalAssetFn)} valueClassName="teal" />
            <StatTile label="Annual"           value={fmtMoneyRound(fnToAnnual(totalAssetFn))} />
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
                  <button className="btn-icon" onClick={() => onOpenEdit(a)} title="Edit" aria-label="Edit asset income"><Icon name="pencil" /></button>
                  <button className="btn-icon danger" onClick={() => onRemove(a.id)} title="Remove" aria-label="Delete asset income"><Icon name="trash" /></button>
                </div>
              </div>
              <div className="asset-amount">
                <span className="mono teal">{fmtMoneyRound(toFortnightly(a.amount, a.frequency))}</span>
                <span className="text3"> /fn</span>
              </div>
              <div className="asset-detail">
                <span className="text3">{fmtMoneyRound(+a.amount || 0)} {a.frequency}</span>
                <span className="mono text3">{fmtMoneyRound(fnToAnnual(toFortnightly(a.amount, a.frequency)))}/yr</span>
              </div>
              {a.notes && <div className="asset-notes">{a.notes}</div>}
            </div>
          ))}

          {(assetIncomes || []).length === 0 && (
            <EmptyState
              icon="🏠"
              title="No asset income yet — add rental, dividend or other sources"
              action={<button className="btn-primary" onClick={onOpenNew}>Add your first asset</button>}
            />
          )}
        </div>
      </Card>

      {/* Asset Modal */}
      {editingAsset && (
        <Portal>
        <div className="modal-overlay" onClick={onCloseModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAsset === 'new' ? 'Add Asset Income' : 'Edit Asset Income'}</h3>
              <button className="btn-icon" onClick={onCloseModal} aria-label="Close"><Icon name="close" /></button>
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
                  <span>Annual: <strong>{fmtMoneyRound(fnToAnnual(toFortnightly(assetForm.amount, assetForm.frequency)))}</strong></span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={onCloseModal}>Cancel</button>
              <button className="btn-primary" onClick={onSaveModal} disabled={!assetForm.name || !assetForm.amount}>Save</button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}

export default memo(AssetIncomeSection);
