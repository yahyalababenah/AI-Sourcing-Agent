import { useRef, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ImagePickButtonProps {
  onPick: (file: File) => void;
  loading?: boolean;
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}

/**
 * A button that opens the OS image picker and hands the chosen File back.
 * Shared by the avatar badge and the "change cover" control on both the
 * supplier and client profiles so the pick-and-reset plumbing lives once.
 */
export function ImagePickButton({ onPick, loading, ariaLabel, className, children }: ImagePickButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = ""; // let the same file be re-picked after a cancel
        }}
      />
    </>
  );
}
