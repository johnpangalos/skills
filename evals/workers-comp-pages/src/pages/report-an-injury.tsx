import { Button, Select, TextArea, TextField } from "@workers-comp/ui";
import "./report-an-injury.css";

const bodyParts = [
  { value: "head", label: "Head" },
  { value: "back", label: "Back" },
  { value: "hand", label: "Hand" },
  { value: "leg", label: "Leg" },
];

export default function ReportAnInjury() {
  return (
    <div className="report-page" data-testid="page">
      <div className="report-card" data-testid="card">
        <div className="report-header" data-testid="header">
          <h1>Report an injury</h1>
          <p>Step 1 of 3: what happened.</p>
        </div>
        <TextField
          className="report-field"
          label="Date of injury"
          placeholder="YYYY-MM-DD"
          description="The day it happened, even if you reported it later."
        />
        <Select
          className="report-field"
          label="Body part"
          placeholder="Select a body part"
          items={bodyParts}
          invalid
          errorMessage="Choose the injured body part."
        />
        <TextArea
          className="report-field"
          label="What happened"
          placeholder="What happened, and how were you hurt?"
          description="Say when, where and how it happened."
        />
        <TextField
          className="report-field"
          label="Employer"
          placeholder="Employer"
          description="Set by your employer's policy."
          disabled
        />
        <div className="report-actions" data-testid="actions">
          <Button variant="outline">Save draft</Button>
          <Button>Continue</Button>
        </div>
      </div>
    </div>
  );
}
