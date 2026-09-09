import Image from "next/image";
import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { DiscordIcon, Icon } from "@/components/ui/icon";
import { DailyTopic } from "@/features/lounge/components/daily-topic";
import { LoungeRecords } from "@/features/lounge/components/lounge-records";
import { getDailyTopics } from "@/features/lounge/domain/daily-topic";
import { getNumberClickRanking } from "@/features/ranking/server/ranking-service";
import { getPageViewer } from "@/lib/auth/page-viewer";
import { getDatabase } from "@/lib/db/client";
import { hasServerEnv } from "@/lib/env/server";
import { SERVICE_TIME_ZONE } from "@/lib/time/ranking-period";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const viewer = await getPageViewer();
  const now = new Date();
  const topics = getDailyTopics(now);
  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: SERVICE_TIME_ZONE,
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(now);
  let topFive: Awaited<ReturnType<typeof getNumberClickRanking>> = null;
  let rankingState: "ready" | "error" | "unavailable" = "unavailable";
  if (hasServerEnv()) {
    try {
      topFive = await getNumberClickRanking(getDatabase(), {
        period: "today",
        limit: 5,
        offset: 0,
        viewerId: viewer?.id ?? null,
      });
      rankingState = "ready";
    } catch {
      rankingState = "error";
      console.error(
        JSON.stringify({
          level: "error",
          event: "home.ranking_lookup_failed",
        }),
      );
    }
  }

  return (
    <div className="lounge-page">
      <header className="lounge-heading">
        <div>
          <p className="eyebrow">YOUR DAILY HANGOUT</p>
          <h1>
            우리들의 라운지<span className="title-dot">.</span>
          </h1>
          <p>반가워요. 오늘은 어떤 이야기를 나눠볼까요?</p>
        </div>
        <span className="lounge-date">
          <Icon name="clock" size={15} />
          {dateLabel}
        </span>
      </header>

      <section className="lounge-hero" aria-labelledby="welcome-heading">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span /> 함께라서 더 즐거운 하루
          </span>
          <h2 id="welcome-heading">
            별일 없어도,
            <br />
            들렀다 가요.
          </h2>
          <p>
            게임 한 판, 소소한 수다, 어제보다 나은 기록.
            <br />
            디스코드 친구들과 이어지는 우리만의 아지트.
          </p>
          <a href="#daily-topic" className="button hero-button">
            오늘의 이야기 만나기 <Icon name="arrow" size={17} />
          </a>
        </div>
        <Image
          className="lounge-illustration"
          src="/lounge-room.svg"
          alt=""
          width={560}
          height={360}
          preload
        />
        <span className="hero-caption">GOOD COMPANY. GOOD TIMES.</span>
      </section>

      <div className="lounge-columns">
        <div className="lounge-feed">
          <DailyTopic topics={topics} />
          <LoungeRecords initialData={topFive} initialState={rankingState} />
          <section className="mini-game-section" aria-labelledby="minigame-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TAKE A LITTLE BREAK</p>
                <h2 id="minigame-heading">기다리는 동안, 잠깐 한 판</h2>
              </div>
              <Icon name="game" />
            </div>
            <Link href="/games/number-click" className="mini-game-card">
              <div className="mini-board" aria-hidden="true">
                {["1", "8", "3", "6", "2", "9", "4", "7", "5"].map((number) => (
                  <span key={number}>{number}</span>
                ))}
              </div>
              <div>
                <span className="game-tag">미니게임 · 혼자서도 가볍게</span>
                <h3>숫자 순서대로 누르기</h3>
                <p>1부터 25까지, 나만의 속도로 도전해요.</p>
                <span className="mini-game-link">
                  로그인 없이 연습하기 <Icon name="arrow" size={16} />
                </span>
              </div>
            </Link>
          </section>
        </div>

        <aside className="lounge-aside" aria-label="내 공간과 라운지 가이드">
          <section className="lounge-panel personal-card">
            <div className="personal-card-top">
              <span className="tiny-label">MY CORNER</span>
              <Icon name="spark" size={17} />
            </div>
            {viewer ? (
              <>
                <Avatar name={viewer.displayName} src={viewer.image} size={52} />
                <h2 className="profile-name">
                  {viewer.displayName}님,
                  <br />
                  다시 만나 반가워요.
                </h2>
                <p>
                  차곡차곡 쌓인 나의 기록,
                  <br />
                  오늘의 변화를 확인해 보세요.
                </p>
                <Link href="/me" className="button button-primary">
                  내 기록 보러 가기 <Icon name="arrow" size={16} />
                </Link>
              </>
            ) : (
              <>
                <span className="personal-avatar">
                  <DiscordIcon size={30} />
                </span>
                <h2>우리 사이, 한 걸음 더.</h2>
                <p>
                  디스코드 프로필로 함께하고
                  <br />
                  나만의 기록도 쌓아보세요.
                </p>
                <Link href="/login" className="button button-primary">
                  <DiscordIcon size={18} />
                  Discord로 함께하기
                </Link>
                <span className="personal-note">둘러보기와 연습은 로그인 없이 자유롭게</span>
              </>
            )}
          </section>
          <section className="weekly-card">
            <span className="icon-tile mint">
              <Icon name="trophy" />
            </span>
            <p className="eyebrow">THIS WEEK</p>
            <h2>이번 주의 주인공은?</h2>
            <p>
              익숙한 닉네임이 보이나요?
              <br />
              친구들의 한 주를 기록으로 만나보세요.
            </p>
            <Link href="/rankings/number-click?period=week" className="subtle-link">
              주간 랭킹 구경하기 <Icon name="arrow" size={16} />
            </Link>
          </section>
          <section className="lounge-guide" id="lounge-guide" aria-labelledby="guide-heading">
            <div className="section-heading">
              <h2 id="guide-heading">처음 오셨나요?</h2>
              <Icon name="book" size={18} />
            </div>
            <details>
              <summary>
                여기는 어떤 공간인가요?
                <Icon name="chevron" size={15} />
              </summary>
              <p>
                JGD.GG는 디스코드에서 만난 사람들이 게임 밖에서도 함께할 수 있는 라운지예요. 오늘의
                주제로 대화를 시작하고, 서로의 기록도 둘러보세요.
              </p>
            </details>
            <details>
              <summary>
                어떻게 함께하면 되나요?
                <Icon name="chevron" size={15} />
              </summary>
              <p>
                마음에 드는 대화 주제를 복사해서 평소 이용하는 디스코드 채널에 붙여넣어 보세요.
                로그인하지 않아도 주제와 공개 랭킹을 볼 수 있어요.
              </p>
            </details>
            <details>
              <summary>
                연습과 공식 기록은 달라요?
                <Icon name="chevron" size={15} />
              </summary>
              <p>
                연습은 로그인 없이 즐기며 기록이 저장되지 않아요. Discord 로그인 후 새로 플레이한
                공식 기록만 랭킹에 남아요. 연습 기록은 소급 등록되지 않아요.
              </p>
            </details>
          </section>
          <p className="aside-signoff">
            서로를 존중하는 한마디가
            <br />
            우리의 아지트를 더 편안하게 만들어요.<span>MAKE YOURSELF AT HOME.</span>
          </p>
        </aside>
      </div>
    </div>
  );
}
