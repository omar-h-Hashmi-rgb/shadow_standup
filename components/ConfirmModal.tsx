"use client";

import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary'
}: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div className={`p-4 rounded-2xl ${variant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
              <AlertCircle size={28} />
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-900"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-gray-900 tracking-tighter">{title}</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed">{message}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all"
            >
              {cancelText}
            </button>
            <button 
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest text-white rounded-2xl shadow-lg transition-all active:scale-[0.98] ${
                variant === 'danger' 
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
