export const TITLE_PRICE = 500;
export const TITLE_KEYS = [
  "lockdown",
  "overwatch",
  "lol",
  "pubg",
  "minecraft",
  "valorant",
] as const;
export type TitleKey = (typeof TITLE_KEYS)[number];
export const TITLES: { key: TitleKey; game: string; name: string }[] = [
  { key: "lockdown", game: "락다운 프로토콜", name: "피자스시 장인" },
  { key: "overwatch", game: "오버워치", name: "탱장연" },
  { key: "lol", game: "롤", name: "서폿은 도구다" },
  { key: "pubg", game: "배그", name: "보급은 못참지" },
  { key: "minecraft", game: "마인크래프트", name: "침대 좀 누워" },
  { key: "valorant", game: "발로란트", name: "뭔헤드야" },
];
