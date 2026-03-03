# Admin Web Assessment & Refactoring Plan

## Overview

This document captures all improvements, refactoring opportunities, and best-practice gaps identified in `apps/admin_web`. Each item includes the affected files, the problem, and a concrete specification for the fix. Items are ordered by priority.

---

## HIGH Priority

### 1. Extract `useFormValidation` hook

**Problem:** The same touched/submitted/validation pattern is copy-pasted across 9 files. Each re-implements `touchedFields`, `markTouched`, `shouldShowError`, `hasSubmitted`, `requiredIndicator`, `errorInputClassName`, and `formKey`/`isFormEmpty`.

**Affected files:**

- `src/components/shared/schedules-panel.tsx`
- `src/components/shared/locations-panel.tsx`
- `src/components/shared/pricing-panel.tsx`
- `src/components/shared/organizations-panel.tsx`
- `src/components/shared/activities-panel.tsx`
- `src/components/shared/activity-categories-panel.tsx`
- `src/components/admin/feedback-labels-panel.tsx`
- `src/components/admin/access-request-form.tsx`
- `src/components/admin/suggestion-form.tsx`

**Specification:**

1. Create `src/hooks/use-form-validation.ts`.
2. The hook should accept a list of field names and a dependency value (like `editingId`) used to reset touched state.
3. It should return:
   - `touched: Record<string, boolean>` — per-field touched state
   - `hasSubmitted: boolean` — whether the form has been submitted at least once
   - `markTouched(field: string): void` — marks a field as touched
   - `markAllTouched(): void` — marks all fields as touched (call on submit)
   - `setHasSubmitted(value: boolean): void`
   - `shouldShowError(field: string, isInvalid: boolean): boolean` — returns `true` when the field is invalid AND (touched OR submitted)
   - `errorClassName(field: string, isInvalid: boolean): string` — returns `'border-red-400'` or `''`
   - `requiredIndicator: JSX.Element` — `<span className="text-red-500 ml-0.5" aria-hidden="true">*</span>`
   - `resetValidation(): void` — resets touched and submitted state
4. The hook should auto-reset when the dependency value changes (e.g., when `editingId` changes, clear touched/submitted).
5. Replace the duplicated logic in all 9 files with calls to `useFormValidation`.
6. Ensure that the existing behavior (showing errors on blur + on submit) is preserved exactly.

---

### 2. Extract shared `StatusBadge` component

**Problem:** An identical `StatusBadge` component is defined locally in 3 files.

**Affected files:**

- `src/components/admin/pending-feedback-notice.tsx`
- `src/components/admin/pending-suggestion-notice.tsx`
- `src/components/admin/tickets-panel.tsx`

**Specification:**

1. Create `src/components/ui/status-badge.tsx`.
2. Props: `status: string`, with color mapping: `approved` → green, `rejected` → red, default → yellow.
3. Render a `<span>` with appropriate Tailwind classes and `capitalize` text.
4. Replace all 3 local definitions with imports from the new file.

---

### 3. Extract shared date formatting utilities

**Problem:** `formatDate` and `formatDateTime` (or inline `toLocaleDateString`/`toLocaleString`) logic is repeated in 6 files.

**Affected files:**

- `src/components/admin/cognito-users-panel.tsx`
- `src/components/admin/feedback-panel.tsx`
- `src/components/admin/pending-feedback-notice.tsx`
- `src/components/admin/audit-logs-panel.tsx`
- `src/components/admin/pending-suggestion-notice.tsx`
- `src/components/admin/tickets-panel.tsx`

**Specification:**

1. Create `src/lib/date-utils.ts`.
2. Export `formatDate(dateString: string | null | undefined): string` — returns formatted date or `'—'`.
3. Export `formatDateTime(dateString: string | null | undefined): string` — returns formatted date+time or `'—'`.
4. Use the same locale and options currently used in the components.
5. Replace all inline date formatting in the 6 files with calls to these utilities.

---

### 4. Extract shared `normalizeKey` utility

**Problem:** `normalizeKey` (converts a name string to a URL-friendly key) is defined independently in 3 files.

**Affected files:**

- `src/components/shared/locations-panel.tsx`
- `src/components/shared/organizations-panel.tsx`
- `src/components/shared/activities-panel.tsx`

**Specification:**

1. Create `src/lib/string-utils.ts`.
2. Export `normalizeKey(name: string): string` with the same logic currently used.
3. Replace all 3 local definitions with imports.

---

### 5. Split large files

