import { useState, useMemo } from 'react';
import { buildSavingsTrajectory, calcFortnightlyIncome, calcFortnightlyExpenses, calcFortnightlyAssetIncome, totalBalance } from '../store';
import { useFinance } from '../store/hooks';
import { usePeople }  from '../store/hooks';
import { fmtMoneyRound } from '../utils/tax';
import { affordabilityStatus, affordabilityDate, findGoalHit } from '../utils/finance/savings';
import { createWishlistItem } from '../models/WishlistItem';
import Icon from '../components/Icon';
import { validate, wishlistItemSchema } from '../utils/validation';
import { SectionHeader, StatTile, EmptyState, Card, Modal } from '../components/ui';


const EMPTY = createWishlistItem();

const STATUS_META = {
  now:     { label: 'Can Buy Now',  color: 'var(--green)',  bg: 'var(--green-dim)' },
  soon:    { label: 'Within 6 mo',  color: 'var(--amber)',  bg: 'var(--amber-dim)' },
  later:   { label: 'Within 18 mo', color: 'var(--teal)',   bg: 'rgba(0,113,227,0.08)' },
  far:     { label: 'Long term',    color: 'var(--text3)',  bg: 'var(--card2)' },
  beyond:  { label: 'Beyond 2030',  color: 'var(--text3)',  bg: 'var(--card2)' },
  unknown: { label: 'No cost set',  color: 'var(--text3)',  bg: 'var(--card2)' },
};


