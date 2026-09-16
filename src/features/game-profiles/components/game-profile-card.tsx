import { Avatar } from "@/components/ui/avatar";
import { PROFILE_GAMES, type GameProfileCardData } from "../schemas/profile";
import styles from "./game-profiles.module.css";

export function GameProfileCard({ profile }: { profile: GameProfileCardData }) {
  return (
    <article className={styles.card} aria-label={`${profile.displayName}님의 게임 프로필`}>
      <header className={styles.cardHeading}>
        <Avatar name={profile.displayName} src={profile.avatarUrl} size={44} />
        <div className={styles.identity}>
          <h3>{profile.displayName}</h3>
          <span className={styles.muted}>{profile.isViewer ? "내 프로필 · " : ""}사용자 입력</span>
        </div>
      </header>
      <dl className={styles.games}>
        {profile.games.map((entry) => (
          <div key={entry.game} className={styles.gameRow}>
            <dt>{PROFILE_GAMES.find((game) => game.id === entry.game)?.shortName}</dt>
            <dd>
              <strong>{entry.nickname}</strong>
              <span>{entry.tier ?? "티어 미입력"}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.cardNote}>
        닉네임·티어는 본인이 작성했으며 계정 소유와 공식 티어는 확인하지 않았습니다.
      </p>
      <time className={styles.updated} dateTime={profile.updatedAt}>
        {new Date(profile.updatedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 수정
      </time>
    </article>
  );
}
