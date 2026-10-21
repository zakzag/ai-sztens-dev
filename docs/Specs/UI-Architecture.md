# UI Architecture — `@callback/ui`, tokens and admin app layers

**Utolsó frissítés:** 2026-10-21
**Status:** living document — describes the *current* state of the React side of the monorepo.
**Authority:** [`react.coding-standards.md`](../../.roo/rules/react.coding-standards.md:1) is the
normative rule set; this document explains how the repo implements it. Where this document and
the rule set disagree, the rule set wins and this document is the bug.

## 1. Where the pieces live

| Package / app | Role | Build |
|---|---|---|
| `packages/ui` | Design tokens + presentational primitives. **Source-only** (no `dist`): consumers bundle the `.ts`/`.tsx` sources directly. | `tsc --noEmit` (type check only) |
| `packages/api-client` | The only place that talks to the backend (typed services + Zod parsing at the boundary). Tested with **jest + ts-jest**. | `tsc` → `dist` |
| `packages/shared` | Wire schemas, shared pure helpers used by API, web and admin. Tested with jest. | `tsc` → `dist` |
| `apps/admin` | Admin SPA. Consumes `@callback/ui` primitives and `@callback/api-client` services. Tested with **vitest + Testing Library**. | `tsc --noEmit` + `vite build` |
| `apps/web` | Public site. Not yet migrated to the token layer — see §2. | `tsc --noEmit` + `vite build` |

Why `packages/ui` has no build step (decision **D14** of the AIS-57 plan): its only
consumer is a Vite bundle, so a `dist` would add a build ordering dependency and
would let Tailwind scan stale output. The `predev`/`test` root scripts therefore
only build `@callback/shared`.

## 2. Layer map (apps)

```text
app → pages → features → entities → services → lib
```

Imports flow downwards only — no page→page, no feature→feature imports.

The rule file describes the **target** structure. The table below shows both the target and
what exists in `apps/admin` today, so nobody mistakes a planned folder for an existing one.

| Layer | Target contents | State in `apps/admin/src` (2026-10-21) |
|---|---|---|
| `app` | providers, router, layout shell, session store | **not created**: `App.tsx` (router + `ProtectedLayout`) and `main.tsx` (`QueryClientProvider`) still sit at the `src` root; the session lives in `auth/AuthContext.tsx` + `auth/session-token.ts`, there is no Zustand session store |
| `pages/<page>` | route composition, optional page store, page-only parts in `ui/` | **exists**: `pages/api-keys/` (`ApiKeysPage.tsx`, `api-keys.const.ts`, `.interface.ts`, `.logic.ts`, `ui/ApiKeysTable.tsx`, `ui/ApiKeyForm.tsx`) — the first page folder; plus the flat `pages/LoginPage.tsx` and `pages/PlaceholderPage.tsx` |
| `features/<use-case>` | query/mutation hooks, pure `*.logic.ts` | **exists**: `features/api-keys/` (`api-keys.const.ts`, `.interface.ts`, `.logic.ts`, `use-api-keys.ts`) |
| `entities/<entity>` | domain types, pure mappers, display components | **exists**: `entities/api-key/` (`api-key.interface.ts`, `api-key.mapper.ts`, `api-key.const.ts`) — mappers only, no display components yet |
| `services` | composition root (client instance + token supplier) | **exists**: `services/api-client.ts` + `services/api-client.const.ts` |
| `lib` | pure helpers and formatters | **exists**: `lib/date.ts`, `lib/error-message.ts` (+ their `*.const.ts`) |
| `test/mocks` | all fixtures, doubles, wrappers | **exists**: `test/mocks/api-keys.mock.ts`, `api-error.mock.ts`, `query-client.mock.tsx` |

`apps/web` is out of scope for this document's layer map: it has no features/entities
folders yet and is not migrated to `packages/ui` tokens.

## 3. Design tokens (`packages/ui/src/styles/theme.css`)

Consumers import the token file right after Tailwind and register the primitive
sources for class scanning:

```css
@import "tailwindcss";
@import "../../../packages/ui/src/styles/theme.css";
@source "../../../packages/ui/src";
```

### 3.1 Colour tokens

| Group | Tokens | Typical utility |
|---|---|---|
| Brand | `--color-primary`, `--color-primary-hover`, `--color-primary-foreground`, `--color-secondary(-foreground)`, `--color-tertiary`, `--color-quaternary` | `bg-primary`, `text-primary-foreground` |
| Surface | `--color-surface-base/-raised/-sunken/-overlay` | `bg-surface-raised` |
| Border | `--color-border-hairline/-default/-strong/-focus` | `border-border-hairline` |
| Text | `--color-text-primary/-secondary/-muted/-inverse` | `text-text-secondary` |
| State | `--color-success/-warning/-danger/-info` (+ `-foreground`) | `bg-danger text-danger-foreground` |

