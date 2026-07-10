import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { API } from "@/constants/api";
import { useAuthStore } from "@/stores/authStore";
import type { User } from "@/types/auth";

/** Which profile image is being written. Stored as a flat profile field on
 *  the user record (same PATCH /auth/me contract the text fields use). */
export type ProfileImageField = "avatar_url" | "banner_url";

// Longest edge we keep. Avatars render small; a banner spans the card width.
// Downscaling client-side keeps the data-URL payload sane before it ever
// reaches the network — a raw phone photo would otherwise be several MB.
const MAX_DIM: Record<ProfileImageField, number> = {
  avatar_url: 256,
  banner_url: 1280,
};
const JPEG_QUALITY = 0.82;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024; // reject absurd inputs up front

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

async function toCompressedDataUrl(file: File, maxDim: number): Promise<string> {
  const img = await loadImage(file);
  const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = Math.min(1, maxDim / longest);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/**
 * Picks up an image File, downscales/compresses it in the browser, and saves
 * it to the current user's profile immediately (the flow the owner chose:
 * upload = saved, no separate "save changes" step). Optimistically merges the
 * new value into the auth store so it shows at once even if the backend
 * doesn't echo the field back on the PATCH response.
 */
export function useProfileImageUpload() {
  const setUser = useAuthStore((s) => s.setUser);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<ProfileImageField | null>(null);

  async function upload(field: ProfileImageField, file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("اختر ملف صورة");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error("الصورة كبيرة جداً — اختر صورة أصغر");
      return;
    }
    setUploading(field);
    try {
      const dataUrl = await toCompressedDataUrl(file, MAX_DIM[field]);
      const updated = await api.patch<User>(API.AUTH.ME, { [field]: dataUrl }).then((r) => r.data);
      // Merge locally so the image appears even if the backend drops unknown
      // profile keys — cross-device persistence still depends on the server.
      const merged = {
        ...updated,
        profile: { ...(updated.profile ?? {}), [field]: dataUrl },
      } as User;
      setUser(merged);
      qc.invalidateQueries({ queryKey: ["profile-me"] });
      toast.success(field === "avatar_url" ? "تم تحديث الصورة الشخصية" : "تم تحديث صورة الغلاف");
    } catch {
      toast.error("تعذّر رفع الصورة — حاول مجدداً");
    } finally {
      setUploading(null);
    }
  }

  return {
    uploading,
    uploadAvatar: (file: File) => upload("avatar_url", file),
    uploadBanner: (file: File) => upload("banner_url", file),
  };
}
