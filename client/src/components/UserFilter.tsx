import { useState, useRef, useEffect } from 'react';
import type { DominoUser } from '../api/hooks';

export interface UserOption {
  id: string;
  label: string;
}

interface UserFilterProps {
  users: UserOption[];
  currentUser?: DominoUser | null;
  selectedUserIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function UserFilter({
  users,
  currentUser,
  selectedUserIds,
  onSelectionChange,
  disabled,
  loading,
}: UserFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleUser = (id: string) => {
    if (selectedUserIds.includes(id)) {
      onSelectionChange(selectedUserIds.filter((x) => x !== id));
    } else {
      onSelectionChange([...selectedUserIds, id]);
    }
  };

  const setMe = () => {
    if (currentUser) {
      const id = (currentUser.id ?? currentUser.userName ?? '') as string;
      onSelectionChange(id ? [id] : []);
    }
    setOpen(false);
  };

  const label =
    selectedUserIds.length === 0
      ? 'All users'
      : selectedUserIds.length === 1
        ? users.find((u) => u.id === selectedUserIds[0])?.label ?? selectedUserIds[0]
        : `${selectedUserIds.length} users`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by user"
        className="flex min-w-[140px] items-center justify-between gap-2 rounded border border-domino-border bg-domino-container px-3 py-2 text-left text-sm text-domino-text hover:bg-domino-bg"
      >
        <span className="truncate">{loading ? 'Loading…' : label}</span>
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && users.length > 0 && (
        <div
          role="listbox"
          className="absolute top-full left-0 z-50 mt-1 max-h-60 w-64 overflow-auto rounded border border-domino-border bg-domino-container py-1 shadow-lg"
        >
          {currentUser && (
            <button
              type="button"
              role="option"
              onClick={setMe}
              className="w-full px-3 py-2 text-left text-sm text-domino-primary hover:bg-domino-bg"
            >
              Me
            </button>
          )}
          {users.map((u) => {
            const checked = selectedUserIds.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggleUser(u.id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-domino-bg"
              >
                <span
                  className={`h-4 w-4 shrink-0 rounded border ${
                    checked ? 'bg-domino-primary' : 'border-domino-border'
                  }`}
                />
                {u.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
