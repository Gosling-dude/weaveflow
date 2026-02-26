import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";

type UploadKind = "image" | "video";

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

export function validateUploadFile(file: File, kind: UploadKind) {
  if (kind === "image" && !IMAGE_MIMES.has(file.type)) {
    throw new Error("Unsupported image format");
  }
  if (kind === "video" && !VIDEO_MIMES.has(file.type)) {
    throw new Error("Unsupported video format");
  }
}

/**
 * Uploads a File to Vercel Blob and returns the public URL.
 * Requires BLOB_READ_WRITE_TOKEN to be set in Vercel environment variables.
 * (Replaces the old Transloadit-based upload which had a broken signature + polling loop.)
 */
export async function uploadToTransloadit(file: File): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not configured");

  const mimeType = file.type;
  const ext =
    IMAGE_EXTENSIONS[mimeType] ?? VIDEO_EXTENSIONS[mimeType] ?? "bin";
  const fileName = `${randomUUID()}.${ext}`;

  const blob = await put(fileName, file, {
    access: "public",
    token,
    contentType: mimeType,
  });

  return blob.url;
}
