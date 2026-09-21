import type { Metadata } from "next";
import { GameCompatibility } from "@/features/game-compatibility/components/game-compatibility";

export const metadata: Metadata = {
  title: "게임 궁합",
  description:
    "12개 질문으로 알아보는 16가지 게임 성향. 내 플레이 스타일을 찾고 친구와 비교해 보세요.",
};

export default function GameCompatibilityPage() {
  return <GameCompatibility />;
}
