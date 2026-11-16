import { Button, Select, TextArea, TextField } from "@workers-comp/ui";

// Built from Figma node 3:311 ("Report an injury", Workers Comp Pages (eval)).
// The body parts are sample data: Figma draws the Select with no options.
const bodyParts = [
  { value: "head", label: "Head" },
  { value: "back", label: "Back" },
  { value: "hand", label: "Hand" },
  { value: "leg", label: "Leg" },
];

export default function ReportAnInjury() {
  return (
    <div data-testid="page" className="flex items-start justify-center bg-gray-50 p-12">
      <div data-testid="card" className="flex w-md flex-col items-start gap-6 rounded-lg bg-white p-6">
        <div data-testid="header" className="flex w-full flex-col items-start gap-1">
          <h1 className="text-lg font-semibold text-gray-900">Report an injury</h1>
          <p className="text-sm text-gray-600">Step 1 of 3: what happened.</p>
        </div>
        <TextField
          className="w-full"
          label="Date of injury"
          placeholder="YYYY-MM-DD"
          description="The day it happened, even if you reported it later."
        />
        <Select
          className="w-full"
          label="Body part"
          placeholder="Select a body part"
          description="Where the injury is. Pick the main one if there are several."
          errorMessage="Choose the injured body part."
          invalid
          items={bodyParts}
        />
        <TextArea
          className="w-full"
          label="What happened"
          placeholder="What happened, and how were you hurt?"
          description="Say when, where and how it happened."
        />
        <TextField
          className="w-full"
          label="Employer"
          placeholder="Employer"
          description="Set by your employer's policy."
          disabled
        />
        <div data-testid="actions" className="flex w-full items-start justify-end gap-3">
          <Button variant="outline" size="default">
            Save draft
          </Button>
          <Button variant="default" size="default">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
