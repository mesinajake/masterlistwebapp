"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { SEARCH_DEBOUNCE_MS } from "@/shared/utils/constants";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({
  onSearch,
  placeholder = "Search master list records...",
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setValue(val);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onSearch(val.trim());
      }, SEARCH_DEBOUNCE_MS);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setValue("");
    if (timerRef.current) clearTimeout(timerRef.current);
    onSearch("");
  }, [onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        if (timerRef.current) clearTimeout(timerRef.current);
        onSearch(value.trim());
      }
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [onSearch, value, handleClear]
  );

  return (
    <div className="flex flex-1 justify-center px-4 max-w-2xl">
      <div className="relative w-full max-w-md">
        {/* Search icon */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-secondary-light">
          <span className="material-symbols-outlined text-[20px]">search</span>
        </div>
        <input
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="block w-full rounded-lg border border-border-light bg-surface-light py-2 pl-10 pr-9 text-sm text-text-primary-light placeholder-text-secondary-light focus:border-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary dark:border-border-dark dark:bg-surface-dark dark:text-text-primary-dark dark:focus:border-primary"
        />
        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-text-secondary-light hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-text-primary-dark"
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
