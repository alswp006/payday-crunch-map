// navigate state 계약 — 라우트로 넘기는 state는 이 타입과 같아야 한다.

/** /setup 진입 state */
export type SetupRouteState = {
  mode: 'onboarding' | 'edit';
  focus?: 'balance';
};

/** /items 진입 state */
export type ItemsRouteState = {
  from?: 'onboarding';
  openAdd?: boolean;
};