**Problem:** Several files exceed 500+ lines, hurting readability and maintainability.

**Affected files and line counts:**

| File | Lines |
|------|-------|
| `src/components/shared/schedules-panel.tsx` | 1,142 |
| `src/lib/api-client.ts` | 1,105 |
| `src/components/shared/organizations-panel.tsx` | 1,061 |
| `src/components/admin/media-panel.tsx` | 759 |
| `src/components/admin/tickets-panel.tsx` | 698 |
| `src/components/shared/pricing-panel.tsx` | 673 |
| `src/components/admin/audit-logs-panel.tsx` | 635 |
| `src/components/admin/cognito-users-panel.tsx` | 629 |
| `src/components/shared/activities-panel.tsx` | 567 |
| `src/components/shared/locations-panel.tsx` | 539 |

**Specification:**

**api-client.ts** — Split into domain-specific modules:

1. `src/lib/api-client.ts` — Keep only the shared `request()` helper, `ApiError`, `ListResponse`, types, and the generic CRUD functions (`listResource`, `createResource`, `updateResource`, `deleteResource`).
2. `src/lib/api-client-manager.ts` — All `*Manager*` functions.
3. `src/lib/api-client-tickets.ts` — Ticket types and functions (`listTickets`, `reviewTicket`).
4. `src/lib/api-client-audit.ts` — Audit log types and functions.
5. `src/lib/api-client-media.ts` — Media upload/reorder/delete functions.
6. `src/lib/api-client-cognito.ts` — Cognito user functions.
7. `src/lib/api-client-user.ts` — User-facing functions (access requests, suggestions, feedback).
8. Update all imports across the codebase.

**Large panel components** — Extract form and table/list sections into subcomponents within the same directory. For example, for `schedules-panel.tsx`:

1. `src/components/shared/schedules-panel.tsx` — Main panel, state, and layout.
2. `src/components/shared/schedule-form.tsx` — The create/edit form section.
3. `src/components/shared/schedule-weekly-view.tsx` — The weekly entries rendering.

Apply the same pattern to `organizations-panel.tsx`, `media-panel.tsx`, and other large panels. The goal is no file over ~400 lines.

---

### 6. Fix `as unknown as` type casts in `resource-api.ts`

**Problem:** 14 `as unknown as Promise<T>` double-casts in `src/lib/resource-api.ts` defeat TypeScript's type safety.

**Affected file:** `src/lib/resource-api.ts`

**Specification:**

1. Refactor the manager API functions in `api-client.ts` (or the new `api-client-manager.ts`) to accept a generic type parameter and return `Promise<ListResponse<T>>` / `Promise<T>` directly.
2. Alternatively, make the manager functions generic: `listManagerOrganizations<T>(): Promise<ListResponse<T>>`.
3. Remove all `as unknown as` casts from `resource-api.ts`.
4. Ensure the code still compiles with `strict: true`.

---

## MEDIUM Priority

### 7. Unify auth guards across admin pages

**Problem:** `/admin/dashboard` uses a `DashboardGate` that redirects unauthenticated users to `/`. `/admin/imports` has no redirect — unauthenticated users see the login screen inline.

**Affected files:**

- `src/app/admin/dashboard/page.tsx`
- `src/app/admin/imports/page.tsx`

**Specification:**

1. Create `src/components/auth-gate.tsx` (or modify the existing auth-provider pattern).
2. The component should wrap `AuthProvider` and check `status`. If `unauthenticated`, redirect to `/`. If `loading`, show a loading spinner. If `authenticated`, render `children`.
3. Use `AuthGate` in both `/admin/dashboard/page.tsx` and `/admin/imports/page.tsx` (and any future admin pages).
4. Remove `DashboardGate` and `LoginGate` in favor of the unified component.

---

### 8. Fix `useEffect` dependency violations

**Problem:**

- `src/components/admin/user-dashboard.tsx`: `loadUserStatus` is in `useEffect` deps but not wrapped in `useCallback`, causing potential re-runs on every render.
- `src/components/admin/tickets-panel.tsx` (line 466): `eslint-disable-next-line react-hooks/exhaustive-deps` suppresses the warning for `loadItems`.

**Specification:**

1. In `user-dashboard.tsx`, wrap `loadUserStatus` in `useCallback` with appropriate deps.
2. In `tickets-panel.tsx`, wrap `loadItems` in `useCallback` and include it in the `useEffect` deps. Remove the eslint-disable comment.
3. Verify no other `eslint-disable-next-line react-hooks/exhaustive-deps` comments exist (currently only the one in tickets-panel).

