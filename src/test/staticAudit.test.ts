// 검수 정적 감사 — 반려 사유가 되는 문자열·API가 제품 코드에 0건인지 확인한다.
// 대상: src/**/*.{ts,tsx,css}에서 테스트 파일(*.test.*, src/test/**, src/__tests__/**)을 뺀 것.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function auditTargets(): string[] {
  return walk(SRC).filter((file) => {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    if (!/\.(ts|tsx|css)$/.test(rel)) return false;
    if (/\.test\.[^/]+$/.test(rel)) return false;
    if (rel.startsWith('test/') || rel.startsWith('__tests__/')) return false;
    return true;
  });
}

/** 위반 위치를 `파일:줄  내용`으로 모은다 — 실패 메시지에서 바로 찾게 한다. */
function violations(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of auditTargets()) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (pattern.test(line)) found.push(`${path.relative(SRC, file)}:${i + 1}  ${line.trim()}`);
      });
  }
  return found;
}

describe('정적 감사 — 검수 반려 패턴', () => {
  it('감사 대상에 제품 코드가 들어 있고 테스트 파일은 빠진다', () => {
    const rels = auditTargets().map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    expect(rels.length).toBeGreaterThan(10);
    expect(rels).toContain('App.tsx');
    expect(rels.some((r) => /\.test\./.test(r))).toBe(false);
    expect(rels.some((r) => r.startsWith('test/'))).toBe(false);
  });

  describe('F4-AC-8: 다크 모드·외부 이동·설치 유도', () => {
    it('HEX 색상 하드코딩이 0건이다', () => {
      expect(violations(/#[0-9a-fA-F]{3,8}\b/)).toEqual([]);
    });

    it('새 창 열기로 외부 이동하는 코드가 0건이다', () => {
      expect(violations(/window\.open\(/)).toEqual([]);
    });

    it('외부 http 주소로 페이지를 옮기는 코드가 0건이다', () => {
      expect(violations(/location\.href = 'http/)).toEqual([]);
    });

    it('앱 설치 유도 문자열이 0건이다', () => {
      expect(violations(/설치|다운로드/)).toEqual([]);
    });
  });

  describe('F7-AC-7: 구형 WebView 호환·외부 분석 SDK', () => {
    it.each([
      ['crypto.randomUUID', /crypto\.randomUUID/],
      ['structuredClone', /structuredClone/],
      ['Array.prototype.at', /\.at\(/],
      ['Object.hasOwn', /Object\.hasOwn/],
      ['Intl.Segmenter', /Intl\.Segmenter/],
    ])('%s 가 0건이다', (_name, pattern) => {
      expect(violations(pattern)).toEqual([]);
    });

    it('react-ga·@amplitude·firebase/analytics import가 0건이다', () => {
      expect(
        violations(
          /from\s+['"](react-ga|@amplitude[^'"]*|firebase\/analytics)['"]|require\(['"](react-ga|@amplitude[^'"]*|firebase\/analytics)['"]\)|import\(['"](react-ga|@amplitude[^'"]*|firebase\/analytics)['"]\)/,
        ),
      ).toEqual([]);
    });
  });
});
