import * as React from 'react';
import { cn } from '@/lib/utils';

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

function useTabsContext(component: string) {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error(`${component} must be used within Tabs`);
  }
  return context;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value: controlledValue, onValueChange, ...props }, ref) => {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue ?? '');
    const value = controlledValue ?? uncontrolledValue;

    const setValue = React.useCallback(
      (nextValue: string) => {
        if (controlledValue === undefined) {
          setUncontrolledValue(nextValue);
        }
        onValueChange?.(nextValue);
      },
      [controlledValue, onValueChange],
    );

    return (
      <TabsContext.Provider value={{ value, setValue }}>
        <div ref={ref} className={cn('space-y-4', className)} {...props} />
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        'inline-flex h-auto items-center gap-1 rounded-xl border border-border/50 bg-muted/60 p-1',
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, ...props }, ref) => {
    const context = useTabsContext('TabsTrigger');
    const isActive = context.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? 'active' : 'inactive'}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-1.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          isActive
            ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
            : 'text-muted-foreground hover:text-foreground',
          className,
        )}
        onClick={(event) => {
          context.setValue(value);
          onClick?.(event);
        }}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = useTabsContext('TabsContent');
    if (context.value !== value) {
      return null;
    }

    return (
      <div
        ref={ref}
        role="tabpanel"
        data-state="active"
        className={cn('outline-none', className)}
        {...props}
      />
    );
  },
);
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };
