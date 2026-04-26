import * as React from 'react';
import { cn } from '@/lib/utils';

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within <Tabs>.');
  }
  return context;
}

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex w-fit flex-wrap gap-1 rounded-xl border border-border/50 bg-muted/60 p-1 dark:bg-slate-800/60',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type TabsTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> & {
  value: string;
};

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, children, onClick, ...props }, ref) => {
    const context = useTabsContext();
    const isActive = context.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? 'active' : 'inactive'}
        className={cn(
          'rounded-lg px-4 py-1.5 text-sm font-semibold transition-all',
          isActive
            ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
            : 'text-muted-foreground hover:text-foreground',
          className,
        )}
        onClick={(event) => {
          context.onValueChange(value);
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);

TabsTrigger.displayName = 'TabsTrigger';

type TabsContentProps = React.HTMLAttributes<HTMLDivElement> & {
  value: string;
  forceMount?: boolean;
};

export function TabsContent({
  className,
  value,
  children,
  forceMount = false,
  ...props
}: TabsContentProps) {
  const context = useTabsContext();
  const isActive = context.value === value;

  if (!forceMount && !isActive) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      hidden={!isActive}
      data-state={isActive ? 'active' : 'inactive'}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
}