// ── Purchase simulator ─────────────────────────────────────────────────────
function PurchaseSimulator({ item, currentBalance, trajectory, goals, onClose }) {
  const cost        = +item.estimatedCost || 0;
  const newBalance  = currentBalance - cost;
  const shiftedTraj = trajectory.map(p => ({ ...p, balance: p.balance - cost }));

  const impactedGoals = (goals || []).filter(g => g.amount > 0).map(g => {
    const orig    = findGoalHit(trajectory, g);
    const shifted = findGoalHit(shiftedTraj, g);
    let delay = null;
    if (orig && shifted && orig !== shifted) {
      const [oy, om] = orig.split('-').map(Number);
      const [sy, sm] = shifted.split('-').map(Number);
      delay = (sy - oy) * 12 + (sm - om);
    }
    return { ...g, orig, shifted, delay };
  }).filter(g => g.orig || g.shifted);

  return (
    <Modal isOpen onClose={onClose} title="Buy Now Simulator" footer={<button className="btn-ghost" onClick={onClose}>Close</button>}>
      <div className="sim-item-name">{item.name}</div>
      <div className="sim-cost">{fmtMoneyRound(+item.estimatedCost || 0)}</div>

      <div className="sim-balance-row">
        <div className="sim-bal-item">
          <span className="text3">Current Balance</span>
          <span className="mono teal">{fmtMoneyRound(currentBalance)}</span>
        </div>
        <Icon name="arrow-down" size={14} />
        <div className="sim-bal-item">
          <span className="text3">After Purchase</span>
          <span className={`mono ${newBalance < 0 ? 'red' : 'amber'}`}>{fmtMoneyRound(newBalance)}</span>
        </div>
      </div>

      {newBalance < 0 && (
        <div style={{ color: 'var(--red)', fontSize: 12, textAlign: 'center', padding: '8px 0' }}>
          Insufficient savings — would put you {fmtMoneyRound(Math.abs(newBalance))} short
        </div>
      )}

      {impactedGoals.length > 0 && (
        <>
          <div className="form-section-label" style={{ marginTop: 16, marginBottom: 10 }}>Goal Impact</div>
          {impactedGoals.map(g => (
            <div key={g.id} className="sim-goal-row">
              <span className="sim-goal-name">{g.name} ({fmtMoneyRound(g.amount)})</span>
              <span>
                {g.shifted ? (
                  g.delay && g.delay > 0
                    ? <span className="red">delayed {g.delay} month{g.delay !== 1 ? 's' : ''} → {g.shifted}</span>
                    : <span className="green">on track → {g.shifted}</span>
                ) : <span className="red">no longer achievable by 2030</span>}
              </span>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

// ── Wishlist item card ─────────────────────────────────────────────────────
function WishCard({ item, currentBal, trajectory, onEdit, onRemove, onToggle, onSimulate }) {
  const cost    = +item.estimatedCost || 0;
  const status  = affordabilityStatus(cost, currentBal, trajectory);
  const meta    = STATUS_META[status];
  const dateStr = affordabilityDate(cost, currentBal, trajectory);
  const pct     = cost > 0 ? Math.min(100, Math.round(currentBal / cost * 100)) : 0;

  return (
    <div className={`wl-card ${item.purchased ? 'wl-purchased' : ''}`}>
      <div className="wl-top">
        <span className="wl-name">{item.name}</span>
        <span className="wl-badge" style={{ background: meta.bg, color: meta.color }}>
          {item.purchased ? '✓ Purchased' : meta.label}
        </span>
      </div>

      {item.notes && <p className="wl-notes">{item.notes}</p>}

      <div className="wl-cost-row">
        <span className="wl-cost" style={{ color: item.purchased ? 'var(--text3)' : meta.color }}>
          {cost > 0 ? fmtMoneyRound(cost) : <span className="text3">No cost set</span>}
        </span>
        {!item.purchased && dateStr && (
          <span className="wl-date">{dateStr}</span>
        )}
      </div>

      {cost > 0 && !item.purchased && (
        <div className="wl-progress-wrap">
          <div className="wl-progress-bar" style={{ width: `${pct}%`, background: meta.color }} />
        </div>
      )}
      {cost > 0 && !item.purchased && (
        <div className="wl-pct-label">{pct}% saved</div>
      )}

      <div className="wl-actions">
        {!item.purchased && cost > 0 && (
          <button className="btn-ghost small" onClick={() => onSimulate(item)}>
            Simulate
          </button>
        )}
        <button className="btn-ghost small" onClick={() => onToggle(item.id)}>
          {item.purchased ? 'Undo' : 'Purchased'}
        </button>
        <div style={{ flex: 1 }} />
        <button className="btn-icon" onClick={() => onEdit(item)}><Icon name="pencil" /></button>
        <button className="btn-icon danger" onClick={() => onRemove(item.id)}><Icon name="trash" /></button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function Wishlist() {
  const { accounts, fortnightlyData, goals, assetIncomes } = useFinance();
  const { people, expenses, wishlist: storeWishlist, setPeople } = usePeople();
  const [editing, setEditing] = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [errors, setErrors]   = useState({});
  const [simItem, setSimItem] = useState(null);

  const trajectory = useMemo(() => buildSavingsTrajectory({ people, expenses, fortnightlyData, accounts, assetIncomes }), [people, expenses, fortnightlyData, accounts, assetIncomes]);
  const currentBal = totalBalance(accounts);
  const wishlist   = storeWishlist || [];

  const pending   = useMemo(() => wishlist.filter(i => !i.purchased), [wishlist]);
  const purchased = useMemo(() => wishlist.filter(i => i.purchased),  [wishlist]);

  const totalCost  = pending.reduce((s, i) => s + (+i.estimatedCost || 0), 0);
  const canBuyNow  = pending.filter(i => i.estimatedCost && currentBal >= +i.estimatedCost).length;
  const nextSoonest = pending
    .filter(i => i.estimatedCost && currentBal < +i.estimatedCost)
    .map(i => ({ item: i, hit: trajectory.find(p => p.balance >= +i.estimatedCost) }))
    .filter(e => e.hit)
    .sort((a, b) => a.hit.date.localeCompare(b.hit.date))[0];
  const nextLabel = nextSoonest ? affordabilityDate(+nextSoonest.item.estimatedCost, currentBal, trajectory) : null;

  const openNew = () => { setForm({ ...EMPTY, id: crypto.randomUUID() }); setEditing('new'); setErrors({}); };
  const openEdit = (item) => { setForm({ ...item }); setEditing(item.id); setErrors({}); };
  const close   = () => { setEditing(null); setForm(EMPTY); setErrors({}); };

  const save = () => {
    const { ok, errors: errs } = validate(wishlistItemSchema, form);
    if (!ok) { setErrors(errs); return; }
    setErrors({});
    const item = { ...form, estimatedCost: +form.estimatedCost || null };
    if (editing === 'new') setPeople('wishlist', [...wishlist, item]);
    else setPeople('wishlist', wishlist.map(i => i.id === form.id ? item : i));
    close();
  };

  const remove = (id) => {
    if (confirm('Remove this item?')) setPeople('wishlist', wishlist.filter(i => i.id !== id));
  };

  const togglePurchased = (id) => {
    setPeople('wishlist', wishlist.map(i => i.id === id ? { ...i, purchased: !i.purchased } : i));
  };

  return (
    <div className="page-content">
      {wishlist.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="tag" size={15} /> Wishlist</>}
            actions={
              <>
                <span className="text3" style={{ fontSize: 11 }}>{pending.length} pending</span>
                <button className="btn-ghost small" onClick={openNew}>+ Add Item</button>
              </>
            }
          />
          <div className="fn-summary">
            <StatTile label="Total Pending"   value={fmtMoneyRound(totalCost)} valueClassName="red" />
            <StatTile label="Can Buy Now"     value={canBuyNow} valueClassName="green" />
            <StatTile label="Next Affordable" value={nextLabel || '—'} valueClassName="amber" />
            <StatTile label="Purchased"       value={purchased.length} />
          </div>
        </Card>
      )}

      {pending.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="alertcir" size={15} /> Pending</>}
            actions={<span className="text3" style={{ fontSize: 11 }}>{pending.length} item{pending.length !== 1 ? 's' : ''}</span>}
          />
          <div className="wl-grid">
            {pending.map(item => (
              <WishCard
                key={item.id}
                item={item}
                currentBal={currentBal}
                trajectory={trajectory}
                onEdit={openEdit}
                onRemove={remove}
                onToggle={togglePurchased}
                onSimulate={setSimItem}
              />
            ))}
          </div>
        </Card>
      )}

      {purchased.length > 0 && (
        <Card variant="section">
          <SectionHeader
            title={<><Icon name="wallet" size={15} /> Purchased</>}
            actions={<span className="text3" style={{ fontSize: 11 }}>{purchased.length} item{purchased.length !== 1 ? 's' : ''}</span>}
          />
          <div className="wl-grid">
            {purchased.map(item => (
              <WishCard
                key={item.id}
                item={item}
                currentBal={currentBal}
                trajectory={trajectory}
                onEdit={openEdit}
                onRemove={remove}
                onToggle={togglePurchased}
                onSimulate={setSimItem}
              />
            ))}
          </div>
        </Card>
      )}

      {wishlist.length === 0 && (
        <EmptyState
          icon="🛒"
          title="Nothing on your wishlist yet — add items to track affordability and plan purchases"
          action={<button className="btn-primary" onClick={openNew}>Add your first item</button>}
        />
      )}

      {simItem && (
        <PurchaseSimulator
          item={simItem}
          currentBalance={currentBal}
          trajectory={trajectory}
          goals={goals || []}
          onClose={() => setSimItem(null)}
        />
      )}

      <Modal
        isOpen={!!editing}
        onClose={close}
        title={editing === 'new' ? 'Add Item' : 'Edit Item'}
        footer={
          <>
            <button className="btn-ghost" onClick={close}>Cancel</button>
            <button className="btn-primary" onClick={save}>Save</button>
          </>
        }
      >
        <div className="form-grid">
          <div className="form-group full">
            <label>Item Name</label>
            <input className={`input${errors.name ? ' input-error' : ''}`} placeholder="e.g. New TV" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>
          <div className="form-group">
            <label>Estimated Cost ($)</label>
            <input className={`input mono${errors.estimatedCost ? ' input-error' : ''}`} type="number" placeholder="0" value={form.estimatedCost}
              onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))} />
            {errors.estimatedCost && <span className="field-error">{errors.estimatedCost}</span>}
          </div>
          <div className="form-group full">
            <label>Notes</label>
            <input className="input" placeholder="Optional details" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
