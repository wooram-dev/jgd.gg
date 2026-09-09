"use client";

import Image from "next/image";
import { useState } from "react";

function isAllowedAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "cdn.discordapp.com";
  } catch {
    return false;
  }
}

export function Avatar({
  name,
  src,
  size = 36,
}: {
  name: string;
  src: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!src || failed || !isAllowedAvatarUrl(src)) {
    return (
      <span className="avatar-fallback" style={{ width: size, height: size }} aria-hidden="true">
        {initial}
      </span>
    );
  }

  return (
    <Image
      className="avatar-image"
      src={src}
      width={size}
      height={size}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
