import React, { useEffect, useRef } from 'react';

interface ModalDialogProps {
  onClose: () => void;
  disableDismiss?: boolean;
  labelledBy?: string;
  maxWidthClass?: string;
  overlayClassName?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  onClose,
  disableDismiss = false,
  labelledBy,
  maxWidthClass = 'max-w-lg',
  overlayClassName = 'bg-[#101c2c]/65 backdrop-blur-sm',
  containerClassName = 'bg-white border border-[var(--theme-border)] shadow-2xl',
  children,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !disableDismiss) {
        event.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [disableDismiss]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto ${overlayClassName}`}
      onClick={disableDismiss ? undefined : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className={`relative w-full ${maxWidthClass} rounded-sm ${containerClassName}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
