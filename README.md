# Payday Crunch Map

이 앱을 쓰고 나면 사용자는 월세 이체일을 월급일 다음 날로 옮기거나 카드 결제일을 변경해 월중 최저 잔고를 늘린다.

## Tech Stack

- React 18.0.0
- TypeScript
- Vitest

## Routes

| Path | Description |
|------|-------------|
| `/Home.test` | Hometest |
| `/Home` | Home |
| `/Items.test` | Itemstest |
| `/Items` | Items |
| `/Setup.test` | Setuptest |
| `/Setup` | Setup |
| `/home/useMonthRollover` | UseMonthRollover |
| `/setup/useSetupForm` | UseSetupForm |

## Getting Started

```bash
pnpm install
pnpm dev
```

## Development

```bash
pnpm typecheck    # Type checking
pnpm test         # Run tests
pnpm build        # Production build
```

## Design Documents

See `.ai-factory/` directory for full design artifacts:
- `prd.md` — Product Requirements Document
- `spec.md` — Technical Specification
- `task.md` — Epic/Task Breakdown

---
Built with [AI Factory](https://github.com/alswp006/ai-factory) · Last synced: 2026-10-10