---

### 9. Replace `window.confirm` with custom confirmation dialog

**Problem:** `window.confirm` is used for delete confirmations. It provides no styling control, is not accessible, and can be blocked by browsers.

**Affected files:**

- `src/hooks/use-resource-panel.ts` (line 147)
- `src/components/admin/media-panel.tsx` (line 197)

**Specification:**

1. Create `src/components/ui/confirm-dialog.tsx`.
2. Props: `open: boolean`, `title: string`, `message: string`, `confirmLabel?: string`, `cancelLabel?: string`, `onConfirm: () => void`, `onCancel: () => void`, `variant?: 'danger' | 'default'`.
3. Must include: `role="dialog"`, `aria-modal="true"`, focus trap (focus first button on open, return focus on close), Escape key to cancel, backdrop click to cancel.
4. Use Tailwind for styling; red confirm button for `variant="danger"`.
5. Create `src/hooks/use-confirm-dialog.ts` that returns `{ confirm(title, message): Promise<boolean>, ConfirmDialog: JSX.Element }`.
6. Replace `window.confirm` in `use-resource-panel.ts` and `media-panel.tsx` with the custom dialog.

---

### 10. Add URL-based section state

**Problem:** The admin dashboard uses `activeSection` state for navigation but the URL does not reflect the section. Users cannot bookmark, share links, or use browser back/forward for section changes.

**Affected files:**

- `src/components/admin/admin-dashboard.tsx`
- `src/components/admin/manager-dashboard.tsx`

**Specification:**

1. Install `nuqs` (recommended in `.cursorrules`).
2. In `admin-dashboard.tsx`, replace `useState` for `activeSection` with `useQueryState('section')` from `nuqs`.
3. Default to `'organizations'` (admin) or the appropriate default per role.
4. Ensure back/forward navigation works for section changes.
5. Apply the same pattern to `manager-dashboard.tsx`.
6. Update the `/admin/imports` page to use the query param approach instead of `initialSection` prop.

---

### 11. Add `loading.tsx` and `error.tsx` boundary files

**Problem:** No route segments have Next.js `loading.tsx` or `error.tsx` boundaries. Users see nothing during page transitions.

**Specification:**

1. Create `src/app/admin/loading.tsx` — a centered spinner/skeleton.
2. Create `src/app/error.tsx` — a user-friendly error page with a "Try Again" button. Must be a client component (`'use client'`).
3. Keep them minimal; the existing in-component error handling remains.

---

### 12. Fix missing Playwright env variable

**Problem:** `playwright.config.ts` sets only 3 of 4 required env vars; `NEXT_PUBLIC_COGNITO_USER_POOL_ID` is missing.

**Affected file:** `playwright.config.ts`

**Specification:**

1. Add `NEXT_PUBLIC_COGNITO_USER_POOL_ID: 'mock-user-pool-id'` to the `webServer.env` object in `playwright.config.ts`.

---

### 13. Improve modal accessibility in `cognito-users-panel.tsx`

**Problem:** The delete confirmation modal and user attributes modal have no focus trap, no Escape-to-close, no `role="dialog"`, no `aria-modal="true"`.

**Affected file:** `src/components/admin/cognito-users-panel.tsx`

**Specification:**

1. If item 9 (custom confirm dialog) is completed, use it for the delete confirmation.
2. For the user attributes modal, add `role="dialog"`, `aria-modal="true"`, Escape key handler, and focus trap.
3. Apply the same fixes to any other inline modals in the codebase (check `tickets-panel.tsx` review modal).

---

### 14. Expand E2E test coverage

**Problem:** Only Organizations, Activities, Activity Categories, Login, Admin Dashboard, and Manager Dashboard are covered. Many panels have zero E2E tests.

**Specification:**

Add test files for the following, in priority order:

1. `e2e/tickets.spec.ts` — List tickets, filter by type/status, approve/reject flow.
2. `e2e/media.spec.ts` — Select org, upload (mock), reorder, delete.
3. `e2e/imports.spec.ts` — Navigate to imports, select type, upload CSV (mock), verify result.
4. `e2e/locations.spec.ts` — CRUD locations, address autocomplete.
5. `e2e/pricing.spec.ts` — CRUD pricing entries.
6. `e2e/schedules.spec.ts` — CRUD schedules, weekly view.
7. `e2e/feedback.spec.ts` — View feedback, filter.
8. `e2e/audit-logs.spec.ts` — View logs, filter.
9. `e2e/cognito-users.spec.ts` — List users, view attributes, disable/enable.

