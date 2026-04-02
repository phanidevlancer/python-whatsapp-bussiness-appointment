'use client';

import { twMerge } from 'tailwind-merge';
import { HTMLAttributes, ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen?: boolean;
  onClose?: () => void;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export function Modal({
  isOpen = false,
  onClose,
  children,
  size = 'md',
  showCloseButton = true,
  className,
  ...props
}: ModalProps) {
  if (!isOpen || typeof document === 'undefined') return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  const content = (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] sm:pb-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className={twMerge(
          'relative flex max-h-[calc(100dvh-env(safe-area-inset-bottom)-6rem)] w-full flex-col overflow-hidden rounded-2xl animate-scale-in sm:max-h-[90dvh]',
          sizes[size],
          className
        )}
        style={{
          background: 'var(--surface-container-lowest)',
          border: '1px solid var(--panel-border)',
          boxShadow: 'var(--shadow-2xl)',
        }}
        {...props}
      >
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-lg p-2 transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

interface ModalHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function ModalHeader({ className, children, ...props }: ModalHeaderProps) {
  return (
    <div
      className={twMerge(
        'flex items-center justify-between border-b p-5',
        className
      )}
      style={{ borderColor: 'var(--border-light)' }}
      {...props}
    >
      {children}
    </div>
  );
}

interface ModalTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

function ModalTitle({ className, children, ...props }: ModalTitleProps) {
  return (
    <h2
      className={twMerge('text-lg font-semibold', className)}
      style={{ color: 'var(--text-primary)' }}
      {...props}
    >
      {children}
    </h2>
  );
}

interface ModalContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function ModalContent({ className, children, ...props }: ModalContentProps) {
  return (
    <div
      className={twMerge('min-h-0 overflow-y-auto p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function ModalFooter({ className, children, ...props }: ModalFooterProps) {
  return (
    <div
      className={twMerge(
        'flex items-center justify-end gap-3 border-t p-5',
        className
      )}
      style={{ borderColor: 'var(--border-light)' }}
      {...props}
    >
      {children}
    </div>
  );
}

export { ModalHeader, ModalTitle, ModalContent, ModalFooter };
