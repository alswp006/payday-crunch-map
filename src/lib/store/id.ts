// 출금 항목 id 생성. 구형 WebView(Android 7 · iOS 16 미만)에 없는 UUID API 대신 시각·순번·난수로 만든다.

const SEQ_MODULO = 1679616; // 36^4 — 접미사는 최대 4자
const RANDOM_LEN = 6;
const MAX_LEN = 32;

/** 같은 밀리초 안에서 여러 번 불려도 겹치지 않게 하는 순번(base36 접미사) */
let seq = 0;
/** 직전에 발급한 id — 시계가 되돌아가도 같은 값을 다시 내지 않는다 */
let lastId = '';

/** 난수 base36 6자. Math.random()이 0이어도 빈 문자열이 되지 않게 0으로 채운다 */
function randomPart(): string {
  const raw = Math.random().toString(36).slice(2, 2 + RANDOM_LEN);
  return raw.padEnd(RANDOM_LEN, '0');
}

/** [0-9a-z] 1 ~ 32자. 시각(36진수) + 난수 6자 + 순번 */
export function newId(): string {
  let id = '';
  do {
    seq = (seq + 1) % SEQ_MODULO;
    id = (Date.now().toString(36) + randomPart() + seq.toString(36)).slice(0, MAX_LEN);
  } while (id === lastId);
  lastId = id;
  return id;
}
