import { Badge, Button } from "@workers-comp/ui";
import "./claim-summary.css";

const details = [
  ["Employee", "Dana Okafor"],
  ["Employer", "Northwind Logistics"],
  ["Date of injury", "12 Nov 2026"],
  ["Body part", "Lower back"],
  ["Adjuster", "Sam Reyes"],
];

export default function ClaimSummary() {
  return (
    <div className="claim-summary-page" data-testid="page">
      <div className="claim-summary-card" data-testid="card">
        <div className="claim-summary-header" data-testid="header">
          <div className="claim-summary-titles" data-testid="titles">
            <h1>Claim WC-2041</h1>
            <p>Lower back strain · Reported 12 Nov 2026</p>
          </div>
          <Badge color="amber" data-testid="badge">
            In review
          </Badge>
        </div>
        <dl className="claim-summary-details" data-testid="details">
          {details.map(([term, value]) => (
            <div className="claim-summary-row" data-testid={`row-${term}`} key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="claim-summary-narrative" data-testid="narrative">
          <h2>What happened</h2>
          <p>
            Lifting a pallet of boxes onto the second shelf, I felt a sharp pain in my lower back. I stopped work,
            told my supervisor, and saw the on-site nurse the same afternoon.
          </p>
        </div>
        <div className="claim-summary-actions" data-testid="actions">
          <Button className="claim-summary-withdraw" variant="ghost">Withdraw claim</Button>
          <div className="claim-summary-primary" data-testid="primary">
            <Button variant="outline">Download PDF</Button>
            <Button>Upload documents</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
