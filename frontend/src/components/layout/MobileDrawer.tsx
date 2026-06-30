import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileDrawer({ isOpen, onClose, children }: Props) {
  const location = useLocation();

  // Auto-close when navigating to a new route
  useEffect(() => {
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — slides from the right (RTL) */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Close button — positioned above the sidebar */}
        <button
          onClick={onClose}
          className="absolute -left-10 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/40 text-white"
          aria-label="إغلاق القائمة"
        >
          <X className="h-4 w-4" />
        </button>

        {children}
      </div>
    </>
  );
}