For each, add appropriate mock data to `e2e/fixtures/test-fixtures.ts` and mock API routes.

---

## LOW Priority

### 15. Remove unnecessary `'use client'` directives

**Affected files:**

- `src/components/status-banner.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/label.tsx`
- `src/lib/number-parsers.ts`

**Specification:** Remove `'use client'` from these files. They contain no hooks, event handlers, or browser APIs.

---

### 16. Add `reactStrictMode` and `poweredByHeader` to `next.config.js`

**Affected file:** `next.config.js`

**Specification:**

```js
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
};
```

---

### 17. Add `typecheck` and `lint:fix` scripts to `package.json`

**Affected file:** `package.json`

**Specification:** Add to `scripts`:

```json
"typecheck": "tsc --noEmit",
"lint:fix": "eslint --fix ."
```

---

### 18. Memoize DataTable columns in all panels

**Problem:** `ActivitiesPanel` memoizes its column definitions with `useMemo`, but other panels define columns inline, creating new array references on every render.

**Affected files:** All panel files that use `DataTable` and define columns inline:

- `src/components/shared/organizations-panel.tsx`
- `src/components/shared/locations-panel.tsx`
- `src/components/shared/pricing-panel.tsx`
- `src/components/shared/schedules-panel.tsx`
- `src/components/shared/activity-categories-panel.tsx`
- `src/components/admin/cognito-users-panel.tsx`
- `src/components/admin/audit-logs-panel.tsx`
- `src/components/admin/feedback-panel.tsx`
- `src/components/admin/feedback-labels-panel.tsx`
- `src/components/admin/tickets-panel.tsx`

**Specification:** Wrap column definitions in `useMemo` with appropriate dependency arrays.

---

### 19. Memoize `levels` in cascading selects

**Affected files:**

- `src/components/ui/cascading-area-select.tsx`
- `src/components/ui/cascading-category-select.tsx`

**Specification:** Wrap the `levels` array computation in `useMemo` with deps on the input data.

---

### 20. Add `aria-label` to SearchInput and DataTable action buttons

**Affected files:**

- `src/components/ui/search-input.tsx` — Add `aria-label` prop with a sensible default (e.g., `"Search"`).
- `src/components/ui/data-table.tsx` — Change edit/delete button `title` to also include `aria-label`.

---

### 21. Use `useReducer` in `media-panel.tsx`

**Problem:** `media-panel.tsx` has 15+ `useState` calls managing related state.

**Affected file:** `src/components/admin/media-panel.tsx`

**Specification:** Group related state into a reducer:

```typescript
interface MediaPanelState {
  selectedOrgId: string;
  mediaItems: MediaItem[];
  isLoading: boolean;
  isUploading: boolean;
  error: string;
  draggedIndex: number | null;
  // ... etc
}

type MediaPanelAction =
  | { type: 'SET_ORG'; orgId: string }
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; items: MediaItem[] }
  // ... etc
```

---

### 22. Consolidate `@next/next/no-img-element` eslint overrides

**Problem:** 5 `eslint-disable-next-line @next/next/no-img-element` comments across 4 files.

**Affected files:**

- `src/components/shared/schedules-panel.tsx` (2 occurrences)
- `src/components/shared/locations-panel.tsx`
- `src/components/shared/organizations-panel.tsx`
- `src/components/ui/language-toggle-input.tsx`

**Specification:** Add a rule override in `eslint.config.js` to disable `@next/next/no-img-element` globally (since the app uses `output: 'export'` with `images.unoptimized: true`, the `<Image>` component provides no benefit). Remove all per-line disable comments.

---

### 23. Remove potentially redundant `autoprefixer` dependency

**Affected file:** `package.json`, `postcss.config.js`

**Specification:** Tailwind v4's `@tailwindcss/postcss` includes vendor prefixes. Test removing `autoprefixer` from `postcss.config.js` and `package.json`. If the build and styles still work correctly, remove it.

---

## Execution Notes

- Each numbered item is independent and can be worked on in isolation, though items 1–4 (extract shared utilities) should ideally land before item 5 (split large files), as the shared utilities will reduce the size of the panels naturally.
- After each change, run `npm run lint` and `npm run build` to verify no regressions.
- After items affecting E2E-tested flows, run `npm run test:e2e` to verify tests still pass.
- All new files must follow the naming conventions in `.cursorrules` (lowercase-with-dashes for files, named exports for components).
