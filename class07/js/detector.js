// YOLOv5n (COCO 80종) — 브라우저 안에서 onnxruntime-web으로 실행
// 출력 [1, 25200, 85] = 칸마다 (중심 x, 중심 y, 너비, 높이, 존재 확률, 클래스 확률 80개)
// 25200 = 3가지 격자(80×80, 40×40, 20×20) × 칸마다 상자 3개
const SIZE = 640;
const SCALES = [{ g: 80, s: 8 }, { g: 40, s: 16 }, { g: 20, s: 32 }];
let session = null, loading = null;

export async function loadModel(onStatus) {
  if (session) return session;
  if (loading) return loading;
  loading = (async () => {
    onStatus && onStatus('모델을 불러오는 중이에요… (처음 한 번, 약 20MB)');
    /* global ort */
    ort.env.wasm.wasmPaths = new URL('../vendor/ort/', import.meta.url).href;
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(new URL('../model/yolov5n.onnx', import.meta.url).href, { executionProviders: ['wasm'] });
    onStatus && onStatus('');
    return session;
  })();
  return loading;
}

// 원본(이미지·영상·캔버스)을 640×640에 비율을 유지해 넣기(레터박스)
const pre = document.createElement('canvas');
pre.width = pre.height = SIZE;
const pctx = pre.getContext('2d', { willReadFrequently: true });

function cellOf(index) {
  let i = index;
  for (const sc of SCALES) {
    const n = sc.g * sc.g * 3;
    if (i < n) {
      const a = Math.floor(i / (sc.g * sc.g));
      const rem = i % (sc.g * sc.g);
      return { grid: sc.g, stride: sc.s, anchor: a, row: Math.floor(rem / sc.g), col: rem % sc.g };
    }
    i -= n;
  }
  return null;
}

export async function detect(source, sw, sh, minConf = 0.05) {
  await loadModel();
  const r = Math.min(SIZE / sw, SIZE / sh);
  const nw = Math.round(sw * r), nh = Math.round(sh * r);
  const px = Math.floor((SIZE - nw) / 2), py = Math.floor((SIZE - nh) / 2);
  pctx.fillStyle = 'rgb(114,114,114)';
  pctx.fillRect(0, 0, SIZE, SIZE);
  pctx.drawImage(source, px, py, nw, nh);
  const { data } = pctx.getImageData(0, 0, SIZE, SIZE);
  const area = SIZE * SIZE;
  const input = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    input[i] = data[i * 4] / 255;
    input[area + i] = data[i * 4 + 1] / 255;
    input[2 * area + i] = data[i * 4 + 2] / 255;
  }
  const t0 = performance.now();
  const out = await session.run({ images: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
  const ms = performance.now() - t0;
  const o = out[session.outputNames[0]].data;
  const cands = [];
  const objMap = Array.from({ length: 20 }, () => new Float32Array(20));
  const K = 85;
  for (let i = 0; i < 25200; i++) {
    const b = i * K;
    const obj = o[b + 4];
    // 20×20 존재 확률 지도: 상자의 중심이 들어간 칸에 가장 큰 존재 확률을 기록
    const gx = Math.min(19, Math.max(0, Math.floor(o[b] / 32))), gy = Math.min(19, Math.max(0, Math.floor(o[b + 1] / 32)));
    if (obj > objMap[gy][gx]) objMap[gy][gx] = obj;
    if (obj < minConf) continue;
    let best = 0, bc = -1;
    for (let c = 0; c < 80; c++) { const v = o[b + 5 + c]; if (v > best) { best = v; bc = c; } }
    const conf = obj * best;
    if (conf < minConf) continue;
    const cx = (o[b] - px) / r, cy = (o[b + 1] - py) / r, w = o[b + 2] / r, h = o[b + 3] / r;
    cands.push({ index: i, cell: cellOf(i), obj, cls: bc, clsProb: best, conf,
      x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });
  }
  // 존재 확률 지도를 원본 좌표로 옮기기 위한 정보
  return { cands, objMap, ms, letterbox: { r, px, py } };
}

export function iou(a, b) {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const inter = ix * iy;
  const ua = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - inter;
  return ua > 0 ? inter / ua : 0;
}

// 같은 클래스끼리 NMS (실제 탐지용)
export function nms(boxes, thr) {
  const sorted = [...boxes].sort((a, b) => b.conf - a.conf);
  const keep = [];
  const removed = new Set();
  for (let i = 0; i < sorted.length; i++) {
    if (removed.has(i)) continue;
    keep.push(sorted[i]);
    for (let j = i + 1; j < sorted.length; j++) {
      if (!removed.has(j) && sorted[j].cls === sorted[i].cls && iou(sorted[i], sorted[j]) >= thr) removed.add(j);
    }
  }
  return keep;
}