### 3.2 Depth, shape, motion, thickness

| Group | Tokens | Utility |
|---|---|---|
| Depth | `--shadow-neu-raised`, `--shadow-neu-inset`, `--shadow-neu-pressed`, `--shadow-focus-ring` | `shadow-neu-raised` |
| Shape | `--radius-control`, `--radius-card`, `--radius-pill` | `rounded-card` |
| Motion | `--ease-neu`, `--duration-fast`, `--duration-base` | `duration-fast` |
| Thickness | `--border-width-hairline`, `--border-width-default`, `--border-width-strong` | `border-hairline`, `border-strong` |

`border-hairline`, `border-strong`, `duration-fast` and `duration-base` are
custom `@utility` declarations: Tailwind v4 has no theme namespace for border
widths or transition durations, so the tokens are plain custom properties
exposed through those utilities (decision **D15**).

### 3.3 Non-negotiable styling rules

1. No colour literal in `apps/*/src` — literals exist **only** in `theme.css`.
2. No Tailwind palette utility (`bg-slate-800`, `text-indigo-500`, …) and no
   palette opacity modifiers.
3. No arbitrary colour values (`bg-[#101010]`); arbitrary *layout* values
   (`grid-cols-[2fr_1fr]`) are allowed.
4. New visual concepts are built once in `packages/ui` as a primitive or a CVA
   variant — never inline in a page.

Definition-of-done check, bash / ripgrep (run from the repo root, must print nothing):

```bash
rg "#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}" apps/admin/src apps/web/src
```

The same check without ripgrep, on Windows:

```powershell
Get-ChildItem -Path 'apps/admin/src' -Recurse -File |
  Where-Object { $_.Extension -in '.ts','.tsx','.css' } |
  Select-String -Pattern '#[0-9a-fA-F]{3,8}|(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|indigo|red|amber|green|emerald|blue)-[0-9]{2,3}'
```

## 4. Primitives (`packages/ui/src/components`)

| Primitive | Variants / props | Notes |
|---|---|---|
| `Button` | `variant`: `primary` \| `secondary` \| `ghost` \| `danger`; `size`: `sm` \| `md` \| `lg`; `isLoading` | `type` defaults to `button` (**D17**); submitting requires an explicit `type="submit"`. Loading sets `disabled` + `aria-busy`. |
| `Input` | `label`, `id`, `error`, `hint`, `invalid` | `id` is required so the label association is deterministic. Error wins over hint; `aria-invalid` + `aria-describedby` are wired. Forwards its ref so react-hook-form can focus the first invalid field. |
| `Textarea` | same props as `Input` + `rows` (default `4`) | Multi-line twin of `Input` — same sunken recipe, `resize-y`, ref forwarded. Added by AIS-41 so a 2000-character description does not live in a one-line field. |
| `Card` | `title`, `description` | Raised surface; title renders as an `h2`. |
| `Table` + `TableHead` / `TableBody` / `TableRow` / `TableHeaderCell` / `TableCell` | native attributes | `Table` owns the scroll container; header cells default to `scope="col"`. |
| `Badge` | `variant`: `neutral` \| `info` \| `success` \| `warning` \| `danger` | Variant names are the shared vocabulary for domain mappers. |
| `Alert` | `variant`: `info` \| `success` \| `warning` \| `danger`, `title` | `danger` is announced as `role="alert"`, the others as `role="status"`. |

Exports are explicit from `packages/ui/src/index.ts` (no `export *`). `cn()` is
exported too so pages can merge caller classes with the recipe classes.

## 5. State plan per page

Three buckets only: server state → TanStack Query, page UI state → that page's
Zustand store, form state → react-hook-form. Never mix them. A page appears in this table
even when **two of the three buckets are intentionally empty** — "no store" is a decision, not
an omission (compare **D9**).

| Page | Server state | Page UI state | Form state | Notes |
|---|---|---|---|---|
| `pages/api-keys` (AIS-41, `/api-keys` route) | `useApiKeysQuery` / `useCreateApiKeyMutation` in `features/api-keys`; query keys only from `features/api-keys/api-keys.const.ts` (`API_KEYS_QUERY_KEYS`) | **none** — no Zustand store, no filters/sort/tabs (D9); the only local state is the form's page-level error in `ApiKeyForm` | react-hook-form + `zodResolver(apiKeyFormSchema)` (`pages/api-keys/api-keys.logic.ts`); `identifier` field carries the 409 via `setError` (D8/D36) | The table never renders `apiKey` — `entities/api-key/api-key.mapper.ts` drops it (D33); `expiresAt` goes through `lib/date.ts` (D6); the payload omits empty optional fields (D32) |
| `pages/LoginPage` (`/login` route) | none | none | `AuthContext` + `auth/session-token.ts` over `sessionStorage`; no RHF yet | The token storage key lives in one module only (D19). API-side auth guard is out of scope |
| `pages/PlaceholderPage` (`/` route) | none | none | none | Static shell for the authenticated landing route; replaced when a real dashboard lands |
| `/calls` route (inline in `App.tsx`) | none | none | none | Inline placeholder markup; becomes a page folder when the calls feature starts |

