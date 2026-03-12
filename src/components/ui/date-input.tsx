import { useState, useEffect } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value?: string; // yyyy-mm-dd format (backend format)
  onChange?: (value: string) => void;
  className?: string;
  id?: string;
}

/**
 * Date input that displays dd/mm/yyyy format.
 * Internally converts to/from yyyy-mm-dd (backend/HTML format).
 */
export function DateInput({ value, onChange, className, id }: DateInputProps) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (value) {
      // yyyy-mm-dd → dd/mm/yyyy
      const parts = value.split('-');
      if (parts.length === 3) {
        setDisplay(`${parts[2]}/${parts[1]}/${parts[0]}`);
      }
    } else {
      setDisplay('');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9/]/g, '');

    // Auto-insert slashes
    if (raw.length === 2 && !raw.includes('/')) raw += '/';
    if (raw.length === 5 && raw.indexOf('/', 3) === -1) raw += '/';

    // Limit length
    if (raw.length > 10) raw = raw.slice(0, 10);

    setDisplay(raw);

    // Parse dd/mm/yyyy → yyyy-mm-dd
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      onChange?.(`${yyyy}-${mm}-${dd}`);
    } else if (raw === '') {
      onChange?.('');
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
