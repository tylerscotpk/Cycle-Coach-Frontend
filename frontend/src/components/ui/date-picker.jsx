import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Dark-themed date picker using Shadcn Calendar + Popover.
 *
 * Props:
 *   value        – YYYY-MM-DD string (same format as <input type="date">)
 *   onChange      – receives YYYY-MM-DD string
 *   max          – optional YYYY-MM-DD string to disable future dates
 *   placeholder  – display text when no date selected
 *   className    – extra classes on the trigger button
 *   testId       – data-testid for the trigger
 *   portalContainer – optional DOM node; when set, Popover renders inside it
 *                     (required when DatePicker lives inside a Radix Dialog to
 *                      avoid iOS Safari pointer-event conflicts)
 */
const DatePicker = ({ value, onChange, max, placeholder = 'Pick a date', className, testId, portalContainer }) => {
  const [open, setOpen] = useState(false);

  // Parse YYYY-MM-DD to local Date (no timezone shift)
  const parseLocal = (str) => {
    if (!str) return undefined;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  // Format Date to YYYY-MM-DD (local, no timezone shift)
  const toDateStr = (date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const selected = parseLocal(value);
  const maxDate = parseLocal(max);

  const handleSelect = useCallback((date) => {
    if (date) onChange(toDateStr(date));
    setOpen(false);
  }, [onChange]);

  // Stabilise open/close — prevents the double-fire onOpenChange that
  // vaul + Radix Dialog cause on iOS Safari / WebKit.
  const handleOpenChange = useCallback((next) => {
    setOpen(next);
  }, []);

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal={false}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid={testId}
          className={cn(
            'justify-start text-left font-normal',
            'bg-slate-700/50 border-slate-600 hover:bg-slate-700 hover:text-white',
            !value && 'text-slate-400',
            value && 'text-white',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
          {value ? format(selected, 'MMM d, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 bg-slate-800 border-slate-700"
        align="start"
        side={portalContainer ? 'top' : 'bottom'}
        avoidCollisions
        collisionPadding={8}
        // Prevent Dialog focus-trap from stealing focus back on iOS
        onOpenAutoFocus={(e) => e.preventDefault()}
        // When inside a Dialog, render in the Dialog container to stay
        // within its pointer-events: auto zone on WebKit
        {...(portalContainer ? { container: portalContainer } : {})}
      >
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          disabled={maxDate ? (date) => date > maxDate : undefined}
          defaultMonth={selected || new Date()}
          className="text-white"
          classNames={{
            months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
            month: 'space-y-4',
            caption: 'flex justify-center pt-1 relative items-center',
            caption_label: 'text-sm font-medium text-white',
            nav: 'space-x-1 flex items-center',
            nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border border-slate-600 rounded-md inline-flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700',
            nav_button_previous: 'absolute left-1',
            nav_button_next: 'absolute right-1',
            table: 'w-full border-collapse space-y-1',
            head_row: 'flex',
            head_cell: 'text-slate-400 rounded-md w-8 font-normal text-[0.8rem]',
            row: 'flex w-full mt-2',
            cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-cyan-500/20 [&:has([aria-selected])]:rounded-md',
            day: 'h-8 w-8 p-0 font-normal text-slate-300 hover:bg-slate-700 hover:text-white rounded-md inline-flex items-center justify-center aria-selected:opacity-100',
            day_selected: 'bg-cyan-500 text-white hover:bg-cyan-600 hover:text-white focus:bg-cyan-500 focus:text-white',
            day_today: 'bg-slate-700 text-cyan-400 font-semibold',
            day_outside: 'text-slate-600 aria-selected:bg-cyan-500/30 aria-selected:text-slate-400',
            day_disabled: 'text-slate-600 opacity-50',
            day_hidden: 'invisible',
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

export { DatePicker };
