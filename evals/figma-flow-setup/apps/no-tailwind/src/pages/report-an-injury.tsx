import { Button, Select, SelectOption, TextArea, TextField } from "@workers-comp/ui";
import "./report-an-injury.css";

// Figma node 3:311 ("Report an injury"), file 0Uld8qYjwyl7HJLEMwqxNv.
// The Select's options are sample data: Figma shows none.
export default function ReportAnInjury() {
  return (
    <div className="report-page" data-testid="page">
      <div className="report-card" data-testid="card">
        <div className="report-header" data-testid="header">
          <h1 className="report-title">Report an injury</h1>
          <p className="report-description">Step 1 of 3: what happened.</p>
        </div>
        <TextField
          className="report-fill"
          label="Date of injury"
          description="The day it happened, even if you reported it later."
          placeholder="YYYY-MM-DD"
        />
        <Select
          className="report-fill"
          label="Body part"
          description="Where the injury is. Pick the main one if there are several."
          errorMessage="Choose the injured body part."
          placeholder="Select a body part"
          invalid
        >
          <SelectOption value="head">Head</SelectOption>
          <SelectOption value="back">Back</SelectOption>
          <SelectOption value="hand">Hand</SelectOption>
          <SelectOption value="leg">Leg</SelectOption>
        </Select>
        <TextArea
          className="report-fill"
          label="What happened"
          description="Say when, where and how it happened."
          placeholder="What happened, and how were you hurt?"
        />
        <TextField
          className="report-fill"
          label="Employer"
          description="Set by your employer's policy."
          placeholder="Employer"
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
