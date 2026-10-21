# React UI Coding Standards — AI Code-Generation Rules

**Applies to:** [`apps/web`](../../apps/web/package.json:1), [`apps/admin`](../../apps/admin/package.json:1), `packages/ui`, `packages/api-client`.
**Stack:** React 18, TypeScript strict, Vite, Tailwind CSS v4 (`@theme` tokens), TanStack Query v5, Zustand, react-hook-form + Zod, React Router 6.
**Authority:** this file wins over generic advice, habit or personal preference. Architecture reference: [`docs/Specs/UI-Architecture.md`](../../docs/Specs/UI-Architecture.md:1) — it documents how this repo implements the rules below (layer map, tokens, primitives, per-page state plan, new-page recipe, dependency list).

---

## 0. Non-negotiables

1. **Components render.** They do not fetch, validate business rules, map domain data or own page-wide state.
2. **All backend access** goes through a service in `packages/api-client`, consumed only through TanStack Query hooks in `features/`.
3. **Three state buckets only:** server data → TanStack Query; page UI state → that page's Zustand store; form state → react-hook-form. Never mix them.
4. **One page = one folder.** Its store lives inside the folder and is never imported by another page.
5. **No color literals, no Tailwind palette utilities, no arbitrary color values.** Only `packages/ui` tokens and primitives.
6. **Imports flow downwards only:** `app → pages → features → entities → services → lib`. No page→page, no feature→feature imports.
7. **SOLID / KISS / DRY:** one function = one responsibility; pure functions preferred; extract duplication instead of copying it.
8. **Every async UI path** implements loading / empty / error / success.
9. **New code ships with tests.** Tests never hit the network.
10. **When structure or tokens change**, update `docs/Specs/UI-Architecture.md` in the same change.

---

## 1. Folder layout

```text
apps/<app>/src/
  app/                    providers, router, layout shell, error boundary, session store
  pages/<page>/
    <Page>.tsx            route entry — composition only
    <page>.store.ts       page-scoped Zustand factory (see §6)
    <page>.interface.ts   page-local types
    <page>.const.ts       query keys, defaults, labels
    ui/                   page-only presentational parts
  features/<use-case>/
    use-<use-case>.ts     TanStack Query hooks
    <use-case>.logic.ts   pure business rules
    <use-case>.interface.ts
    <use-case>.const.ts
  entities/<entity>/
    <entity>.interface.ts domain types + view models
    <entity>.mapper.ts    dto → view model (pure)
    components/           entity display components (Badge, Row…)
  services/               composition root: client instance + token supplier
  components/             shared presentational shells (layout, error, empty)
  lib/                    pure helpers and formatters
  test/mocks/             ALL mocks/stubs live here
```

```text
packages/ui/src/
  styles/theme.css        @theme tokens, base layer, semantic utilities
  components/<primitive>/<Primitive>.tsx
  components/<primitive>/<primitive>.variants.ts
  lib/cn.ts               clsx + tailwind-merge
  index.ts                explicit exports only

packages/api-client/src/
  http-client.ts          request wrapper, ApiError
  <domain>/<domain>.service.ts/.interface.ts
```

---

## 2. Layer contracts

| Layer | May contain | Must never contain |
|---|---|---|
| `app` | Providers, router, layout, error boundary, session store | Business rules, domain types, fetch calls |
| `pages` | Route composition, page store, page-only UI parts | `fetch`, business rules, imports from other pages |
| `features` | Query/mutation hooks, pure logic, use-case types | JSX trees, direct DOM/storage access, other features |
| `entities` | Domain types, mappers, display components | Effects, fetching, page state |
| `services` | Client wiring, auth token supplier | React imports (`react`, hooks, components) |
| `components` | Generic presentational shells | Data access, domain knowledge |
| `lib` | Pure helpers/formatters | React state, side effects |

Shared code between pages/features goes to `entities` or `lib` — never imported sideways.

---

## 3. Naming and file conventions

| Kind | Convention | Example |
|---|---|---|
| Component file | `PascalCase.tsx`, named export | `CallbackForm.tsx` → `export function CallbackForm(...)` |
| Hook | `use-kebab-case.ts` | `use-submit-callback.ts` |
| Pure logic | `<name>.logic.ts` | `callback-form.logic.ts` |
| Types | `<name>.interface.ts` | `dashboard.interface.ts` |
| Constants | `<name>.const.ts` | `dashboard.const.ts` |
| Store | `<page>.store.ts` | `dashboard.store.ts` |
| Service | `<domain>.service.ts` | `callback-requests.service.ts` |
| Variants | `<primitive>.variants.ts` | `button.variants.ts` |

Also: named exports only (no `export default`), no `export *` barrels, `async/await` over `.then`, camelCase values, PascalCase types, no `any` (use `unknown` + narrowing), no inline object types — declare a named type. Imports use explicit `.js` extensions inside apps.

