import {
  createContext,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type TabsContext = { baseId: string; value: string | undefined; select: (value: string) => void };
const Context = createContext<TabsContext | null>(null);

function useTabs() {
  const context = useContext(Context);
  if (!context) throw new Error("Tabs parts must be used inside <Tabs>");
  return context;
}

export type TabsProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
};

export function Tabs({ defaultValue, value, onValueChange, className, children }: TabsProps) {
  const baseId = useId();
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const select = (next: string) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };
  const classes = "flex flex-col items-start gap-3";
  return (
    <Context.Provider value={{ baseId, value: current, select }}>
      <div className={className ? `${classes} ${className}` : classes}>{children}</div>
    </Context.Provider>
  );
}

export function TabList({ className, onKeyDown, ...props }: ComponentProps<"div">) {
  // Arrow keys, Home and End move focus among the enabled tabs; selection follows focus.
  function move(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')];
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    const next = {
      ArrowRight: tabs[(index + 1) % tabs.length],
      ArrowLeft: tabs[(index - 1 + tabs.length) % tabs.length],
      Home: tabs[0],
      End: tabs[tabs.length - 1],
    }[event.key];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  }
  const classes = "inline-flex gap-1 rounded-lg bg-gray-100 p-1";
  return (
    <div role="tablist" {...props} onKeyDown={move} className={className ? `${classes} ${className}` : classes} />
  );
}

const tabClasses = `
  rounded-md px-3 py-1.5 font-sans text-sm font-medium text-gray-600 outline-none
  hover:text-gray-900
  aria-selected:bg-white aria-selected:text-gray-900
  focus-visible:ring-2 focus-visible:ring-fuchsia-600 focus-visible:ring-offset-2
  disabled:pointer-events-none disabled:text-gray-400
`.trim().split(/\s+/).join(" ");

export type TabProps = Omit<ComponentProps<"button">, "value"> & { value: string };

export function Tab({ value, className, ...props }: TabProps) {
  const tabs = useTabs();
  const isSelected = tabs.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${tabs.baseId}-tab-${value}`}
      aria-selected={isSelected}
      aria-controls={`${tabs.baseId}-panel-${value}`}
      tabIndex={isSelected ? 0 : -1}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        tabs.select(value);
      }}
      className={className ? `${tabClasses} ${className}` : tabClasses}
    />
  );
}

export type TabPanelProps = Omit<ComponentProps<"div">, "value"> & { value: string };

export function TabPanel({ value, className, ...props }: TabPanelProps) {
  const tabs = useTabs();
  if (tabs.value !== value) return null;
  const classes = "p-4 font-sans text-sm text-gray-700";
  return (
    <div
      role="tabpanel"
      id={`${tabs.baseId}-panel-${value}`}
      aria-labelledby={`${tabs.baseId}-tab-${value}`}
      {...props}
      className={className ? `${classes} ${className}` : classes}
    />
  );
}
