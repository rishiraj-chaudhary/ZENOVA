import { useEffect, useRef } from "react";

/**
 * A centred dialog over a dimmed page.
 *
 * Escape and a click on the backdrop both dismiss it, focus moves inside on
 * open and returns to whatever had it on close, and the page behind is locked
 * so scrolling the dialog does not scroll the page under it.
 */
const Modal = ({ open, onClose, labelledBy, children }) => {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    restoreFocusRef.current = document.activeElement;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    // Compensating for the scrollbar's width keeps the page from jumping
    // sideways as it is locked.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      // A pointer on the backdrop closes; one inside the panel does not.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="scroll-area max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#161a22] shadow-2xl outline-none animate-[modal-in_180ms_ease-out]"
      >
        {children}
      </div>

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes modal-in { from { opacity: 1; } to { opacity: 1; } }
        }
      `}</style>
    </div>
  );
};

export default Modal;
