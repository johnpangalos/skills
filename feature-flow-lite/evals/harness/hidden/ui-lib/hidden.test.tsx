// Hidden acceptance tests for the ui-lib component-library task.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Combobox, Dialog, Tab, TabList, TabPanel, Tabs } from "../src/index";

function TabsDemo(props: { onValueChange?: (v: string) => void }) {
  return (
    <Tabs defaultValue="a" onValueChange={props.onValueChange}>
      <TabList aria-label="Demo">
        <Tab value="a">Alpha</Tab>
        <Tab value="b" disabled>
          Beta
        </Tab>
        <Tab value="c">Gamma</Tab>
      </TabList>
      <TabPanel value="a">Panel A</TabPanel>
      <TabPanel value="b">Panel B</TabPanel>
      <TabPanel value="c">Panel C</TabPanel>
    </Tabs>
  );
}

describe("Tabs", () => {
  test("roles, selection and labelling", () => {
    render(<TabsDemo />);
    expect(screen.getByRole("tablist", { name: "Demo" })).toBeInTheDocument();
    const a = screen.getByRole("tab", { name: "Alpha" });
    expect(a).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("aria-selected", "false");
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Panel A");
    expect(a).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", a.id);
    const c = screen.queryByText("Panel C");
    expect(c === null || !c.checkVisibility?.() || c.closest("[hidden]") !== null).toBe(true);
  });

  test("roving tabindex", () => {
    render(<TabsDemo />);
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Gamma" })).toHaveAttribute("tabindex", "-1");
  });

  test("arrow keys skip disabled tabs, wrap, and activate", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TabsDemo onValueChange={onValueChange} />);
    await user.click(screen.getByRole("tab", { name: "Alpha" }));
    await user.keyboard("{ArrowRight}");
    const g = screen.getByRole("tab", { name: "Gamma" });
    expect(g).toHaveFocus();
    expect(g).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel C");
    expect(onValueChange).toHaveBeenLastCalledWith("c");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(g).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "Alpha" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(g).toHaveFocus();
  });

  test("controlled value", async () => {
    const user = userEvent.setup();
    function C() {
      const [v, setV] = useState("c");
      return (
        <>
          <Tabs value={v} onValueChange={setV}>
            <TabList aria-label="C">
              <Tab value="a">A</Tab>
              <Tab value="c">C</Tab>
            </TabList>
            <TabPanel value="a">pa</TabPanel>
            <TabPanel value="c">pc</TabPanel>
          </Tabs>
          <button onClick={() => setV("a")}>reset</button>
        </>
      );
    }
    render(<C />);
    expect(screen.getByRole("tab", { name: "C" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByText("reset"));
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("pa");
  });
});

function DialogDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog open={open} onOpenChange={setOpen} title="Settings" description="Change your settings">
        <input aria-label="Name" />
        <button onClick={() => setOpen(false)}>Done</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  test("closed renders nothing", () => {
    render(<DialogDemo />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("labelled modal in a portal, focus moves in", async () => {
    const user = userEvent.setup();
    const { container } = render(<DialogDemo />);
    await user.click(screen.getByText("Open"));
    const dialog = screen.getByRole("dialog", { name: "Settings" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Change your settings");
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  test("Tab is trapped inside", async () => {
    const user = userEvent.setup();
    render(<DialogDemo />);
    await user.click(screen.getByText("Open"));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  test("Escape closes and focus returns to the opener", async () => {
    const user = userEvent.setup();
    render(<DialogDemo />);
    const opener = screen.getByText("Open");
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  test("closing from inside returns focus too", async () => {
    const user = userEvent.setup();
    render(<DialogDemo />);
    const opener = screen.getByText("Open");
    await user.click(opener);
    await user.click(screen.getByText("Done"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

const FRUIT = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "blueberry", label: "Blueberry", disabled: true },
  { value: "cherry", label: "Cherry" },
];

function ComboDemo(props: { onChange?: (v: string | null) => void }) {
  const [v, setV] = useState<string | null>(null);
  return (
    <>
      <Combobox
        label="Fruit"
        options={FRUIT}
        value={v}
        onChange={(n) => {
          setV(n);
          props.onChange?.(n);
        }}
      />
      <output data-testid="out">{v ?? "none"}</output>
    </>
  );
}

describe("Combobox", () => {
  test("labelled combobox controlling a listbox", async () => {
    const user = userEvent.setup();
    render(<ComboDemo />);
    const input = screen.getByRole("combobox", { name: "Fruit" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-expanded", "true");
    const listbox = screen.getByRole("listbox");
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    expect(within(listbox).getAllByRole("option")).toHaveLength(4);
  });

  test("typing filters case-insensitively", async () => {
    const user = userEvent.setup();
    render(<ComboDemo />);
    await user.type(screen.getByRole("combobox"), "BAN");
    const opts = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(opts.map((o) => o.textContent)).toEqual(["Banana"]);
  });

  test("arrow keys move aria-activedescendant, skipping disabled; Enter selects", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ComboDemo onChange={onChange} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    const active = () => document.getElementById(input.getAttribute("aria-activedescendant") ?? "");
    const first = active();
    expect(first).not.toBeNull();
    const seen = [first?.textContent];
    await user.keyboard("{ArrowDown}");
    seen.push(active()?.textContent);
    await user.keyboard("{ArrowDown}");
    seen.push(active()?.textContent);
    expect(seen).not.toContain("Blueberry");
    expect(active()).toHaveAttribute("aria-selected", "true");
    const chosen = active()?.textContent;
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("out").textContent).toBe(FRUIT.find((f) => f.label === chosen)?.value);
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).toHaveValue(chosen);
  });

  test("clicking an option selects it", async () => {
    const user = userEvent.setup();
    render(<ComboDemo />);
    await user.type(screen.getByRole("combobox"), "ch");
    await user.click(screen.getByRole("option", { name: "Cherry" }));
    expect(screen.getByTestId("out").textContent).toBe("cherry");
  });

  test("Escape closes without selecting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ComboDemo onChange={onChange} />);
    const input = screen.getByRole("combobox");
    await user.type(input, "a");
    await user.keyboard("{Escape}");
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(onChange).not.toHaveBeenCalled();
  });

  test("no matches shows a message", async () => {
    const user = userEvent.setup();
    render(<ComboDemo />);
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});

