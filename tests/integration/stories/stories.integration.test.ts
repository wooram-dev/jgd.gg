import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createStory, listStories, readStoryImage } from "@/features/stories/server/story-service";
import { STORY_LIFETIME_MS } from "@/features/stories/schemas/story";
import { cleanApplicationData, createTestDatabase, createTestUser } from "../../helpers/database";

const database = createTestDatabase();
vi.mock("@/lib/db/client", () => ({ getDatabase: () => database }));
const auth = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth/server", () => ({
  getOptionalSession: async () => (auth.userId ? { user: { id: auth.userId } } : null),
}));
const { GET, POST } = await import("@/app/api/v1/stories/route");
const { GET: imageGET } = await import("@/app/api/v1/stories/[storyId]/image/route");
const original = await sharp({
  create: { width: 10, height: 20, channels: 3, background: "purple" },
})
  .png()
  .toBuffer();
const origin = new URL(process.env.BETTER_AUTH_URL!).origin;
function upload(
  key: string = randomUUID(),
  type = "image/png",
  body: Uint8Array = original,
  requestOrigin = origin,
) {
  return POST(
    new Request(`${origin}/api/v1/stories`, {
      method: "POST",
      headers: {
        "Content-Type": type,
        "Idempotency-Key": key,
        Origin: requestOrigin,
        "X-Request-Id": "story-test",
      },
      body: new Uint8Array(body),
    }),
  );
}
function imageRequest(id: string, query = "") {
  return imageGET(new Request(`${origin}/api/v1/stories/${id}/image${query}`), {
    params: Promise.resolve({ storyId: id }),
  });
}
beforeEach(async () => {
  auth.userId = null;
  await cleanApplicationData(database);
});
afterAll(async () => {
  await database.$disconnect();
});

