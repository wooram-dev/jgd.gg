export const AXES = [
  {
    name: "플레이 목표",
    poles: [
      { code: "R", label: "승부형", description: "승리와 기록을 향해 한 판 더" },
      { code: "F", label: "즐김형", description: "재미있는 과정이면 이미 좋은 한 판" },
    ],
    together: "오늘은 기록에 도전할지, 편하게 즐길지 시작 전에 정해 봐요.",
  },
  {
    name: "문제 해결",
    poles: [
      { code: "P", label: "계획형", description: "준비와 전략으로 길을 만드는 편" },
      { code: "I", label: "즉흥형", description: "직접 부딪치며 방법을 찾는 편" },
    ],
    together: "공략을 먼저 볼지, 한 번 해 보고 이야기할지 맞춰 봐요.",
  },
  {
    name: "플레이 호흡",
    poles: [
      { code: "T", label: "합류형", description: "같은 목표를 함께 풀 때 신나는 편" },
      { code: "S", label: "자율형", description: "내 역할과 속도를 존중받을 때 편한 편" },
    ],
    together: "함께 움직일 구간과 각자 자유롭게 할 구간을 나눠 봐요.",
  },
  {
    name: "대화 스타일",
    poles: [
      { code: "V", label: "수다형", description: "플레이도 대화도 함께 즐기는 편" },
      { code: "Q", label: "집중형", description: "필요한 말만 나누며 몰입하는 편" },
    ],
    together: "집중할 순간에는 짧게 콜하고, 쉬는 시간에 수다를 나눠 봐요.",
  },
] as const;

export type Choice = 0 | 1;
type AxisIndex = 0 | 1 | 2 | 3;

export const QUESTIONS: readonly {
  axis: AxisIndex;
  title: string;
  choices: readonly [string, string];
}[] = [
  {
    axis: 0,
    title: "오늘 게임을 켠 이유는?",
    choices: ["목표 기록이나 승리에 도전하고 싶어서", "부담 없이 즐거운 시간을 보내고 싶어서"],
  },
  {
    axis: 1,
    title: "처음 보는 보스가 나타났다!",
    choices: ["패턴과 공략을 먼저 살펴본다", "일단 도전하면서 감을 잡는다"],
  },
  {
    axis: 2,
    title: "친구와 넓은 맵에 들어왔다면?",
    choices: ["같은 곳을 함께 탐험한다", "각자 둘러보다 발견한 것을 나눈다"],
  },
  {
    axis: 3,
    title: "게임 중 음성 채널에서 나는?",
    choices: ["리액션과 잡담도 자주 나누는 편", "필요한 이야기 위주로 나누는 편"],
  },
  {
    axis: 0,
    title: "아깝게 진 한 판이 끝나면?",
    choices: ["아쉬운 장면을 짚고 다음 승리를 노린다", "재미있던 장면을 이야기하며 넘긴다"],
  },
  {
    axis: 1,
    title: "새 캐릭터를 시작할 때는?",
    choices: ["스킬과 장비 조합을 미리 생각한다", "끌리는 스킬부터 써 보며 바꿔 간다"],
  },
  {
    axis: 2,
    title: "협동 미션에서 더 신나는 순간은?",
    choices: ["친구와 타이밍을 맞춰 함께 해결할 때", "맡은 일을 내 방식으로 해결해 보탤 때"],
  },
  {
    axis: 3,
    title: "매칭을 기다리는 시간에는?",
    choices: ["친구에게 오늘 있었던 일을 이야기한다", "잠깐 쉬거나 다음 플레이를 생각한다"],
  },
  {
    axis: 0,
    title: "오늘 정말 잘 놀았다고 느낄 때는?",
    choices: ["목표를 달성하거나 실력이 늘었을 때", "뜻밖의 장면 덕분에 실컷 웃었을 때"],
  },
  {
    axis: 1,
    title: "어려운 구간에 다시 도전한다면?",
    choices: ["다음 시도에서 할 일을 정리한다", "새로운 방법을 바로 시험해 본다"],
  },
  {
    axis: 2,
    title: "친구와 플레이 속도가 다를 때는?",
    choices: ["진도를 맞추며 같이 진행하고 싶다", "각자 진행하고 필요한 순간에 만나고 싶다"],
  },
  {
    axis: 3,
    title: "플레이가 한창 잘 풀릴 때 나는?",
    choices: ["감탄과 응원을 말로 나눈다", "흐름에 몰입하며 조용히 이어 간다"],
  },
];

