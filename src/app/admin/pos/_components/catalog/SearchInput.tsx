'use client';

import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';

/**
 * The search box on a catalog tab. Tabs mount when they become active, so it
 * takes focus on mount: staff can start typing the moment they switch tabs.
 * Enter adds the top result, Escape clears the search.
 */
export function SearchInput({
  value,
  onChange,
  onEnter,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
  placeholder: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <Input
      ref={ref}
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onChange('');
        }
      }}
      className="min-h-11 text-base"
    />
  );
}
