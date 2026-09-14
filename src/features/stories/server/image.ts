import sharp from "sharp";

import { ApiError } from "@/lib/http/api-error";
import { MAX_STORY_BYTES, STORY_TYPES } from "../schemas/story";

// Bound the stream before buffering; Content-Length alone is not trustworthy.
export async function readStoryUpload(request: Request): Promise<Buffer> {
  const type = request.headers.get("content-type");
  if (!STORY_TYPES.some((allowed) => allowed === type)) {
    throw new ApiError(415, "STORY_IMAGE_INVALID");
  }
  if (Number(request.headers.get("content-length")) > MAX_STORY_BYTES) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "STORY_IMAGE_INVALID");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_STORY_BYTES) {
        await reader.cancel();
        throw new ApiError(413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!length) throw new ApiError(400, "STORY_IMAGE_INVALID");
  return Buffer.concat(chunks, length);
}

export async function prepareStoryImage(original: Buffer, type: string) {
  try {
    if (!original.length || original.length > MAX_STORY_BYTES) throw new Error("size");
    const decoder = sharp(original, { limitInputPixels: 40_000_000, failOn: "warning" });
    const metadata = await decoder.metadata();
    const types: Record<string, string> = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };
    if (!metadata.format || types[metadata.format] !== type || (metadata.pages ?? 1) !== 1) {
      throw new Error("format");
    }
    // Only derived JPEGs are served. EXIF/GPS and embedded metadata stay out of responses.
    const image = await decoder
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const thumbnail = await sharp(image)
      .resize(160, 160, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();
    return {
      original: new Uint8Array(original),
      originalType: type,
      image: new Uint8Array(image),
      thumbnail: new Uint8Array(thumbnail),
    };
  } catch {
    throw new ApiError(400, "STORY_IMAGE_INVALID");
  }
}
