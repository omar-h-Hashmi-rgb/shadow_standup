"use client";

import React from "react";
import { AlertCircle, X } from "lucide-react";

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
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card">
        <div className="modal-header">
          <div className={`modal-icon ${variant === "danger" ? "modal-icon-danger" : "modal-icon-primary"}`}>
            <AlertCircle size={26} />
          </div>
          <button onClick={onClose} className="modal-close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <h3 className="modal-title">{title}</h3>
          <p className="modal-text">{message}</p>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="btn-secondary">
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`btn-primary ${variant === "danger" ? "btn-danger" : ""}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
