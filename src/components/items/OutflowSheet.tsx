import { useState } from 'react';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import { BottomSheet, Button, Chip, ChipItem, Paragraph, Spacing, TextField } from '@toss/tds-mobile';
import { NumericField } from '@/components/form/NumericField';
import { fireAndForget } from '@/lib/analytics';
import type { WeekendRule } from '@/lib/types';

export interface OutflowSheetValues {
  name: string;
  amount: number;
  day: number;
  weekendRule: WeekendRule;
}

export interface OutflowSheetProps {
  open: boolean;
  mode: 'add' | 'edit';
  /** edit 모드에서 세 필드를 채울 값. weekendRule이 없으면 '그대로'. */
  initial?: { name: string; amount: number; day: number; weekendRule?: WeekendRule };
  /** add 모드에서 이름 칸만 채워서 연다(이름 프리셋). */
  initialName?: string;
  /** 검증을 통과했을 때만 호출한다. 저장은 부모가 한다. */
  onSubmit: (values: OutflowSheetValues) => void;
  /** edit 모드의 '삭제' 버튼 */
  onDelete?: () => void;
  onClose: () => void;
}

type FieldKey = 'name' | 'amount' | 'day';

const NAME_MAX_LENGTH = 20;
const AMOUNT_MAX = 100_000_000;

const WEEKEND_OPTIONS: ReadonlyArray<{ rule: WeekendRule; label: string }> = [
  { rule: 'none', label: '그대로' },
  { rule: 'prevBusinessDay', label: '직전 평일' },
  { rule: 'nextBusinessDay', label: '다음 평일' },
];

function haptic(type: 'success' | 'tickWeak') {
  fireAndForget(() => generateHapticFeedback({ type }));
}

function validateName(name: string): string | undefined {
  if (name.trim() === '') return '항목 이름을 입력해주세요';
  if (name.trim().length > NAME_MAX_LENGTH) return '이름은 20자 이하로 입력해주세요';
  return undefined;
}

function validateAmount(amount: string): string | undefined {
  if (amount === '') return '금액을 입력해주세요';
  const value = Number(amount);
  if (!Number.isInteger(value) || value <= 0) return '0원보다 큰 금액을 입력해주세요';
  if (value > AMOUNT_MAX) return '1억 원 이하로 입력해주세요';
  return undefined;
}

function validateDay(day: string): string | undefined {
  if (day === '') return '출금일을 입력해주세요';
  const value = Number(day);
  if (!Number.isInteger(value) || value < 1 || value > 31) return '1~31 사이 날짜를 입력해주세요';
  return undefined;
}

interface BodyProps extends OutflowSheetProps {}

function OutflowSheetBody({ open, mode, initial, initialName, onSubmit, onDelete, onClose }: BodyProps) {
  const editing = mode === 'edit';
  // 시트가 열린 동안은 부모가 다시 렌더돼도 입력값을 유지한다 — 초기값은 마운트 때 한 번만 읽는다.
  const [name, setName] = useState(() => (editing ? initial?.name : initialName) ?? '');
  const [amount, setAmount] = useState(() => (editing && initial ? String(initial.amount) : ''));
  const [day, setDay] = useState(() => (editing && initial ? String(initial.day) : ''));
  const [weekendRule, setWeekendRule] = useState<WeekendRule>(() => (editing ? initial?.weekendRule : undefined) ?? 'none');
  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({ name: false, amount: false, day: false });

  const errors: Record<FieldKey, string | undefined> = {
    name: validateName(name),
    amount: validateAmount(amount),
    day: validateDay(day),
  };
  // 이름은 공백만 있어도 빈 값이 아니다 — 버튼은 활성이고 제출할 때 막는다(F3-AC-9).
  const hasEmptyField = name === '' || amount === '' || day === '';
  const shown = (key: FieldKey) => (touched[key] ? errors[key] : undefined);

  function touch(key: FieldKey) {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }

  function handleSubmit() {
    if (hasEmptyField) return;
    if (errors.name || errors.amount || errors.day) {
      setTouched({ name: true, amount: true, day: true });
      return;
    }
    haptic('success');
    onSubmit({ name: name.trim(), amount: Number(amount), day: Number(day), weekendRule });
  }

  function handleWeekendRule(rule: WeekendRule) {
    haptic('tickWeak');
    setWeekendRule(rule);
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={<BottomSheet.Header>{editing ? '출금 수정' : '출금 추가'}</BottomSheet.Header>}
      cta={
        <BottomSheet.CTA
          disabled={hasEmptyField}
          onClick={handleSubmit}
          topAccessory={
            hasEmptyField ? (
              <Paragraph typography="t7" color="var(--adaptiveGrey600)">
                이름, 금액, 출금일을 모두 입력해 주세요
              </Paragraph>
            ) : undefined
          }
          bottomAccessory={
            editing ? (
              <Button display="block" variant="weak" color="danger" size="large" onClick={() => onDelete?.()}>
                삭제
              </Button>
            ) : undefined
          }
        >
          {editing ? '저장하기' : '추가하기'}
        </BottomSheet.CTA>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 24px' }}>
        <TextField
          variant="box"
          label="이름"
          labelOption="sustain"
          placeholder="예: 월세"
          maxLength={NAME_MAX_LENGTH}
          enterKeyHint="next"
          value={name}
          hasError={Boolean(shown('name'))}
          help={shown('name')}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => touch('name')}
        />
        <Spacing size={12} />
        <NumericField
          label="금액 (원)"
          placeholder="예: 550,000"
          value={amount}
          error={shown('amount')}
          enterKeyHint="next"
          onChange={setAmount}
          onBlur={() => touch('amount')}
        />
        <Spacing size={12} />
        <NumericField
          label="매월 출금일 (일)"
          placeholder="예: 25"
          value={day}
          error={shown('day')}
          enterKeyHint="done"
          onChange={setDay}
          onBlur={() => touch('day')}
          onEnter={handleSubmit}
        />
        <Spacing size={12} />
        <Paragraph typography="t6">주말이면</Paragraph>
        <Spacing size={8} />
        <Chip kind="select" wrap>
          {WEEKEND_OPTIONS.map((option) => (
            <ChipItem
              key={option.rule}
              selected={weekendRule === option.rule}
              onClick={() => handleWeekendRule(option.rule)}
            >
              {option.label}
            </ChipItem>
          ))}
        </Chip>
        <Spacing size={24} />
      </div>
    </BottomSheet>
  );
}

/**
 * 출금 항목 추가·수정 공용 시트. 입력 검증만 하고 저장은 하지 않는다 — 통과하면 onSubmit(values)을 부른다.
 * 닫혔다가 다시 열릴 때마다 초기값으로 새로 시작하고, 열려 있는 동안은 입력값을 유지한다.
 */
export function OutflowSheet(props: OutflowSheetProps) {
  const [wasOpen, setWasOpen] = useState(props.open);
  const [session, setSession] = useState(0);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setSession((s) => s + 1);
  }
  return <OutflowSheetBody key={session} {...props} />;
}
