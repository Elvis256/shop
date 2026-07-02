"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  variant?: "danger" | "default";
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
  /** When set, shows a text input that must be filled before confirming */
  inputMode?: { label: string; placeholder?: string };
}

export default function ConfirmDialog({
  open,
  title,
  message,
  variant = "default",
  loading = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  inputMode,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInputValue("");
      // Focus input on open
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const isDanger = variant === "danger";
  const canConfirm = !inputMode || inputValue.trim().length > 0;

  const dialog = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !loading && onCancel()}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          {isDanger && (
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="font-semibold text-lg text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{message}</p>

            {inputMode && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {inputMode.label}
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canConfirm && !loading) onConfirm(inputValue);
                  }}
                  placeholder={inputMode.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(inputValue)}
            disabled={loading || !canConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 ${
              isDanger
                ? "bg-red-600 hover:bg-red-700"
                : "bg-accent hover:bg-accent/90"
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
