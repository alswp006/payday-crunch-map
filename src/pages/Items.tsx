import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateHapticFeedback } from '@apps-in-toss/web-framework';
import {
  Asset,
  Button,
  Chip,
  ChipItem,
  ConfirmDialog,
  Paragraph,
  Spacing,
  Top,
  useToast,
} from '@toss/tds-mobile';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { SubmitFooter } from '@/components/BottomCTA';
import { Card } from '@/components/Card';
import { MiniBar } from '@/components/MiniBar';
import { EmptyState } from '@/components/StateView';
import { OutflowList, outflowRatioPercent } from '@/components/items/OutflowList';
import { OutflowSheet } from '@/components/items/OutflowSheet';
import type { OutflowSheetValues } from '@/components/items/OutflowSheet';
import { useAppData } from '@/state/AppDataContext';
import { fireAndForget, logClick } from '@/lib/analytics';
import { getToday } from '@/lib/date/getToday';
import { formatWon } from '@/lib/format';
import { MAX_OUTFLOWS } from '@/lib/store/validate';
import type { Outflow, SaveResult } from '@/lib/types';
import type { ItemsRouteState } from '@/types/nav';

const PRESET_NAMES = ['월세', '카드값', '통신비', '보험료', '구독료'] as const;

const MSG_ADDED = '추가했어요';
const MSG_SAVED = '저장했어요';
const MSG_DELETED = '삭제했어요';
const MSG_FAILED = '저장하지 못했어요. 다시 시도해주세요';
const MSG_LIMIT = `출금 항목은 ${MAX_OUTFLOWS}개까지 등록할 수 있어요`;

type SheetState =
  | { open: false }
  | { open: true; mode: 'add'; initialName?: string }
  | { open: true; mode: 'edit'; item: Outflow };

