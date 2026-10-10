// 전역 테스트 셋업 — vitest.config.ts의 setupFiles에서 vitest.setup.ts 다음에 로드된다.
//  1) 테스트가 끝나면 localStorage를 비운다(테스트 간 저장값 누수 방지).
//  2) 테스트 중 console.error가 호출되면 그 자리에서 throw해 테스트를 실패시킨다
//     (React 경고·validateDOMNesting·미처리 에러 로그를 조용히 넘기지 않는다).
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  // restoreAllMocks를 부르는 테스트가 있어도 매 테스트 시작에 다시 건다.
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const message = args
      .map((arg) => (arg instanceof Error ? arg.message : String(arg)))
      .join(' ');
    throw new Error(`console.error가 호출되었습니다: ${message}`);
  });
});

afterEach(() => {
  localStorage.clear();
});
