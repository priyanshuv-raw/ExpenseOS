import React from 'react';
import { LogOut, AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  icon?: React.ElementType;
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Sign Out of Dayledge?',
  description = 'Are you sure you want to sign out? Your local workspace data remains safely saved on this device.',
  confirmText = 'Sign Out',
  cancelText = 'Cancel',
  variant = 'danger',
  icon: IconComponent = LogOut,
  loading = false
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="bg-white dark:bg-[#0d1b2a] border border-neutral-200/80 dark:border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative flex flex-col gap-4 animate-scale-up select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-neutral-400 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Title */}
        <div className="flex flex-col items-start gap-3">
          <div className={`p-3 rounded-2xl ${
            variant === 'danger' 
              ? 'bg-red-500/10 text-apple-red dark:bg-red-500/20 dark:text-red-400'
              : variant === 'warning'
              ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20'
              : 'bg-apple-blue/10 text-apple-blue dark:bg-apple-blue/20'
          }`}>
            <IconComponent className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-extrabold text-neutral-900 dark:text-white tracking-tight">
              {title}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900/80 text-neutral-700 dark:text-neutral-300 font-bold text-xs hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-white font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer ${
              variant === 'danger'
                ? 'bg-apple-red hover:bg-red-600 shadow-apple-red/20'
                : variant === 'warning'
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                : 'bg-apple-blue hover:bg-blue-600 shadow-apple-blue/20'
            }`}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
