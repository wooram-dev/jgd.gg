import { describe, expect, it } from "vitest";

import { mapDiscordProfile } from "./discord-profile";

describe("mapDiscordProfile", () => {
  it("Discord profile을 placeholder email과 CDN avatar로 매핑한다", () => {
    const mapped = mapDiscordProfile(
      {
        id: "175928847299117063",
        username: "jgd_user",
        global_name: "JGD User",
        avatar: "a_hash",
        email: "real@example.com",
      },
      new Date("2026-09-06T00:00:00Z"),
    );
    expect(mapped).toMatchObject({
      name: "JGD User",
      email: "175928847299117063@discord.placeholder.invalid",
      emailVerified: false,
      discordUsername: "jgd_user",
      discordDisplayName: "JGD User",
      discordAvatarHash: "a_hash",
    });
    expect(mapped.image).toMatch(/^https:\/\/cdn\.discordapp\.com\/avatars\//);
    expect(JSON.stringify(mapped)).not.toContain("real@example.com");
  });

  it("global name과 avatar가 없으면 username과 default avatar를 사용한다", () => {
    const mapped = mapDiscordProfile({
      id: "175928847299117063",
      username: "phone_user",
      global_name: null,
      avatar: null,
    });
    expect(mapped.name).toBe("phone_user");
    expect(mapped.image).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
  });
});
