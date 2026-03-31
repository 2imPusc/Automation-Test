"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

const SelectContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  registerItem: (value: string, label: React.ReactNode) => void;
  getLabel: (value: string) => React.ReactNode | undefined;
}>({ value: "", onValueChange: () => {}, open: false, setOpen: () => {}, registerItem: () => {}, getLabel: () => undefined });

function Select({ value = "", onValueChange = () => {}, children }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const labelsRef = React.useRef<Map<string, React.ReactNode>>(new Map());

  const registerItem = React.useCallback((itemValue: string, label: React.ReactNode) => {
    labelsRef.current.set(itemValue, label);
  }, []);

  const getLabel = React.useCallback((itemValue: string) => {
    return labelsRef.current.get(itemValue);
  }, []);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, registerItem, getLabel }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  );
}

function SelectTrigger({ className, children }: { className?: string; children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(SelectContext);
  return (
    <button
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => setOpen(!open)}
      onBlur={() => setTimeout(() => setOpen(false), 150)}
    >
      {children}
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("opacity-50 shrink-0 transition-transform", open && "rotate-180")}><path d="m6 9 6 6 6-6"/></svg>
    </button>
  );
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value, getLabel } = React.useContext(SelectContext);
  const label = value ? getLabel(value) : undefined;
  return <span className={cn("truncate", !value && "text-muted-foreground")}>{(label ?? value) || placeholder}</span>;
}

function SelectContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { open } = React.useContext(SelectContext);
  if (!open) return null;
  return (
    <div className={cn(
      "absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
      className
    )}>
      {children}
    </div>
  );
}

function SelectItem({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  const ctx = React.useContext(SelectContext);

  // Register label so SelectValue can display it
  React.useEffect(() => {
    ctx.registerItem(value, children);
  }, [value, children]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        ctx.value === value && "bg-accent text-accent-foreground",
        className
      )}
      onMouseDown={(e) => {
        e.preventDefault();
        ctx.onValueChange(value);
        ctx.setOpen(false);
      }}
    >
      {ctx.value === value && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </span>
      )}
      {children}
    </div>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
