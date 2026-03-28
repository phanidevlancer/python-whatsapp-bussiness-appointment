'use client';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { forwardRef, HTMLAttributes, ReactNode, useEffect, useState } from 'react';
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!isOpen || !mounted) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[95vw]',
  };

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div
        className={twMerge(
          'relative bg-white rounded-2xl shadow-2xl w-full animate-scale-in',
          sizes[size],
          className
        )}
        {...props}
      >
        {showCloseButton && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
        'flex items-center justify-between p-5 border-b border-gray-100',
        className
      )}
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
      className={twMerge('text-lg font-semibold text-gray-900', className)}
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
      className={twMerge('p-5', className)}
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
        'flex items-center justify-end gap-3 p-5 border-t border-gray-100',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { ModalHeader, ModalTitle, ModalContent, ModalFooter };
