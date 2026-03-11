import { createContext, useContext, useState, type PropsWithChildren } from "react";

interface TabsContextValue {
  value: string;
  setValue: (next: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function Tabs(props: PropsWithChildren<{ defaultValue: string; className?: string }>) {
  const [value, setValue] = useState(props.defaultValue);
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={`tabs ${props.className ?? ""}`.trim()}>{props.children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList(props: PropsWithChildren<{ className?: string }>) {
  return <div className={`tabs__list ${props.className ?? ""}`.trim()}>{props.children}</div>;
}

export function TabsTrigger(props: PropsWithChildren<{ value: string }>) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be inside Tabs");

  return (
    <button
      className={`tabs__trigger${context.value === props.value ? " tabs__trigger--active" : ""}`}
      onClick={() => context.setValue(props.value)}
      type="button"
    >
      {props.children}
    </button>
  );
}

export function TabsContent(props: PropsWithChildren<{ value: string; className?: string }>) {
  const context = useContext(TabsContext);
  if (!context || context.value !== props.value) return null;
  return <div className={`tabs__content ${props.className ?? ""}`.trim()}>{props.children}</div>;
}