---

## 4. Services — the only place that talks to the backend

```ts
export interface CallbackRequestsService {
  list(filters: CallbackRequestsFilters): Promise<CallbackRequest[]>;
  create(input: CreateCallbackRequestInput): Promise<CallbackRequest>;
  findById(id: string): Promise<CallbackRequest | null>;
}
```

- Responses are parsed with the shared Zod schemas (`@callback/shared`) at the boundary; malformed payloads throw `ApiError`.
- Errors are custom classes (`ApiError`, `ValidationError`), never bare `new Error('Hiba')` in new code.
- The HTTP client receives `baseUrl` and an optional `getToken()` **injected**; services never read `import.meta.env` or storage directly.
- No React import is allowed in `packages/api-client`.

---

## 5. Business logic layer

- Rules live in pure `*.logic.ts` functions: filter, sort, map status → label/variant, compute totals. No JSX, no hooks, no I/O.
- Orchestration lives in `features/*/use-*.ts` (query/mutation, cache invalidation, optimistic updates).
- One function = one responsibility; split before it exceeds ~30 lines or needs a comment to explain its parts.
- Extend behaviour by adding variants/strategies, not by editing existing branches where practical.

```ts
export function toStatusVariant(status: CallbackRequestStatus): BadgeVariant {
  switch (status) {
    case 'queued':
      return 'warning';
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}
```

---

## 6. State: three buckets

| Bucket | Owner | Examples | Forbidden inside |
|---|---|---|---|
| Server state | TanStack Query | request lists, call details, mutation results | copy of server data in Zustand |
| Page UI state | page-local Zustand store | filters, sort, tabs, selected row, drawer open | server data, derived server data |
| Form state | react-hook-form | field values, field errors, dirty/touched | submitting to services directly |

Rules:

- Query keys are declared in `*.const.ts` and reused — never inline arrays in components.
- Invalidate/refetch through the query client after mutations; do not hand-patch unrelated caches.
- Store factory pattern (below) — one store instance per mounted page, so state resets on navigation.
- `persist` is allowed only with an explicit whitelist (`partialize`) and documented in the state plan.
- Components subscribe with selectors: `useDashboardStore((s) => s.filters)`.
- The only global store is `useSessionStore` (token, role) in `app/`.

```ts
import { createStore } from 'zustand/vanilla';

export interface DashboardState {
  readonly filters: CallbackRequestsFilters;
}
export interface DashboardActions {
  setFilters: (patch: Partial<CallbackRequestsFilters>) => void;
}
export type DashboardStore = DashboardState & DashboardActions;

export function createDashboardStore(init?: Partial<DashboardState>) {
  return createStore<DashboardStore>()((set) => ({
    filters: { ...DEFAULT_FILTERS, ...init?.filters },
    setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  }));
}
```

The page folder owns `<Page>StoreProvider` + `use<Page>Store<T>(selector)`; no store export leaves that folder.

---

## 7. Styling: tokens only

Every color, border, radius, shadow and duration comes from `packages/ui/src/styles/theme.css`:

| Group | Token → class |
|---|---|
| Brand | `--color-primary/-foreground`, `--color-secondary`, `--color-tertiary`, `--color-quaternary` → `bg-primary`, `text-primary-foreground`, `bg-tertiary` |
| Surface | `--color-surface-base/-raised/-sunken/-overlay` → `bg-surface-raised` |
| Border | `--color-border-hairline/-default/-strong/-focus` → `border-border-hairline` |
| Text | `--color-text-primary/-secondary/-muted/-inverse` → `text-text-secondary` |
| State | `--color-success/-warning/-danger/-info` + `-foreground` → `bg-danger text-danger-foreground` |
| Depth | `--shadow-neu-raised/-inset/-pressed`, `--shadow-focus-ring` → `shadow-neu-raised` |
| Thickness | `--border-width-hairline/-default/-strong` → utility classes `border-hairline`, `border-strong` |
| Shape | `--radius-control/-card/-pill` → `rounded-control` |
| Motion | `--duration-fast/-base`, `--ease-neu` → `transition-shadow duration-fast` |

Dark neomorphism recipes:

| Element | Classes |
|---|---|
| Raised card | `rounded-card border border-hairline bg-surface-raised shadow-neu-raised` |
| Sunken input | `rounded-control border border-hairline bg-surface-sunken shadow-neu-inset` |
| Pressed button | `shadow-neu-pressed` on `:active` / disabled |
| Focus | `focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring` |
| Overlay | `bg-surface-overlay` + `shadow-neu-raised` |

Hard rules:

1. No hex/rgb/hsl/oklch literals anywhere in `apps/*/src`.
2. No Tailwind palette utilities (`bg-slate-800`, `text-indigo-500`, `ring-red-900`, …), no palette opacity modifiers.
3. No arbitrary color values (`bg-[#101010]`). Arbitrary values for layout (`grid-cols-[2fr_1fr]`) are allowed.
4. New visual concepts are built **once** in `packages/ui` as a primitive or variant — never inline in a page.
5. Variants via CVA in `<primitive>.variants.ts`; merge classes with `cn()`.
6. Class order: layout → spacing → surface/border/shadow → typography → state/motion.
7. Text tokens must keep WCAG AA contrast on their surface; neomorphic depth must not be the only state indicator.

```ts
export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-control border border-hairline font-medium transition-shadow duration-fast focus-visible:outline-none focus-visible:border-border-focus focus-visible:shadow-focus-ring disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-neu-raised hover:bg-primary-hover',
        secondary: 'bg-surface-raised text-text-primary shadow-neu-raised hover:shadow-neu-pressed',
        ghost: 'bg-transparent text-text-secondary hover:text-text-primary',
        danger: 'bg-danger text-danger-foreground shadow-neu-raised',
      },
      size: { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-base' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
```

---

## 8. Components and accessibility

- Props-driven, no hidden dependencies; `readonly` props interfaces; callbacks named `onX`.
- One component per file; split when a component renders more than two visual regions or exceeds ~120 lines.
- Every input has a `<label htmlFor>`; icons get `aria-hidden`; interactive elements are `<button>`/`<a>`.
- Always render explicit loading/empty/error states (see §9); never a bare `null`.
- Page composition order: header → filters/actions → content → footer extras.

---

## 9. Error handling and UX states

- Services throw typed errors; hooks surface them via TanStack Query `error`.
- UI maps errors to user messages through a pure `toErrorMessage(error): string` helper.
- Never swallow errors in an empty `catch`. If a failure is intentionally ignored, log it and comment why.
- Mutations disable their trigger and show progress; retries are user-triggered.

---

## 10. Testing

- Vitest + Testing Library; config per app; mocks/stubs/fixtures live in `src/test/mocks/**` — never defined inside test files.
- Mandatory coverage: `*.logic.ts` (all branches), stores (all actions), primitives (variants/render), hooks (success + error + loading).
- Mock the service layer, never `fetch` internals; no real timers, no real network.
- Test names describe behaviour: `it('maps failed status to danger badge')`.

---

## 11. Anti-patterns

| Do not | Do instead |
|---|---|
| `useEffect` + `fetch` in a component | query hook in `features/` |
| Server data copied into Zustand | read from the query cache |
| `statusBadgeClass()` inside a page | mapper + `Badge` variant |
| `className="bg-slate-800 text-slate-100"` | `Card` / token classes |
| Importing another page's store | page-local store, share via `entities`/`lib` |
| Fetch inside a shared component | props + hook in the page/feature |
| Inline `{ id: string; name: string }` props | named interface in `.interface.ts` |
| `any`, `as unknown as`, non-null `!` | narrow with guards/Zod |
| New npm dependency added silently | document it in `docs/Specs/UI-Architecture.md` |

---

## 12. New page recipe

1. Create `pages/<page>/` with `<Page>.tsx`, `<page>.interface.ts`, `<page>.const.ts`.
2. Add the server needs to `packages/api-client` (interface + implementation + Zod schema).
3. Add `features/<use-case>/use-*.ts` (query/mutation) and move decisions into `*.logic.ts`.
4. If the page has UI state, add `<page>.store.ts` + provider/hook; otherwise add no store.
5. Compose the page from `packages/ui` primitives and page-only parts in `ui/`.
6. Implement loading/empty/error/success explicitly.
7. Register the route in `app/router`.
8. Add tests (logic, store, hook) and mocks in `src/test/mocks`.
9. Add a row to the state plan in `docs/Specs/UI-Architecture.md`.
10. Run `pnpm lint`, `pnpm test`, `pnpm build` for the app.

---

## 13. Definition of done

- [ ] No `fetch` outside `packages/api-client`.
- [ ] No business rule inside JSX; logic extracted to `*.logic.ts`.
- [ ] Server state in TanStack Query, page state in the page store, forms in RHF — no mixing.
- [ ] No color literal, palette class or arbitrary color: `rg "#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-\d{2,3}" apps/web/src apps/admin/src` returns nothing.
- [ ] Only `packages/ui` primitives used for buttons, inputs, cards, badges, alerts, tables.
- [ ] Loading / empty / error / success states present.
- [ ] Tests added and green; lint clean.
- [ ] `docs/Specs/UI-Architecture.md` updated if structure, tokens or page state changed.

> Transitional rule: files that are not yet migrated must not gain new violations. When you modify such a file substantially, migrate that file to this standard in the same change.
