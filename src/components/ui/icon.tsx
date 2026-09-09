import type { CSSProperties } from "react";

const paths = {
  home: "m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  chat: "M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1-1-4 8 8 0 0 1 8-8h2a8 8 0 0 1 8 7ZM8 10h8M8 14h5",
  game: "M8 7h8a4 4 0 0 1 4 3l2 8a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l2-8a4 4 0 0 1 4-3ZM7 10v5M4.5 12.5h5M16 11h.01M18 14h.01",
  trophy:
    "M8 3h8v6a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-4 2h8m-6-2h4",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  arrowUp: "M6 18 18 6M6 6h12v12",
  copy: "M9 9h11v12H9ZM15 5V2H2v14h3",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2",
  book: "M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1Zm0 0v15",
  chevron: "m9 5 7 7-7 7",
  menu: "M4 6h16M4 12h16M4 18h16",
  check: "m5 12 4 4L19 6",
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function DiscordIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.7 5.1a18 18 0 0 0-4.4-1.4l-.6 1.2a16.2 16.2 0 0 0-5.4 0l-.6-1.2a18 18 0 0 0-4.4 1.4C1.5 9.3.7 13.4 1.1 17.4a18 18 0 0 0 5.4 2.7l1.1-1.8-1.7-.8.4-.3a12.6 12.6 0 0 0 11.4 0l.4.3-1.7.8 1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.7-.8-8.8-3.2-12.3ZM8.5 14.9c-1.1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Zm7 0c-1.1 0-1.9-1-1.9-2.2s.8-2.2 1.9-2.2 1.9 1 1.9 2.2-.8 2.2-1.9 2.2Z" />
    </svg>
  );
}
