import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { mockTds } from '@/__tests__/__helpers__/mocks';
import { NumericField } from '@/components/form/NumericField';

mockTds();

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: scrollIntoView,
  });
});

interface HarnessProps {
  initial?: string;
  onChange?: (v: string) => void;
  error?: string;
  onBlur?: () => void;
  onEnter?: () => void;
  disabled?: boolean;
}

function Harness({ initial = '', onChange, ...rest }: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <NumericField
      label="월급 실수령액 (원)"
      placeholder="예: 2,500,000"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
      {...rest}
    />
  );
}

function renderField(props: HarnessProps = {}) {
  render(<Harness {...props} />);
  return screen.getByLabelText('월급 실수령액 (원)') as HTMLInputElement;
}

describe('NumericField', () => {
  it("inputMode는 numeric이고 '2500000' 입력은 '2,500,000'으로 보이며 onChange에는 '2500000'이 넘어간다", () => {
    const onChange = vi.fn();
    const input = renderField({ onChange });

    expect(input.getAttribute('inputmode')).toBe('numeric');

    fireEvent.change(input, { target: { value: '2500000' } });

    expect(input.value).toBe('2,500,000');
    expect(onChange).toHaveBeenLastCalledWith('2500000');
  });

  it('콤마·문자가 섞인 입력은 숫자만 남겨 넘긴다', () => {
    const onChange = vi.fn();
    const input = renderField({ onChange });

    fireEvent.change(input, { target: { value: '1,250,000원' } });

    expect(onChange).toHaveBeenLastCalledWith('1250000');
    expect(input.value).toBe('1,250,000');
  });

  it("'abc'는 무시한다: 값은 ''이고 onChange 0회, 오류 문구 없음", () => {
    const onChange = vi.fn();
    const input = renderField({ onChange });

    fireEvent.change(input, { target: { value: 'abc' } });

    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('기존 값 뒤에 문자만 덧붙이면 값이 유지되고 onChange는 호출되지 않는다', () => {
    const onChange = vi.fn();
    const input = renderField({ initial: '300', onChange });

    fireEvent.change(input, { target: { value: '300x' } });

    expect(input.value).toBe('300');
    expect(onChange).toHaveBeenCalledTimes(0);
  });

  it("전부 지우면 onChange('')가 호출된다", () => {
    const onChange = vi.fn();
    const input = renderField({ initial: '5', onChange });

    fireEvent.change(input, { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith('');
    expect(input.value).toBe('');
  });

  it("포커스 시 scrollIntoView가 { block: 'center' }로 1회 호출된다", () => {
    const input = renderField();

    fireEvent.focus(input);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('error 문자열은 필드 아래 오류 문구로 표시된다', () => {
    const input = renderField({ error: '금액을 입력해 주세요' });

    expect(screen.getByRole('alert').textContent).toBe('금액을 입력해 주세요');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('error가 없으면 오류 표시가 없다', () => {
    const input = renderField();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('Enter는 disabled가 false일 때만 onEnter를 호출한다', () => {
    const onEnter = vi.fn();
    const input = renderField({ initial: '1000', onEnter });

    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'a' });

    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('disabled면 Enter를 눌러도 onEnter가 호출되지 않는다', () => {
    const onEnter = vi.fn();
    const input = renderField({ initial: '1000', onEnter, disabled: true });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onEnter).toHaveBeenCalledTimes(0);
  });

  it('포커스를 잃으면 onBlur가 1회 호출된다', () => {
    const onBlur = vi.fn();
    const input = renderField({ initial: '500', onBlur });

    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
