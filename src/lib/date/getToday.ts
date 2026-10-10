import type { LocalDate } from '@/lib/types';

function pad(n: number, width: number): string {
  let s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}

/**
 * 오늘 날짜(로컬 기준 'YYYY-MM-DD'). 앱에서 오늘을 얻는 유일한 함수다.
 * UTC로 바꾸면 자정 전후 하루가 밀리므로 로컬 연·월·일을 그대로 쓴다.
 */
export function getToday(): LocalDate {
  const now = new Date();
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}
