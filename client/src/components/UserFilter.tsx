import { useState, useRef, useEffect } from 'react';
import type { DominoUser } from '../api/hooks';

interface UserFilterProps {
  users: DominoUser[];
  currentUser: DominoUser | null | undefined;
  selectedUserIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
}

function getUserLabel(u: DominoUser): string {
  return u.userName ?? (u.id as string) ?? 'Unknown';
}

function getUserId(u: DominoUser): string {
  return (u.id ?? u.userName ?? '') as string;
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
      const id = getUserId(currentUser);
      onSelectionChange(id ? [id] : []);
    }
    setOpen(false);
  };

  const list = users?.length ? users : (currentUser ? [currentUser] : []);
  const label =
    selectedUserIds.length === 0
      ? 'All users'
      : selectedUserIds.length === 1
        ? list.find((u) => getUserId(u) === selectedUserIds[0])?.userName ?? selectedUserIds[0]
        : `${selectedUserIds.length} users`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select users to filter by"
        className="flex min-w-[140px] items-center justify-between gap-2 rounded border border-domino-border bg-domino-container px-3 py-2 text-left text-sm text-domino-text hover:bg-domino-bg"
      >
        <span className="truncate">{loading ? 'Loading…' : label}</span>
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
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
          {list.map((u) => {
            const id = getUserId(u);
            const checked = selectedUserIds.includes(id);
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggleUser(id)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-domino-bg"
              >
                <span className={`h-4 w-4 shrink-0 rounded border ${checked ? 'bg-domino-primary' : 'border-domino-border'}`} />
                {getUserLabel(u)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
