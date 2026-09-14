import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_STORY_BYTES } from "../schemas/story";
import { prepareStoryImage, readStoryUpload } from "./image";

describe("story uploads", () => {
  it("원본을 보관하고 EXIF 없는 JPEG와 작은 썸네일을 만든다", async () => {
    const original = await sharp({
      create: { width: 1800, height: 900, channels: 3, background: "red" },
    })
      .jpeg()
      .withMetadata()
      .toBuffer();
    const result = await prepareStoryImage(original, "image/jpeg");
    expect(Buffer.from(result.original)).toEqual(original);
    const image = await sharp(result.image).metadata();
    expect(image).toMatchObject({ format: "jpeg", width: 1600, height: 800 });
    expect(image.exif).toBeUndefined();
    expect(await sharp(result.thumbnail).metadata()).toMatchObject({ width: 160, height: 160 });
  });
  it("SVG, 손상 파일, MIME 위장, 빈 파일과 과대 파일을 거부한다", async () => {
    const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    for (const data of [
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
      Buffer.from("broken"),
      png,
      Buffer.alloc(0),
      Buffer.alloc(MAX_STORY_BYTES + 1),
    ]) {
      await expect(prepareStoryImage(data, "image/jpeg")).rejects.toMatchObject({
        code: "STORY_IMAGE_INVALID",
      });
    }
  });
  it("PNG와 WebP 정지 사진을 지원한다", async () => {
    for (const format of ["png", "webp"] as const) {
      const original = await sharp({
        create: { width: 5, height: 5, channels: 3, background: "red" },
      })
        [format]()
        .toBuffer();
      expect((await prepareStoryImage(original, `image/${format}`)).originalType).toBe(
        `image/${format}`,
      );
    }
  });
  it("움직이는 WebP와 4천만 픽셀을 넘는 사진을 거부한다", async () => {
    const frames = await Promise.all(
      ["red", "blue"].map((background) =>
        sharp({ create: { width: 2, height: 2, channels: 3, background } })
          .png()
          .toBuffer(),
      ),
    );
    const animated = await sharp(frames, { join: { animated: true } })
      .webp({ loop: 0, delay: 100 })
      .toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    await expect(prepareStoryImage(animated, "image/webp")).rejects.toMatchObject({
      code: "STORY_IMAGE_INVALID",
    });
    const large = await sharp({
      create: { width: 6500, height: 6500, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    expect(large.length).toBeLessThan(MAX_STORY_BYTES);
    await expect(prepareStoryImage(large, "image/png")).rejects.toMatchObject({
      code: "STORY_IMAGE_INVALID",
    });
  });
  it("선언된 크기뿐 아니라 실제 stream 누적 크기를 제한한다", async () => {
    await expect(
      readStoryUpload(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "image/png", "content-length": "1" },
          body: new Uint8Array(MAX_STORY_BYTES + 1),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readStoryUpload(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "image/png", "content-length": String(MAX_STORY_BYTES + 1) },
          body: "x",
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readStoryUpload(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "text/html" },
          body: "x",
        }),
      ),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readStoryUpload(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "image/png" },
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      await readStoryUpload(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "image/png" },
          body: "hello",
        }),
      ),
    ).toEqual(Buffer.from("hello"));
  });
});
