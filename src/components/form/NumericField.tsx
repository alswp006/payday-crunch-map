import type { ChangeEvent, FocusEvent, KeyboardEvent } from 'react';
import { TextField } from '@toss/tds-mobile';

interface NumericFieldProps {
  /** 단위는 라벨에 넣는다: '월급 실수령액 (원)', '월급일 (일)' */
  label: string;
  /** 숫자 문자열 ('2500000'). 표시할 때만 콤마를 넣는다. */
  value: string;
  /** 숫자만 남긴 문자열. 숫자가 아닌 입력만 들어오면 호출하지 않는다. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** 문자열이면 필드 아래에 오류 문구로 표시한다. */
  error?: string;
  disabled?: boolean;
  onBlur?: () => void;
  /** Enter 키 — disabled가 아닐 때만 호출한다. */
  onEnter?: () => void;
  /** 다음 칸이 있으면 'next', 마지막 칸이면 'done' */
  enterKeyHint?: 'next' | 'done';
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

function withCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function NumericField({
  label,
  value,
  onChange,
  placeholder,
  error,
  disabled = false,
  onBlur,
  onEnter,
  enterKeyHint,
}: NumericFieldProps) {
  const digits = onlyDigits(value);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const next = onlyDigits(e.target.value);
    // 숫자가 아닌 글자만 더해진 입력은 값이 그대로라 조용히 무시한다.
    if (next === digits) return;
    onChange(next);
  }

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    // 키보드가 올라와도 입력 칸이 가려지지 않게 한다.
    try {
      e.currentTarget.scrollIntoView({ block: 'center' });
    } catch {
      // 스크롤을 지원하지 않는 WebView에서는 건너뛴다.
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !disabled) onEnter?.();
  }

  return (
    <TextField
      variant="box"
      label={label}
      labelOption="sustain"
      inputMode="numeric"
      enterKeyHint={enterKeyHint}
      placeholder={placeholder}
      value={withCommas(digits)}
      disabled={disabled}
      hasError={Boolean(error)}
      help={error || undefined}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={onBlur ? () => onBlur() : undefined}
      onKeyDown={handleKeyDown}
    />
  );
}
