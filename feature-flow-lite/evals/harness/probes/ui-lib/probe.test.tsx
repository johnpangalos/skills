// Answer-key probes for ui-lib (probes/keys.json). Each test name is a key id; it fails when that
// keyed bug is present. Only the public API from the task's prompt is used.
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { Combobox, Dialog, Tab, TabList, TabPanel, Tabs } from "../src/index";

const inside = (el: Element | null) => el !== null && el.contains(document.activeElement);

function visible(el: Element | null): boolean {
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    if ((e as HTMLElement).hidden) return false;
    const s = getComputedStyle(e);
    if (s.display === "none" || s.visibility === "hidden") return false;
  }
  return true;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>, opener: string, name: string) {
  await user.click(screen.getByText(opener));
  const d = await screen.findByRole("dialog", { name });
  await waitFor(() => expect(inside(d)).toBe(true));
  return d;
}

describe("probes", () => {
  test("nested-dialog-escape", async () => {
    const user = userEvent.setup();
    function Nested() {
      const [o, setO] = useState(false);
      const [i, setI] = useState(false);
      return (
        <>
          <button onClick={() => setO(true)}>Open outer</button>
          <Dialog open={o} onOpenChange={setO} title="Outer">
            <input aria-label="o1" />
            <button onClick={() => setI(true)}>Open inner</button>
            <Dialog open={i} onOpenChange={setI} title="Inner">
              <input aria-label="i1" />
              <input aria-label="i2" />
              <button onClick={() => setI(false)}>Close inner</button>
            </Dialog>
          </Dialog>
        </>
      );
    }
    render(<Nested />);
    const outer = await openDialog(user, "Open outer", "Outer");
    const inner = await openDialog(user, "Open inner", "Inner");
    // the inner dialog traps Tab and Tab moves (not stuck on one element)
    const seen = new Set<Element | null>();
    for (let n = 0; n < 4; n++) {
      await user.tab();
      expect(inside(inner)).toBe(true);
      seen.add(document.activeElement);
    }
    expect(seen.size).toBeGreaterThan(1);
    // one Escape closes only the inner dialog
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Inner" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Outer" })).toBe(outer);
    // the outer dialog's trap still works
    if (!inside(outer)) (screen.getByLabelText("o1") as HTMLElement).focus();
    const seenOuter = new Set<Element | null>();
    for (let n = 0; n < 3; n++) {
      await user.tab();
      expect(inside(outer)).toBe(true);
      seenOuter.add(document.activeElement);
    }
    for (let n = 0; n < 3; n++) {
      await user.tab({ shift: true });
      expect(inside(outer)).toBe(true);
    }
    expect(seenOuter.size).toBeGreaterThan(1);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("trap-hidden-content", async () => {
    // Tab from the last visible element and Shift+Tab from the first must stay on a visible,
    // tabbable element inside the dialog when hidden or tabIndex=-1 content sits at either end.
    const cases: Record<string, ReactNode> = {
      tabs: (
        <Tabs defaultValue="a">
          <TabList aria-label="T">
            <Tab value="a">TA</Tab>
            <Tab value="b">TB</Tab>
          </TabList>
          <TabPanel value="a">
            <button>last</button>
          </TabPanel>
          <TabPanel value="b">
            <button>in hidden panel</button>
          </TabPanel>
        </Tabs>
      ),
      tabindex: (
        <>
          <button tabIndex={-1}>neg head</button>
          <button>first</button>
          <button>last</button>
          <button tabIndex={-1}>neg tail</button>
        </>
      ),
      displaynone: (
        <>
          <a href="#h" style={{ display: "none" }}>none head</a>
          <button>first</button>
          <button>last</button>
          <a href="#t" style={{ display: "none" }}>none tail</a>
        </>
      ),
      displaynoneparent: (
        <>
          <div style={{ display: "none" }}><a href="#h">none head</a></div>
          <button>first</button>
          <button>last</button>
          <div style={{ display: "none" }}><a href="#t">none tail</a></div>
        </>
      ),
      hiddenattr: (
        <>
          <div hidden><button>hidden head</button></div>
          <button>first</button>
          <button>last</button>
          <div hidden><button>hidden tail</button></div>
        </>
      ),
    };
    const bad: string[] = [];
    for (const [name, body] of Object.entries(cases)) {
      const user = userEvent.setup();
      function Demo() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button onClick={() => setOpen(true)}>Open {name}</button>
            <Dialog open={open} onOpenChange={setOpen} title={name}>
              {body}
            </Dialog>
          </>
        );
      }
      const { unmount } = render(<Demo />);
      const d = await openDialog(user, `Open ${name}`, name);
      const ok = () => {
        const a = document.activeElement as HTMLElement | null;
        return inside(d) && visible(a) && a !== null && a.tabIndex >= 0;
      };
      const tabbables = () =>
        [...d.querySelectorAll<HTMLElement>("button, a[href], input, [tabindex]")].filter(
          (e) => e.tabIndex >= 0 && visible(e) && !(e as HTMLButtonElement).disabled,
        );
      let t = tabbables();
      // the tabs case: the last visible tabbable is the button in the visible panel (or the panel)
      t[t.length - 1].focus();
      await user.tab();
      if (!ok()) bad.push(`${name}: Tab from last -> ${document.activeElement?.outerHTML.slice(0, 60)}`);
      t = tabbables();
      t[0].focus();
      await user.tab({ shift: true });
      if (!ok()) bad.push(`${name}: Shift+Tab from first -> ${document.activeElement?.outerHTML.slice(0, 60)}`);
      unmount();
    }
    expect(bad).toEqual([]);
  });

  test("focus-return-autofocus", async () => {
    const user = userEvent.setup();
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Dialog open={open} onOpenChange={setOpen} title="AF">
            <input aria-label="auto" autoFocus />
            <button onClick={() => setOpen(false)}>Done</button>
          </Dialog>
        </>
      );
    }
    render(<Demo />);
    const opener = screen.getByText("Open");
    await openDialog(user, "Open", "AF");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  const FRUIT = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana" },
    { value: "cherry", label: "Cherry" },
  ];
  function Combo(props: { options: typeof FRUIT; onChange: (v: string | null) => void }) {
    const [v, setV] = useState<string | null>(null);
    return (
      <Combobox
        label="Fruit"
        options={props.options}
        value={v}
        onChange={(n) => {
          setV(n);
          props.onChange(n);
        }}
      />
    );
  }
  const activeText = (input: HTMLElement) =>
    document.getElementById(input.getAttribute("aria-activedescendant") ?? "")?.textContent ?? null;

  test("combobox-index", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<Combo options={FRUIT} onChange={onChange} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    for (let n = 0; n < 5 && activeText(input) !== "Banana"; n++) await user.keyboard("{ArrowDown}");
    expect(activeText(input)).toBe("Banana");
    // options change while the list is open: two are prepended
    const more = [{ value: "apricot", label: "Apricot" }, { value: "avocado", label: "Avocado" }, ...FRUIT];
    await act(async () => rerender(<Combo options={more} onChange={onChange} />));
    const shown = activeText(input);
    await user.keyboard("{Enter}");
    // Enter commits the highlighted option (Banana); a build that drops the highlight may commit nothing
    const committed = onChange.mock.calls.map((c) => c[0]);
    expect(committed.filter((v) => v !== "banana")).toEqual([]);
    if (shown !== null) expect(shown).toBe("Banana");
  });

  test("combobox-clear-null", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Combo options={FRUIT} onChange={onChange} />
        <button>after</button>
      </>,
    );
    const input = screen.getByRole("combobox");
    await user.click(input);
    for (let n = 0; n < 5 && activeText(input) !== "Apple"; n++) await user.keyboard("{ArrowDown}");
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("apple");
    onChange.mockClear();
    await user.clear(input);
    if (!onChange.mock.calls.some((c) => c[0] === null) && !input.getAttribute("aria-activedescendant")) {
      await user.keyboard("{Enter}");
    }
    await user.click(screen.getByText("after"));
    expect(onChange.mock.calls.map((c) => c[0])).toContain(null);
    expect(onChange.mock.calls.map((c) => c[0])).not.toContain("apple");
  });
});
