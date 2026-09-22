import { z } from "zod";

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    DIRECT_DATABASE_URL: z.string().url().startsWith("postgresql://").optional(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_TITLE_ROLE_IDS: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().min(1).optional(),
    TARGET_GUILD_ID: z
      .string()
      .regex(/^[0-9]{17,20}$/)
      .optional(),
    E2E_AUTH_MODE: z.literal("mock-discord").optional(),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && value.BETTER_AUTH_URL.startsWith("http://")) {
      context.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "Production BETTER_AUTH_URL must use HTTPS.",
      });
    }
    if (value.NODE_ENV !== "test" && value.E2E_AUTH_MODE !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["E2E_AUTH_MODE"],
        message: "Mock auth is only available in test mode.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= serverEnvSchema.parse(process.env);
  return cachedEnv;
}

export function hasServerEnv(): boolean {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success && process.env.NODE_ENV === "production") {
    throw new Error("Required server environment is invalid or incomplete.");
  }
  return result.success;
}
