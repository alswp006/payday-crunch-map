/**
 * Packet 0010 테스트: NumericField (src/components/form/NumericField.tsx).
 *
 * TDS TextField를 감싼 숫자 입력 필드. 표시값은 콤마, onChange에는 숫자 문자열만.
 * 아직 구현 파일이 없으므로 이 테스트는 red가 정상이다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

// 부모가 숫자 문자열을 들고 있는 실제 사용 형태를 그대로 재현한다.
function Harness({ initial = '', onChange, ...rest }: HarnessProps) {
  const [value, setValue] = React.useState(initial);
  return React.createElement(NumericField, {
    label: '월 실수령액',
    placeholder: '예: 2,500,000',
    value,
    onChange: (v: string) => {
      setValue(v);
      onChange?.(v);
    },
    ...rest,
  });
}

function renderField(props: HarnessProps = {}) {
  render(React.createElement(MemoryRouter, null, React.createElement(Harness, props)));
  return screen.getByLabelText('월 실수령액') as HTMLInputElement;
}

describe('숫자 입력 필드 NumericField (공용 컴포넌트)', () => {
  it("AC-1[P0]: inputMode는 'numeric'이고 '2500000' 입력은 '2,500,000'으로 보이며 onChange에는 '2500000'이 넘어간다", () => {
    const onChange = vi.fn();
    const input = renderField({ onChange });

    expect(input.getAttribute('inputmode')).toBe('numeric');

    fireEvent.change(input, { target: { value: '2500000' } });

    expect(input.value).toBe('2,500,000');
    expect(onChange).toHaveBeenLastCalledWith('2500000');
  });

  it('AC-1[P0]: 콤마가 섞인 값이나 문자가 섞인 값도 숫자만 남겨 onChange에 넘긴다', () => {
    const onChange = vi.fn();
    const input = renderField({ onChange });

    fireEvent.change(input, { target: { value: '1,250,000' } });
    expect(onChange).toHaveBeenLastCalledWith('1250000');
    expect(input.value).toBe('1,250,000');

    fireEvent.change(input, { target: { value: '1,250,000원' } });
    expect(onChange).toHaveBeenLastCalledWith('1250000');
    expect(input.value).toBe('1,250,000');
  });

  it("AC-2[P0]: 'abc'를 입력하면 값은 ''로 남고 onChange는 호출되지 않으며 오류 문구도 없다", () => {
    const onChange = vi.fn();
    const input = renderField({ onChange });

    fireEvent.change(input, { target: { value: 'abc' } });

    expect(input.value).toBe('');
    expect(onChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('AC-2[P0]: 이미 숫자가 있을 때 문자를 덧붙이면 기존 값이 유지된다', () => {
    const onChange = vi.fn();
    const input = renderField({ initial: '300', onChange });
    expect(input.value).toBe('300');

    fireEvent.change(input, { target: { value: '300x' } });

    // 숫자만 남기면 같은 값 '300'이므로 값은 그대로이고 오류 문구는 없다.
    expect(input.value).toBe('300');
    expect(screen.queryByRole('alert')).toBeNull();
    for (const call of onChange.mock.calls) expect(call[0]).toBe('300');
  });

  it("AC-3[P1]: 포커스 시 input.scrollIntoView가 { block: 'center' }로 1회 호출된다", () => {
    const input = renderField();
    expect(scrollIntoView).toHaveBeenCalledTimes(0);

    fireEvent.focus(input);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
  });

  it('AC-4[P0]: error 문자열은 필드 아래 오류 상태로 표시된다', () => {
    const input = renderField({ error: '금액을 입력해 주세요' });

    expect(screen.getByText('금액을 입력해 주세요')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toBe('금액을 입력해 주세요');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('AC-4[P0]: error가 없으면 오류 표시가 없다', () => {
    const input = renderField();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('AC-4[P0]: Enter 키는 disabled가 false일 때만 onEnter를 호출한다', () => {
    const onEnter = vi.fn();
    const input = renderField({ initial: '1000', onEnter, disabled: false });

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onEnter).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: 'a' });
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('AC-4[P0]: disabled가 true면 Enter를 눌러도 onEnter가 호출되지 않는다', () => {
    const onEnter = vi.fn();
    const input = renderField({ initial: '1000', onEnter, disabled: true });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onEnter).toHaveBeenCalledTimes(0);
    expect(input.value).toBe('1,000');
  });

  it('AC-4[P1]: 포커스를 잃으면 onBlur가 1회 호출된다', () => {
    const onBlur = vi.fn();
    const input = renderField({ initial: '500', onBlur });

    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('500');
  });
});