describe("member stories", () => {
  it("공개 목록 200, 비로그인 이미지·게시 401, 타 Origin·차단 사용자 게시 403", async () => {
    expect((await GET(new Request(`${origin}/api/v1/stories`))).status).toBe(200);
    expect((await imageRequest(randomUUID())).status).toBe(401);
    expect((await upload()).status).toBe(401);
    const user = await createTestUser(database, "story-auth");
    auth.userId = user.id;
    expect(
      (await upload(randomUUID(), "image/png", original, "https://foreign.invalid")).status,
    ).toBe(403);
    await database.user.update({ where: { id: user.id }, data: { status: "BANNED" } });
    expect((await upload()).status).toBe(403);
    expect((await GET(new Request(`${origin}/api/v1/stories`))).status).toBe(200);
  });
  it("비로그인 목록은 프로필과 게시 시각만 공개하고 사진·내부 식별자는 노출하지 않는다", async () => {
    const user = await createTestUser(database, "story-public-profile");
    const avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
    await database.user.update({ where: { id: user.id }, data: { image: avatarUrl } });
    const { story } = await createStory(database, {
      userId: user.id,
      uploadKey: randomUUID(),
      original,
      type: "image/png",
    });
    const response = await GET(new Request(`${origin}/api/v1/stories`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    const publicStory = { ...story, avatarUrl, isViewer: false };
    expect(body.data.items).toEqual([{ ...publicStory, stories: [publicStory] }]);
    expect(Object.keys(body.data.items[0]).sort()).toEqual(
      ["id", "displayName", "avatarUrl", "isViewer", "createdAt", "expiresAt", "stories"].sort(),
    );
    for (const query of ["", "?size=thumbnail"]) {
      expect((await imageRequest(story.id, query)).status).toBe(401);
    }
    auth.userId = user.id;
    const member = await (await GET(new Request(`${origin}/api/v1/stories`))).json();
    expect(member.data.items).toEqual([{ ...story, stories: [story] }]);
    auth.userId = null;
    expect((await listStories(database, null, undefined, new Date(story.expiresAt))).items).toEqual(
      [],
    );
    await database.user.update({ where: { id: user.id }, data: { status: "BANNED" } });
    expect((await (await GET(new Request(`${origin}/api/v1/stories`))).json()).data.items).toEqual(
      [],
    );
  });
  it("게시부터 24시간 직전까지 열람하고 경계에서는 숨기지만 원본 byte를 유지한다", async () => {
    const user = await createTestUser(database, "story-expiry");
    auth.userId = user.id;
    const response = await upload();
    expect(response.status).toBe(201);
    const body = await response.json();
    const id: string = body.data.story.id;
    expect(body.meta.requestId).toBe("story-test");
    expect(body.data.story).not.toHaveProperty("userId");
    expect(body.data.story).not.toHaveProperty("original");
    const stored = await database.story.findUniqueOrThrow({ where: { id } });
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(STORY_LIFETIME_MS);
    const before = new Date(stored.expiresAt.getTime() - 1);
    expect((await listStories(database, user.id, undefined, before)).items).toHaveLength(1);
    await expect(readStoryImage(database, id, "image", before)).resolves.toBeInstanceOf(Uint8Array);
    expect((await listStories(database, user.id, undefined, stored.expiresAt)).items).toHaveLength(
      0,
    );
    for (const size of ["image", "thumbnail"] as const)
      await expect(readStoryImage(database, id, size, stored.expiresAt)).rejects.toMatchObject({
        status: 404,
      });
    expect(
      Buffer.from((await database.story.findUniqueOrThrow({ where: { id } })).original),
    ).toEqual(original);
    const image = await imageRequest(id);
    expect(image.headers.get("cache-control")).toBe("private, no-store");
    expect(image.headers.get("x-content-type-options")).toBe("nosniff");
    expect(image.headers.get("content-type")).toBe("image/jpeg");
    expect((await imageRequest(id, "?size=original")).status).toBe(400);
    auth.userId = (await createTestUser(database, "story-reader")).id;
    expect((await imageRequest(id, "?size=thumbnail")).status).toBe(200);
    auth.userId = null;
    expect((await imageRequest(id)).status).toBe(401);
    auth.userId = user.id;
    await database.user.update({ where: { id: user.id }, data: { status: "BANNED" } });
    expect((await imageRequest(id)).status).toBe(404);
    expect((await listStories(database, user.id)).items).toHaveLength(0);
  });
  it("순차·동시 게시 retry를 한 장으로 저장하고 24시간 내 10장 한도를 직렬화한다", async () => {
    const user = await createTestUser(database, "story-retry");
    auth.userId = user.id;
    const key = randomUUID();
    const responses = await Promise.all([upload(key), upload(key)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 201]);
    expect((await upload(key)).status).toBe(200);
    expect(await database.story.count()).toBe(1);
    for (let n = 0; n < 8; n++) expect((await upload()).status).toBe(201);
    expect((await Promise.all([upload(), upload()])).map((r) => r.status).sort()).toEqual([
      201, 429,
    ]);
    expect(await database.story.count()).toBe(10);
    const createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await database.story.updateMany({
      data: { createdAt, expiresAt: new Date(createdAt.getTime() + STORY_LIFETIME_MS) },
    });
    expect((await upload()).status).toBe(201);
    expect(await database.story.count()).toBe(11);
  });

  it("작성자별 30개 페이지에 각 작성자의 전체 사진을 포함하고 이름이 같아도 분리한다", async () => {
    const users = [];
    for (let n = 0; n < 31; n++)
      users.push(await createTestUser(database, `story-pagination-${n}`));
    await database.user.updateMany({ data: { discordDisplayName: "같은 이름" } });
    const createdAt = new Date();
    await database.story.createMany({
      data: users.flatMap((user) =>
        [0, 1].map((age) => ({
          userId: user.id,
          uploadKey: randomUUID(),
          original: new Uint8Array(original),
          originalType: "image/png",
          image: new Uint8Array(original),
          thumbnail: new Uint8Array(original),
          createdAt: new Date(createdAt.getTime() - age * 1000),
          expiresAt: new Date(createdAt.getTime() - age * 1000 + STORY_LIFETIME_MS),
        })),
      ),
    });
    const first = await listStories(database, null);
    expect(first.items).toHaveLength(30);
    const second = await listStories(database, null, first.nextCursor!);
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(31);
    expect(ids).toEqual([...ids].sort().reverse());
    const photos = [...first.items, ...second.items].flatMap((group) => {
      expect(group.stories).toHaveLength(2);
      expect(group.id).toBe(group.stories[1].id);
      expect(Date.parse(group.stories[0].createdAt)).toBeLessThan(
        Date.parse(group.stories[1].createdAt),
      );
      return group.stories;
    });
    expect(new Set(photos.map((photo) => photo.id)).size).toBe(62);
    expect(JSON.stringify(first)).not.toMatch(/original|thumbnail|userId/);
  });
  it("실제 이미지 validation과 query/key 경계를 거부한다", async () => {
    auth.userId = (await createTestUser(database, "story-invalid")).id;
    expect((await upload("bad")).status).toBe(400);
    expect((await upload(randomUUID(), "image/jpeg", original)).status).toBe(400);
    expect((await upload(randomUUID(), "image/svg+xml", Buffer.from("<svg/>"))).status).toBe(415);
    expect(
      (await upload(randomUUID(), "image/png", Buffer.alloc(5 * 1024 * 1024 + 1))).status,
    ).toBe(413);
    expect((await GET(new Request(`${origin}/api/v1/stories?userId=x`))).status).toBe(400);
    expect((await imageRequest(randomUUID())).status).toBe(404);
    expect(await database.story.count()).toBe(0);
  });
  it("DB 24시간·크기 제약과 사용자 삭제 cascade를 유지한다", async () => {
    const user = await createTestUser(database, "story-constraint");
    const { story } = await createStory(database, {
      userId: user.id,
      uploadKey: randomUUID(),
      original,
      type: "image/png",
    });
    await expect(
      database.story.update({ where: { id: story.id }, data: { expiresAt: new Date(0) } }),
    ).rejects.toThrow();
    await expect(
      database.story.update({ where: { id: story.id }, data: { original: new Uint8Array() } }),
    ).rejects.toThrow();
    await database.user.delete({ where: { id: user.id } });
    expect(await database.story.count()).toBe(0);
  });
});
