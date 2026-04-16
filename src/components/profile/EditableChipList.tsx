"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { RescoreNotice } from "./RescoreNotice";

interface EditableChipListProps {
  items: string[];
  primaryCount?: number;
  addLabel?: string;
  placeholder?: string;
  onAdd: (item: string) => Promise<void>;
  onRemove: (item: string) => Promise<void>;
}

export function EditableChipList({
  items,
  primaryCount = 3,
  addLabel = "Add skill",
  placeholder = "e.g. Figma",
  onAdd,
  onRemove,
}: EditableChipListProps) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [showNotice, setShowNotice] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function submit() {
    const v = value.trim();
    if (!v) {
      setAdding(false);
      return;
    }
    startTransition(async () => {
      await onAdd(v);
      setValue("");
      setAdding(false);
      setShowNotice(true);
    });
  }

  function remove(item: string) {
    startTransition(async () => {
      await onRemove(item);
      setShowNotice(true);
    });
  }

  return (
    <>
      <div className="profile-chips">
        {items.length === 0 && !adding && (
          <span className="profile-explainer" style={{ fontStyle: "italic" }}>
            None added yet.
          </span>
        )}
        {items.map((t, i) => (
          <span
            key={t}
            className={`profile-chip profile-chip-editable${i < primaryCount ? " profile-chip-primary" : ""}`}
          >
            <span>{t}</span>
            <button
              type="button"
              className="profile-chip-remove"
              aria-label={`Remove ${t}`}
              disabled={isPending}
              onClick={() => remove(t)}
            >
              &times;
            </button>
          </span>
        ))}
        {adding ? (
          <span className="profile-chip-input-wrap">
            <input
              ref={inputRef}
              type="text"
              className="profile-chip-input"
              value={value}
              placeholder={placeholder}
              disabled={isPending}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                } else if (e.key === "Escape") {
                  setValue("");
                  setAdding(false);
                }
              }}
              onBlur={submit}
            />
          </span>
        ) : (
          <button
            type="button"
            className="profile-chip-add profile-chip-add-active"
            onClick={() => setAdding(true)}
            disabled={isPending}
          >
            + {addLabel}
          </button>
        )}
      </div>
      {showNotice && <RescoreNotice onDismiss={() => setShowNotice(false)} />}
    </>
  );
}
