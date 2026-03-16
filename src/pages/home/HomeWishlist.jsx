import PropTypes from 'prop-types';
import Icon from '../../components/Icon';
import { SectionHeader, StatTile, Card } from '../../components/ui';

/**
 * HomeWishlist — compact wishlist summary for the Home dashboard.
 *
 * Presentational only. Hidden when hasWishlist is false.
 */
export default function HomeWishlist({ pendingCount, totalPendingCost, affordableNow, nextAffordable, hasWishlist, onNavigate }) {
  if (!hasWishlist) return null;

  return (
    <Card variant="section">
      <SectionHeader
        title={<><Icon name="tag" size={15} /> Wishlist</>}
        actions={onNavigate && (
          <button className="btn-ghost small" onClick={onNavigate}>View Wishlist →</button>
        )}
      />
      <div className="fn-summary">
        <StatTile label="Pending Items"    value={String(pendingCount)} />
        <StatTile label="Total Cost"       value={totalPendingCost}     valueClassName="red" />
        <StatTile label="Can Buy Now"      value={String(affordableNow)} valueClassName="green" />
        <StatTile label="Next Affordable"  value={nextAffordable || '\u2014'} valueClassName="amber" />
      </div>
    </Card>
  );
}

HomeWishlist.propTypes = {
  pendingCount:     PropTypes.number.isRequired,
  totalPendingCost: PropTypes.string.isRequired,
  affordableNow:    PropTypes.number.isRequired,
  nextAffordable:   PropTypes.string,
  hasWishlist:      PropTypes.bool.isRequired,
  onNavigate:       PropTypes.func,
};
