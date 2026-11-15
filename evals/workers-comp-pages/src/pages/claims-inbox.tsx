import { Badge, Button, Chip, Tab, TabList, Tabs } from "@workers-comp/ui";
import "./claims-inbox.css";

type BadgeColor = "amber" | "green" | "blue" | "red";

type Claim = { title: string; meta: string; status: string; color: BadgeColor };

const claims: Claim[] = [
  { title: "WC-2041 · Lower back strain", meta: "Reported 12 Nov 2026 · Warehouse", status: "In review", color: "amber" },
  { title: "WC-2038 · Wrist sprain", meta: "Reported 3 Nov 2026 · Loading dock", status: "Approved", color: "green" },
  { title: "WC-2033 · Knee contusion", meta: "Reported 28 Oct 2026 · Yard", status: "Needs info", color: "blue" },
  { title: "WC-2027 · Shoulder strain", meta: "Reported 19 Oct 2026 · Warehouse", status: "Denied", color: "red" },
];

// Figma's ClaimRow (4:187) is local to the pages file, so it is built here.
function ClaimRow({ title, meta, status, color }: Claim) {
  return (
    <div className="claim-row" data-testid="claim-row">
      <div className="claim-row-info">
        <p className="claim-row-title">{title}</p>
        <p className="claim-row-meta">{meta}</p>
      </div>
      <Badge color={color}>{status}</Badge>
    </div>
  );
}

export default function ClaimsInbox() {
  return (
    <div className="claims-inbox-page" data-testid="page">
      <div className="claims-inbox-content" data-testid="content">
        <div className="claims-inbox-header" data-testid="header">
          <h1 className="claims-inbox-title">Claims</h1>
          <Button>New claim</Button>
        </div>
        <Tabs defaultValue="open">
          <TabList aria-label="Claims">
            <Tab value="open">Open</Tab>
            <Tab value="closed">Closed</Tab>
            <Tab value="drafts" disabled>
              Drafts
            </Tab>
          </TabList>
        </Tabs>
        <div className="claims-inbox-filters" data-testid="filters">
          <Chip href="#all" current>
            All
          </Chip>
          <Chip href="#back">Back</Chip>
          <Chip href="#hand-or-wrist">Hand or wrist</Chip>
          <Chip href="#knee">Knee</Chip>
          <Chip href="#archived" muted>
            Archived
          </Chip>
        </div>
        <div className="claims-inbox-claims" data-testid="claims">
          {claims.map((claim) => (
            <ClaimRow key={claim.title} {...claim} />
          ))}
        </div>
      </div>
    </div>
  );
}
