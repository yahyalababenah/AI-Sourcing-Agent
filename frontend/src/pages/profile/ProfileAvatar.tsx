import { Camera } from "lucide-react";
import { ImagePickButton } from "./ImagePickButton";

interface ProfileAvatarProps {
  src?: string | null;
  initials: string;
  /** Tailwind size utilities for the circle, e.g. "h-20 w-20". */
  sizeClass: string;
  /** Text sizing + accent colour for the initials fallback, e.g. "text-xl text-supplier-700". */
  textClass: string;
  /** When provided, shows a camera badge that uploads a new avatar. */
  onPick?: (file: File) => void;
  uploading?: boolean;
}

/**
 * The round profile avatar — an uploaded image when set, initials otherwise.
 * The parent positions it (usually absolutely over the cover); this component
 * only owns the circle and its optional camera edit badge.
 */
export function ProfileAvatar({ src, initials, sizeClass, textClass, onPick, uploading }: ProfileAvatarProps) {
  return (
    <div className={`relative ${sizeClass}`}>
      {src ? (
        <img
          src={src}
          alt=""
          className={`${sizeClass} rounded-full object-cover ring-4 ring-white`}
        />
      ) : (
        <div
          className={`flex ${sizeClass} items-center justify-center rounded-full bg-white font-bold ring-4 ring-white ${textClass}`}
        >
          {initials}
        </div>
      )}

      {onPick && (
        <ImagePickButton
          onPick={onPick}
          loading={uploading}
          ariaLabel="تغيير الصورة الشخصية"
          className="absolute -bottom-0.5 -end-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80 text-white ring-2 ring-white transition-colors duration-150 hover:bg-slate-900 active:scale-[0.95] disabled:opacity-70"
        >
          <Camera className="h-3.5 w-3.5" />
        </ImagePickButton>
      )}
    </div>
  );
}