export const TYPES = {
  RPTV: {
    name: "작전 짜는 파티장",
    description: "승리할 작전을 나누고, 팀의 호흡을 말로 이어 가요.",
  },
  RPTQ: { name: "침착한 지휘관", description: "준비한 전략과 간결한 콜로 팀의 목표에 다가가요." },
  RPSV: {
    name: "브리핑하는 전문가",
    description: "내 역할의 해법을 준비하고, 발견한 팁을 나누는 걸 즐겨요.",
  },
  RPSQ: {
    name: "고요한 전략가",
    description: "차분히 계획을 세우고, 내 페이스로 목표를 공략해요.",
  },
  RITV: {
    name: "돌격대의 응원단장",
    description: "새로운 승부에 함께 뛰어들고, 생생한 리액션으로 힘을 보태요.",
  },
  RITQ: {
    name: "집중하는 돌파대원",
    description: "팀과 직접 부딪치며 해법을 찾고, 결정적인 순간에 집중해요.",
  },
  RISV: {
    name: "승부를 즐기는 모험가",
    description: "나만의 승리 공식을 시험하고, 도전의 순간을 이야기로 풀어요.",
  },
  RISQ: {
    name: "몰입하는 개척자",
    description: "새로운 방법을 조용히 시도하며 내 기록을 넘어가요.",
  },
  FPTV: {
    name: "소풍 준비하는 길드장",
    description: "함께 즐길 거리를 미리 챙기고, 대화가 흐르는 파티를 좋아해요.",
  },
  FPTQ: { name: "차분한 동행자", description: "편안한 여정을 준비하고, 같은 풍경을 함께 즐겨요." },
  FPSV: {
    name: "취향 나누는 수집가",
    description: "나만의 즐길 거리를 정리하고, 좋아하는 것을 이야기해요.",
  },
  FPSQ: {
    name: "느긋한 설계자",
    description: "내가 좋아하는 방식과 속도로 작은 계획을 완성해 가요.",
  },
  FITV: {
    name: "즉흥 파티의 분위기메이커",
    description: "친구와 예상 밖의 순간에 뛰어들고, 웃을 거리를 찾아요.",
  },
  FITQ: {
    name: "말없이 함께하는 탐험가",
    description: "정해진 길 없이 함께 돌아다니며 게임 속 순간에 빠져들어요.",
  },
  FISV: {
    name: "썰 많은 자유여행자",
    description: "마음 가는 대로 놀다가, 재미있는 발견을 친구에게 들려줘요.",
  },
  FISQ: {
    name: "조용한 자유여행자",
    description: "내 속도로 발길 닿는 곳을 둘러보며 소소한 재미를 찾아요.",
  },
} as const;

export type TypeCode = keyof typeof TYPES;
export const TYPE_CODES = Object.keys(TYPES) as TypeCode[];

export function isTypeCode(value: string): value is TypeCode {
  return Object.hasOwn(TYPES, value);
}

export function calculateType(answers: readonly unknown[]) {
  if (answers.length !== QUESTIONS.length) throw new Error("모든 질문에 답해 주세요.");
  // Array.from also checks holes in a sparse array as unanswered questions.
  const choices = Array.from(answers);
  if (!choices.every((answer) => answer === 0 || answer === 1)) {
    throw new Error("각 질문에서 하나의 답을 골라 주세요.");
  }
  const axes = AXES.map((axis, index) => {
    const firstVotes = QUESTIONS.reduce(
      (count, question, questionIndex) =>
        count + (question.axis === index && choices[questionIndex] === 0 ? 1 : 0),
      0,
    );
    const pole = axis.poles[firstVotes >= 2 ? 0 : 1];
    return { name: axis.name, ...pole, votes: Math.max(firstVotes, 3 - firstVotes) };
  });
  const code = axes.map((axis) => axis.code).join("");
  if (!isTypeCode(code)) throw new Error("성향을 계산할 수 없습니다.");
  return { code, ...TYPES[code], axes };
}

export function compareTypes(mine: TypeCode, friend: TypeCode) {
  return AXES.map((axis, index) => ({
    name: axis.name,
    mine: axis.poles[mine[index] === axis.poles[0].code ? 0 : 1].label,
    friend: axis.poles[friend[index] === axis.poles[0].code ? 0 : 1].label,
    same: mine[index] === friend[index],
    prompt: axis.together,
  }));
}

export function formatTypeSummary(mine: TypeCode, friend: TypeCode | null) {
  const lines = ["[JGD.GG 게임 성향]", `${mine} · ${TYPES[mine].name}`, TYPES[mine].description];
  if (friend) {
    const comparison = compareTypes(mine, friend);
    lines.push(
      `친구: ${friend} · ${TYPES[friend].name}`,
      `같은 성향 ${comparison.filter((axis) => axis.same).length}/4개`,
      ...comparison.map((axis) => `${axis.name}: 나 ${axis.mine} / 친구 ${axis.friend}`),
    );
  }
  lines.push("재미로 보는 게임 취향 · JGD.GG /게임궁합");
  return lines.join("\n");
}
