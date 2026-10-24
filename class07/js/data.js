// 원리 탐구용 예시 데이터 — 7차시 PPT·학습지와 같은 숫자
// 좌표 단위: 격자 한 칸 = 1 (사진 전체 = 가로 7, 세로 7)

export const N = 7;

export const CLASS_COLORS = {
  '자동차': '#1B2A41', '보행자': '#0070C0', '자전거': '#2E7D32', '신호등': '#E02020',
};
const EXTRA_COLORS = ['#7A4FD0', '#D9604F', '#9A6508', '#0E7C8A', '#B5473A', '#4A5A6B', '#C2185B', '#00897B'];
export function colorOf(label) {
  if (CLASS_COLORS[label]) return CLASS_COLORS[label];
  let h = 0;
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EXTRA_COLORS[h % EXTRA_COLORS.length];
}

// 수업용 일러스트(횡단보도 장면) — PPT 7차시 7~16쪽, 학습지와 같은 값
export const SCENE = {
  id: 'scene',
  name: '횡단보도 장면 (수업용 일러스트)',
  src: 'img/scene.jpg',
  classes: ['자동차', '자전거', '보행자', '신호등'],
  boxes: [
    { label: '자동차', x0: 0.9, y0: 3.45, x1: 3.7, y1: 5.55 },
    { label: '보행자', x0: 3.65, y0: 2.7, x1: 5.75, y1: 6.9 },
    { label: '자전거', x0: 3.15, y0: 4.55, x1: 6.65, y1: 6.65 },
    { label: '신호등', x0: 5.4, y0: 0.15, x1: 6.8, y1: 5.05 },
  ],
  // ② 칸마다 물체가 있을 확률 (PPT·학습지의 표, 행 = 위에서부터)
  prob: [
    [0, 0, 0, 0, 0, 0.5, 0.6],
    [0, 0, 0, 0, 0, 0.6, 0.7],
    [0, 0, 0, 0, 0.1, 0.1, 0.1],
    [0, 0.2, 0.4, 0.1, 0.4, 0.05, 0],
    [0, 0.8, 1, 0.5, 0.6, 0.3, 0],
    [0, 0.5, 0.2, 0.5, 0.7, 1, 0.4],
    [0, 0, 0, 0.4, 0.2, 0.4, 0.4],
  ],
  // ④ 칸별 클래스 확률 (열, 행은 0부터) — 순서: 자동차, 자전거, 보행자, 신호등
  cls: {
    '2,4': [0.90, 0.05, 0.03, 0.02],
    '4,4': [0.05, 0.13, 0.80, 0.02],
    '4,5': [0.04, 0.70, 0.24, 0.02],
    '6,2': [0.02, 0.03, 0.05, 0.90],
    '3,3': [0.60, 0.20, 0.15, 0.05],
  },
  // ⑤ 신뢰도 표에 넣을 칸
  confCells: ['2,4', '4,4', '4,5', '6,2', '3,3'],
  // 심화: NMS 후보 상자 (A~C 자동차, D 보행자 — PPT와 같음 / E~G 추가)
  candidates: [
    { id: 'A', label: '자동차', conf: 0.90, x0: 0.9, y0: 3.45, x1: 3.7, y1: 5.55 },
    { id: 'B', label: '자동차', conf: 0.75, x0: 1.3, y0: 3.25, x1: 4.1, y1: 5.35 },
    { id: 'C', label: '자동차', conf: 0.60, x0: 0.6, y0: 3.75, x1: 3.3, y1: 5.85 },
    { id: 'D', label: '보행자', conf: 0.48, x0: 3.65, y0: 2.7, x1: 5.75, y1: 6.9 },
    { id: 'E', label: '자전거', conf: 0.49, x0: 3.15, y0: 4.55, x1: 6.65, y1: 6.65 },
    { id: 'F', label: '자전거', conf: 0.36, x0: 3.4, y0: 4.4, x1: 6.9, y1: 6.5 },
    { id: 'G', label: '보행자', conf: 0.31, x0: 3.4, y0: 2.9, x1: 5.5, y1: 6.8 },
  ],
};

// ---------- 직접 만든 사진 예시: 확률·후보 상자를 '학습용 예시 값'으로 만들기 ----------
function round1(v) { return Math.round(v * 10) / 10; }

export function prepareSample(s) {
  if (s.prob && s.cls && s.candidates) return s;
  const classes = s.classes && s.classes.length ? s.classes : [...new Set(s.boxes.map(b => b.label))];
  const prob = Array.from({ length: N }, () => Array(N).fill(0));
  const cls = {};
  s.boxes.forEach(b => {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const cc = Math.min(N - 1, Math.floor(cx)), cr = Math.min(N - 1, Math.floor(cy));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const inside = (c + 1 > b.x0 && c < b.x1 && r + 1 > b.y0 && r < b.y1);
      let v = 0;
      if (c === cc && r === cr) v = 0.9;
      else if (inside) v = Math.max(0.1, 0.7 - 0.2 * Math.hypot(c - cc, r - cr));
      prob[r][c] = Math.max(prob[r][c], round1(v));
    }
    const k = cc + ',' + cr;
    const rest = classes.length > 1 ? 0.2 / (classes.length - 1) : 0;
    cls[k] = classes.map(name => name === b.label ? 0.8 : Math.round(rest * 100) / 100);
  });
  let cand = s.candidates;
  if (!cand) {
    // 정답 상자마다 조금씩 어긋난 상자 2개를 더한 학습용 후보
    cand = [];
    const ids = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    s.boxes.forEach((b, i) => {
      const w = b.x1 - b.x0, h = b.y1 - b.y0;
      const base = 0.9 - i * 0.07;
      [[0, 0, 0], [0.12, -0.08, 0.14], [-0.1, 0.1, 0.27]].forEach(([dx, dy, dc]) => {
        cand.push({ label: b.label, conf: Math.round((base - dc) * 100) / 100,
          x0: b.x0 + dx * w, y0: b.y0 + dy * h, x1: b.x1 + dx * w, y1: b.y1 + dy * h });
      });
    });
    cand.sort((a, b) => b.conf - a.conf).forEach((c, i) => { c.id = ids[i] || String(i + 1); });
  }
  const confCells = Object.keys(cls);
  return { ...s, classes, prob: s.prob || prob, cls: s.cls || cls, candidates: cand, confCells: s.confCells || confCells, generated: true };
}

// COCO 80개 클래스 한국어 이름 (실제 탐지용)
export const COCO_KO = ['사람', '자전거', '자동차', '오토바이', '비행기', '버스', '기차', '트럭', '보트', '신호등',
  '소화전', '정지 표지판', '주차 미터기', '벤치', '새', '고양이', '개', '말', '양', '소',
  '코끼리', '곰', '얼룩말', '기린', '배낭', '우산', '핸드백', '넥타이', '여행 가방', '원반',
  '스키', '스노보드', '공', '연', '야구 배트', '야구 글러브', '스케이트보드', '서프보드', '테니스 라켓', '병',
  '와인잔', '컵', '포크', '칼', '숟가락', '그릇', '바나나', '사과', '샌드위치', '오렌지',
  '브로콜리', '당근', '핫도그', '피자', '도넛', '케이크', '의자', '소파', '화분', '침대',
  '식탁', '변기', 'TV', '노트북', '마우스', '리모컨', '키보드', '휴대폰', '전자레인지', '오븐',
  '토스터', '싱크대', '냉장고', '책', '시계', '꽃병', '가위', '곰 인형', '헤어드라이어', '칫솔'];
