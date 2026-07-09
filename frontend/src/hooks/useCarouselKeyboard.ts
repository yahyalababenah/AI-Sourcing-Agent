import { useEffect } from "react";

interface CarouselKeyboardHandlers {
  onNext: () => void;
  onBack: () => void;
  onEscape: () => void;
}

/** Arrow-key navigation + Escape dismissal for slide/step overlays. */
export function useCarouselKeyboard({ onNext, onBack, onEscape }: CarouselKeyboardHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onEscape();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onBack();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNext, onBack, onEscape]);
}
