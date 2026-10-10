// 월급·잔고 설정 폼 상태 — 입력 문자열·검증·저장을 한곳에 둔다. 입력값은 화면 컴포넌트 state에만 있고
// 저장이 ok일 때만 AppData(→ localStorage)로 넘어간다. 이동·Toast·계측은 호출한 화면이 한다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getToday } from '@/lib/date/getToday';
import type { PaySettings, WeekendRule } from '@/lib/types';
import { useAppData } from '@/state/AppDataContext';

export type SetupMode = 'onboarding' | 'edit';

export type SetupField = 'salary' | 'day' | 'balance';

/** 저장을 시도한 결과 — 'invalid'는 쓰기를 하지 않았다는 뜻이다. */
export type SubmitOutcome = 'saved' | 'invalid' | 'failed';

const FIELD_ORDER: readonly SetupField[] = ['salary', 'day', 'balance'];

const SALARY_MAX = 1_000_000_000;
const BALANCE_MAX = 9_999_999_999;

function validateSalary(digits: string): string | undefined {
  if (digits === '') return '월급 실수령액을 입력해주세요';
  const value = Number(digits);
  if (!Number.isInteger(value) || value <= 0) return '0원보다 큰 금액을 입력해주세요';
  if (value > SALARY_MAX) return '10억 원 이하로 입력해주세요';
  return undefined;
}

function validateDay(digits: string): string | undefined {
  if (digits === '') return '월급일을 입력해주세요';
  const value = Number(digits);
  if (!Number.isInteger(value) || value < 1 || value > 31) return '1~31 사이 날짜를 입력해주세요';
  return undefined;
}

function validateBalance(digits: string): string | undefined {
  if (digits === '') return '지금 잔고를 입력해주세요';
  const value = Number(digits);
  if (!Number.isInteger(value) || value > BALANCE_MAX) return '잔고는 9,999,999,999원 이하로 입력해주세요';
  return undefined;
}

export interface UseSetupFormOptions {
  mode: SetupMode;
  /** 마운트 시 잔고 칸으로 포커스를 옮긴다(홈의 '지금 잔고 입력'에서 진입). */
  focusBalance?: boolean;
}

export function useSetupForm({ mode, focusBalance = false }: UseSetupFormOptions) {
  const { settings, saveSettings } = useAppData();

  // 시작값은 마운트 때 한 번만 읽는다 — 저장 직후 settings가 바뀌어도 입력값은 건드리지 않는다.
  const [initial] = useState<PaySettings | null>(() => (mode === 'edit' ? settings : null));

  const [salary, setSalary] = useState(() => (initial ? String(initial.salaryAmount) : ''));
  const [day, setDay] = useState(() => (initial ? String(initial.salaryDay) : ''));
  const [balance, setBalance] = useState(() => (initial ? String(initial.currentBalance) : ''));
  const [weekendRule, setWeekendRule] = useState<WeekendRule>(() => initial?.salaryWeekendRule ?? 'none');
  const [touched, setTouched] = useState<Record<SetupField, boolean>>({ salary: false, day: false, balance: false });
  const [submitted, setSubmitted] = useState(false);

  const values: Record<SetupField, string> = { salary, day, balance };
  const errors: Record<SetupField, string | undefined> = {
    salary: validateSalary(salary),
    day: validateDay(day),
    balance: validateBalance(balance),
  };
  const hasEmptyField = FIELD_ORDER.some((field) => values[field] === '');

  /** 빈 칸 문구는 칸을 벗어난 뒤에, 범위 오류 문구는 저장을 시도한 뒤에 보인다. */
  const shownErrors: Record<SetupField, string | undefined> = {
    salary: undefined,
    day: undefined,
    balance: undefined,
  };
  for (const field of FIELD_ORDER) {
    const isEmpty = values[field] === '';
    const visible = isEmpty ? touched[field] : submitted;
    shownErrors[field] = visible ? errors[field] : undefined;
  }

  const slots = useRef<Partial<Record<SetupField, HTMLElement | null>>>({});

  /** 칸을 감싼 요소에 달아 두면 focusField가 그 안의 input을 찾는다. */
  const bindField = (field: SetupField) => (el: HTMLElement | null) => {
    slots.current[field] = el;
  };

  const focusField = useCallback((field: SetupField) => {
    try {
      slots.current[field]?.querySelector('input')?.focus();
    } catch {
      // 포커스를 못 옮겨도 입력은 그대로 쓸 수 있다.
    }
  }, []);

  useEffect(() => {
    if (focusBalance) focusField('balance');
    // 진입 시점의 요청만 따른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = useCallback((field: SetupField) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  function submit(): SubmitOutcome {
    // Enter 키도 여기로 온다 — 버튼이 disabled인 동안은 어떤 경로로도 쓰지 않는다.
    if (hasEmptyField) {
      setTouched({ salary: true, day: true, balance: true });
      const firstEmpty = FIELD_ORDER.find((field) => values[field] === '');
      if (firstEmpty) focusField(firstEmpty);
      return 'invalid';
    }
    setSubmitted(true);
    const firstError = FIELD_ORDER.find((field) => errors[field]);
    if (firstError) {
      focusField(firstError);
      return 'invalid';
    }

    const currentBalance = Number(balance);
    // 잔고를 바꾼 경우에만 기준일을 오늘로 옮긴다 — 월급·월급일만 고친 저장은 기준일을 건드리지 않는다.
    const keepAsOf = initial !== null && initial.currentBalance === currentBalance;
    const next: PaySettings = {
      version: 1,
      salaryAmount: Number(salary),
      salaryDay: Number(day),
      salaryWeekendRule: weekendRule,
      currentBalance,
      balanceAsOf: keepAsOf ? initial.balanceAsOf : getToday(),
    };
    return saveSettings(next).ok ? 'saved' : 'failed';
  }

  return {
    values,
    weekendRule,
    /** 화면에 보여 줄 오류 문구 */
    errors: shownErrors,
    /** 비어 있는 칸이 없다 — SubmitFooter의 활성 조건 */
    canSubmit: !hasEmptyField,
    /** 저장된 잔고 기준일. 처음 설정이면 null */
    balanceAsOf: initial?.balanceAsOf ?? null,
    setSalary,
    setDay,
    setBalance,
    setWeekendRule,
    touch,
    bindField,
    submit,
  };
}
