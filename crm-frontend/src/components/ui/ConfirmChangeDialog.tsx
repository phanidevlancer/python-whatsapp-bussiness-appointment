'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from './Modal';
import { Input } from './Input';
import { Button } from './Button';

export interface FieldChange {
  field: string;
  label: string;
  oldValue: string | null | undefined;
  newValue: string | null | undefined;
}

interface ConfirmChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title?: string;
  changes: FieldChange[];
}

export function ConfirmChangeDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title = 'Confirm Changes',
  changes,
}: ConfirmChangeDialogProps) {
  const [confirmText, setConfirmText] = useState('');
  const canConfirm = confirmText.toLowerCase() === 'confirm';

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    setConfirmText('');
    onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" showCloseButton={false}>
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <ModalTitle>{title}</ModalTitle>
        </div>
      </ModalHeader>

      <ModalContent className="space-y-4">
        <p className="text-sm text-gray-600">
          The following fields will be updated. Please review before saving.
        </p>

        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3">Field</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">From</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {changes.map((c) => (
                <tr key={c.field}>
                  <td className="px-4 py-3 font-medium text-gray-700">{c.label}</td>
                  <td className="px-4 py-3 text-gray-500 line-through">{c.oldValue || '—'}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{c.newValue || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Type <span className="font-semibold text-gray-900">confirm</span> to proceed
          </label>
          <Input
            placeholder="confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) handleConfirm(); }}
            autoFocus
          />
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="outline" size="md" onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleConfirm}
          disabled={!canConfirm}
          isLoading={isLoading}
        >
          Save Changes
        </Button>
      </ModalFooter>
    </Modal>
  );
}
