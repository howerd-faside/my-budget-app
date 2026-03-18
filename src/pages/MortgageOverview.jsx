import PurchaseSummarySection from '../components/mortgage/PurchaseSummarySection';
import CurrentPositionSection from '../components/mortgage/CurrentPositionSection';
import AmortisationSection from '../components/mortgage/AmortisationSection';
import FacilitiesSection from '../components/mortgage/FacilitiesSection';
import EarlyRepaymentSection from '../components/mortgage/EarlyRepaymentSection';

export default function MortgageOverview() {
  return (
    <div className="content-wrap">
      <div className="page-content">
        <CurrentPositionSection />
        <PurchaseSummarySection />
        <AmortisationSection />
        <FacilitiesSection />
        <EarlyRepaymentSection />
      </div>
    </div>
  );
}