export default function Items() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openToast } = useToast();
  const { settings, outflows, addOutflow, updateOutflow, removeOutflow } = useAppData();

  const routeState = (location.state as ItemsRouteState | null) ?? null;
  const openAdd = routeState?.openAdd === true;
  const fromOnboarding = routeState?.from === 'onboarding';

  const [sheet, setSheet] = useState<SheetState>({ open: false });
  // 시트가 닫히는 동안에도 마지막 내용을 유지해 깜빡임 없이 내려가게 한다.
  const [lastSheet, setLastSheet] = useState<Exclude<SheetState, { open: false }>>({ open: true, mode: 'add' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const atLimit = outflows.length >= MAX_OUTFLOWS;

  function showSheet(next: Exclude<SheetState, { open: false }>) {
    setLastSheet(next);
    setSheet(next);
  }

  function openAddSheet(initialName?: string) {
    if (atLimit) {
      openToast(MSG_LIMIT);
      return;
    }
    showSheet({ open: true, mode: 'add', initialName });
  }

  // openAdd로 진입하면 시트를 연 직후 state를 비워, 재마운트·재진입에서 시트가 다시 열리지 않게 한다.
  const handledOpenAdd = useRef(false);
  useEffect(() => {
    if (!openAdd) {
      handledOpenAdd.current = false;
      return;
    }
    if (handledOpenAdd.current) return;
    handledOpenAdd.current = true;
    if (outflows.length >= MAX_OUTFLOWS) {
      openToast(MSG_LIMIT);
    } else {
      const next: Exclude<SheetState, { open: false }> = { open: true, mode: 'add' };
      setLastSheet(next);
      setSheet(next);
    }
    navigate('.', { replace: true, state: { ...routeState, openAdd: false } });
    // 진입 시점의 state만 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openAdd]);

  function closeSheet() {
    setSheet({ open: false });
    setConfirmDelete(false);
  }

  /** 저장 결과를 토스트로 알리고, 성공했을 때만 시트를 닫는다. 실패하면 시트는 입력값을 쥔 채 열려 있다. */
  function finish(result: SaveResult, successMessage: string) {
    if (!result.ok) {
      openToast(MSG_FAILED);
      return;
    }
    openToast(successMessage);
    closeSheet();
  }

  function handleSubmit(values: OutflowSheetValues) {
    if (!sheet.open) return;
    if (sheet.mode === 'add') {
      logClick('outflow_add_submit');
      finish(addOutflow(values), MSG_ADDED);
      return;
    }
    const { name, amount, weekendRule, day } = values;
    finish(updateOutflow(sheet.item.id, { name, amount, weekendRule }, day, getToday()), MSG_SAVED);
  }

  function handleConfirmDelete() {
    if (!sheet.open || sheet.mode !== 'edit') {
      setConfirmDelete(false);
      return;
    }
    const result = removeOutflow(sheet.item.id);
    if (!result.ok) {
      // 대화상자만 닫고 수정 시트·항목은 그대로 둔다.
      setConfirmDelete(false);
      openToast(MSG_FAILED);
      return;
    }
    finish(result, MSG_DELETED);
  }

  function handlePreset(name: string) {
    fireAndForget(() => generateHapticFeedback({ type: 'tickWeak' }));
    openAddSheet(name);
  }

  const total = outflows.reduce((sum, item) => sum + item.amount, 0);
  const percent = outflowRatioPercent(total, settings?.salaryAmount);
  const summaryText =
    percent === null
      ? `매월 출금 합계 ${formatWon(total)}원`
      : `매월 출금 합계 ${formatWon(total)}원 · 월급의 ${percent}%`;

  const deleteTarget = sheet.open && sheet.mode === 'edit' ? sheet.item : null;
  const shown = sheet.open ? sheet : lastSheet;

  return (
    <ScreenScaffold
      top={<Top title={<Top.TitleParagraph>출금 항목</Top.TitleParagraph>} />}
      bottom={
        fromOnboarding ? (
          <SubmitFooter label="달력 보기" onClick={() => navigate('/', { replace: true })} />
        ) : undefined
      }
    >
      <Spacing size={16} />
      <Card testId="outflow-total">
        <Paragraph.Text typography="t4" fontWeight="bold">
          {summaryText}
        </Paragraph.Text>
        {percent !== null ? (
          <>
            <Spacing size={8} />
            <MiniBar ratio={percent / 100} />
          </>
        ) : null}
      </Card>
      <Spacing size={16} />

      {outflows.length > 0 ? (
        <OutflowList
          items={outflows}
          onSelect={(item) => showSheet({ open: true, mode: 'edit', item })}
        />
      ) : (
        <EmptyState
          icon={<Asset.ContentIcon name="icon-plus-small-mono" alt="" style={{ width: 48, height: 48 }} />}
          title="아직 등록한 출금이 없어요"
          action={
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Paragraph.Text typography="t7" color="var(--adaptiveGrey600)">
                자주 쓰는 항목을 눌러 바로 추가해요
              </Paragraph.Text>
              <Spacing size={12} />
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Chip kind="action" wrap margin="none" style={{ justifyContent: 'center' }}>
                  {PRESET_NAMES.map((name) => (
                    <ChipItem key={name} onClick={() => handlePreset(name)}>
                      {name}
                    </ChipItem>
                  ))}
                </Chip>
              </div>
            </div>
          }
        />
      )}

      <Spacing size={24} />
      <Button variant="fill" size="large" display="block" onClick={() => openAddSheet()}>
        출금 추가
      </Button>
      <Spacing size={fromOnboarding ? 96 : 24} />

      <OutflowSheet
        open={sheet.open}
        mode={shown.mode}
        initial={shown.mode === 'edit' ? shown.item : undefined}
        initialName={shown.mode === 'add' ? shown.initialName : undefined}
        onSubmit={handleSubmit}
        onDelete={() => setConfirmDelete(true)}
        onClose={closeSheet}
      />

      <ConfirmDialog
        open={confirmDelete && deleteTarget !== null}
        title={deleteTarget ? `'${deleteTarget.name}' 항목을 삭제할까요?` : ''}
        cancelButton={
          <ConfirmDialog.CancelButton onClick={() => setConfirmDelete(false)}>닫기</ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton onClick={handleConfirmDelete}>삭제</ConfirmDialog.ConfirmButton>
        }
        onClose={() => setConfirmDelete(false)}
      />
    </ScreenScaffold>
  );
}
