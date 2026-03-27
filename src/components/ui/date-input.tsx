import { useState } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value?: string; // yyyy-mm-dd format (backend format)
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
}

function formatValueToDisplay(value?: string): string {
  if (value) {
    const parts = value.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return '';
}

/**
 * Date input that displays dd/mm/yyyy format.
 * Internally converts to/from yyyy-mm-dd (backend/HTML format).
 */
export function DateInput({ value, onChange, className, id }: DateInputProps) {
  const [localDisplay, setLocalDisplay] = useState<string | null>(null);

  const display = localDisplay ?? formatValueToDisplay(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9/]/g, '');

    // Auto-insert slashes
    if (raw.length === 2 && !raw.includes('/')) raw += '/';
    if (raw.length === 5 && raw.indexOf('/', 3) === -1) raw += '/';

    // Limit length
    if (raw.length > 10) raw = raw.slice(0, 10);

    setLocalDisplay(raw);

    // Parse dd/mm/yyyy -> yyyy-mm-dd
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      onChange?.(`${yyyy}-${mm}-${dd}`);
      setLocalDisplay(null);
    } else if (raw === '') {
      onChange?.('');
      setLocalDisplay(null);
    }
  };

  return (
    <Input
      id={id}
      type="text"
      placeholder="dd/mm/yyyy"
      value={display}
      onChange={handleChange}
      className={cn(className)}
      maxLength={10}
    />
  );
}