Adding a page means adding a row here in the same change (rule §0.10). If a page needs
page-wide UI state, it gets a page-local store factory inside its own folder — never a
global store; the only global store is the session store.

## 6. New page recipe

The rule file's §12 in repo terms. Every step is a review checkpoint.

1. Create `apps/admin/src/pages/<page>/` with `<Page>.tsx` (composition only),
   `<page>.interface.ts`, `<page>.const.ts`; add `<page>.store.ts` **only** if the page owns UI
   state (page-local `createStore` factory + provider/hook, never exported outside the folder).
2. Add the server need to `packages/api-client`: interface + implementation + the Zod schema in
   `packages/shared/src/schemas`, then parse at the HTTP boundary. No `fetch` outside this package.
3. Add `apps/admin/src/features/<use-case>/` — `use-<use-case>.ts` (query/mutation), pure rules in
   `<use-case>.logic.ts`, query keys in `<use-case>.const.ts`, narrow result interfaces in
   `<use-case>.interface.ts`.
4. Compose the page from `packages/ui` primitives and page-only parts under `pages/<page>/ui/`.
5. Implement loading / empty / error / success explicitly — a bare `null` is a defect.
6. Register the route in `App.tsx`'s `ProtectedLayout` (until `src/app/` exists) and add the nav
   link; keep the markup on token classes.
7. Add tests: `*.logic.ts` (all branches), the store (if any), the hook (success + error +
   loading), and the page parts. Doubles and fixtures go to `src/test/mocks/**`, never inline.
8. Add the page row to §5 of this document.
9. Run the per-app checks from §8, then the palette check from §3.3.

## 7. Dependency list (UI side)

| Dependency | Where | Why | State |
|---|---|---|---|
| `class-variance-authority` | `packages/ui` | variant recipes | installed |
| `clsx`, `tailwind-merge` | `packages/ui` | `cn()` class merging | installed |
| `tailwindcss` + `@tailwindcss/vite` | `apps/admin` | Tailwind v4 pipeline | installed |
| `@tanstack/react-query` | `apps/admin` | server-state bucket | installed |
| `react-router-dom` | `apps/admin` | routing | installed |
| `@callback/shared`, `@callback/ui`, `@callback/api-client` | `apps/admin` | workspace packages | installed |
| `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | `packages/ui`, `apps/admin` | component + hook tests | installed |
| `jest`, `ts-jest`, `@types/jest` | `packages/shared`, `packages/api-client` | framework-free package tests (D13) | installed |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `@eslint/js` | `apps/admin` | lint harness | installed |
| `react-hook-form` | `apps/admin` | form-state bucket (`ApiKeyForm`) | installed (`^7.54.2`, resolved 7.90.0) |
| `zod` (direct dependency) | `apps/admin` | form schema validation | installed (`^3.24.1`, resolved 3.25.76) — **pinned to v3** so `zodResolver` accepts the zod-3 schema objects from `@callback/shared` (D30) |
| `@hookform/resolvers` | `apps/admin` | `zodResolver` for react-hook-form | installed (`^3.9.1`, resolved 3.10.0) — the v3 line, matching zod v3 |
| `zustand` | `apps/admin` | page-local stores, global session store | **planned — added with the first page that needs UI state** (`/api-keys` has none, D9) |

Adding a dependency requires updating this table in the same change. Rows marked
*planned* must not be read as available.

## 8. Verification commands

```bash
# framework-free packages (jest)
pnpm --filter @callback/shared test
pnpm --filter @callback/api-client test

# React side (vitest)
pnpm --filter @callback/ui test
pnpm --filter @callback/ui build      # tsc type check only
pnpm --filter @callback/admin test
pnpm --filter @callback/admin lint
pnpm --filter @callback/admin build

# everything, from the repo root
pnpm test
```

`pnpm --filter @callback/admin build` is also the check that the Tailwind
`@source` registration works: the emitted `dist/assets/*.css` must contain the
token utilities (`shadow-neu-raised`, `bg-primary`, `rounded-control`, …).
The palette check in §3.3 is part of the definition of done as well.
