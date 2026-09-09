"use client";

import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const authClient = createAuthClient();

export function SignInButton({ callbackURL = "/" }: { callbackURL?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      className="button button-primary"
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signIn.social({
          provider: "discord",
          callbackURL,
          errorCallbackURL: "/auth/error",
        });
        setPending(false);
      }}
    >
      {pending ? "Discord로 이동 중…" : "Discord로 로그인"}
    </button>
  );
}

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      className="text-button"
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {pending ? "로그아웃 중…" : "로그아웃"}
    </button>
  );
}
