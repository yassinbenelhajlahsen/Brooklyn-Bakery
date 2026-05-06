# Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/profile` page where the signed-in user can edit display name, manage saved addresses, and change password (with current-password verification).

**Architecture:** New top-level page `ProfilePage.jsx` mirrors `OrderHistoryPage` layout and stacks three independent sections (`AccountSection`, `AddressesSection`, `SecuritySection`). Display name save uses a new `PATCH /me` endpoint backed by a pure `normalizeDisplayName` helper (mirrors the existing `lib/address.js` + `tests/address.test.js` pattern). Address management reuses the existing `addressesService` and `AddressForm`. Password change uses Supabase: `signInWithPassword` to verify the current password, then `updateUser({ password })`. Each section owns its own loading/error/success state and shows inline status — no toast library is added.

**Tech Stack:** React 18, React Router v6, Vite (frontend); Express, Prisma, ESM (backend); `@supabase/supabase-js` (already installed); `node:test` for backend unit tests.

**Spec:** `docs/superpowers/specs/2026-05-04-profile-page-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `backend/lib/displayName.js` | `normalizeDisplayName(input)` → `{ ok: true, value } \| { ok: false, error }`. |
| Create | `backend/tests/displayName.test.js` | Pure-helper tests (mirrors `tests/address.test.js`). |
| Modify | `backend/controllers/meController.js` | Add `updateMe` handler that uses `normalizeDisplayName`. |
| Modify | `backend/routes/meRoutes.js` | `router.patch('/', updateMe)`. |
| Modify | `frontend/src/services/profileService.js` | Add `updateMyProfile(authedFetch, { displayName })`. |
| Create | `frontend/src/components/profile/AccountSection.jsx` | Email + balance read-only; inline-edit display name. |
| Create | `frontend/src/components/profile/AddressesSection.jsx` | List + add/edit/delete using existing `AddressForm` and `addressesService`. |
| Create | `frontend/src/components/profile/SecuritySection.jsx` | Change-password form with current-password verification. |
| Create | `frontend/src/pages/ProfilePage.jsx` | Container: auth guard, layout, heading, "Back to home", section stack. |
| Modify | `frontend/src/App.jsx` | Register `<Route path="/profile" element={<ProfilePage />} />`. |
| Modify | `frontend/src/components/ProfileMenu.jsx` | "Profile" item navigates to `/profile`. |
| Modify | `TODO.md` | Check off the profile-page item under "Missing from Tier 2". |

The frontend has no test setup. Verification is manual via the dev server (consistent with existing tier-1/tier-2 frontend work). Backend changes get pure unit tests via `node:test`.

---

## Task 0: Commit the design and plan docs together

This is the cohesive planning artifact. Per the user's preference, the spec and plan are committed as a single commit before implementation starts.

**Files:**
- New (already on disk): `docs/superpowers/specs/2026-05-04-profile-page-design.md`
- New (this file): `docs/superpowers/plans/2026-05-04-profile-page-plan.md`

- [ ] **Step 1: Stage both docs**

```bash
git add docs/superpowers/specs/2026-05-04-profile-page-design.md docs/superpowers/plans/2026-05-04-profile-page-plan.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
docs: profile page design + implementation plan

Tier 2 TODO. Adds /profile with editable display name, address management,
and password change (with current-password verification).
EOF
)"
```

- [ ] **Step 3: Verify clean tree**

Run: `git status`
Expected: `nothing to commit, working tree clean`.

---

## Task 1: `normalizeDisplayName` helper + tests (TDD)

**Files:**
- Create: `backend/lib/displayName.js`
- Create: `backend/tests/displayName.test.js`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/displayName.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDisplayName } from '../lib/displayName.js';

test('normalizeDisplayName: accepts a valid name and trims surrounding whitespace', () => {
    const result = normalizeDisplayName('  Jane Doe  ');
    assert.equal(result.ok, true);
    assert.equal(result.value, 'Jane Doe');
});

test('normalizeDisplayName: accepts a 1-char name', () => {
    const result = normalizeDisplayName('A');
    assert.equal(result.ok, true);
    assert.equal(result.value, 'A');
});

test('normalizeDisplayName: accepts a 50-char name (boundary)', () => {
    const fifty = 'a'.repeat(50);
    const result = normalizeDisplayName(fifty);
    assert.equal(result.ok, true);
    assert.equal(result.value, fifty);
});

test('normalizeDisplayName: accepts unicode characters', () => {
    const result = normalizeDisplayName('Renée Müller');
    assert.equal(result.ok, true);
    assert.equal(result.value, 'Renée Müller');
});

test('normalizeDisplayName: rejects empty string', () => {
    const result = normalizeDisplayName('');
    assert.equal(result.ok, false);
    assert.match(result.error, /empty|required/i);
});

test('normalizeDisplayName: rejects whitespace-only string', () => {
    const result = normalizeDisplayName('   \t  ');
    assert.equal(result.ok, false);
    assert.match(result.error, /empty|required/i);
});

test('normalizeDisplayName: rejects strings longer than 50 chars after trim', () => {
    const result = normalizeDisplayName('a'.repeat(51));
    assert.equal(result.ok, false);
    assert.match(result.error, /50/);
});

test('normalizeDisplayName: trims before checking length (51 with surrounding whitespace = 50 → ok)', () => {
    const result = normalizeDisplayName('  ' + 'a'.repeat(50) + '  ');
    assert.equal(result.ok, true);
    assert.equal(result.value.length, 50);
});

test('normalizeDisplayName: rejects non-string input', () => {
    for (const input of [undefined, null, 42, true, {}, []]) {
        const result = normalizeDisplayName(input);
        assert.equal(result.ok, false, `expected !ok for ${JSON.stringify(input)}`);
        assert.match(result.error, /string/i);
    }
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `cd backend && node --test tests/displayName.test.js`
Expected: all tests fail with `Cannot find module '../lib/displayName.js'`.

- [ ] **Step 3: Implement the helper**

Create `backend/lib/displayName.js`:

```js
const MAX_LENGTH = 50;

export function normalizeDisplayName(input) {
    if (typeof input !== 'string') {
        return { ok: false, error: 'displayName must be a string' };
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
        return { ok: false, error: 'displayName must not be empty' };
    }
    if (trimmed.length > MAX_LENGTH) {
        return { ok: false, error: `displayName must be ${MAX_LENGTH} characters or fewer` };
    }
    return { ok: true, value: trimmed };
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `cd backend && node --test tests/displayName.test.js`
Expected: all 9 tests pass.

- [ ] **Step 5: Run the full backend test suite (regression check)**

Run: `cd backend && npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/lib/displayName.js backend/tests/displayName.test.js
git commit -m "feat(backend): add normalizeDisplayName helper with unit tests"
```

---

## Task 2: `PATCH /me` controller + route

**Files:**
- Modify: `backend/controllers/meController.js`
- Modify: `backend/routes/meRoutes.js`

- [ ] **Step 1: Add the `updateMe` controller**

Open `backend/controllers/meController.js`. Add the `normalizeDisplayName` import to the imports block, then append the new `updateMe` handler after `getMe`. The full file should look like:

```js
import { prisma } from '../lib/prisma.js';
import { httpError, sendHttpError } from '../lib/httpError.js';
import { creditClicks } from '../services/clickService.js';
import { normalizeDisplayName } from '../lib/displayName.js';

export async function getMe(req, res) {
    try {
        const profile = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                displayName: true,
                balance: true,
                role: true,
            },
        });
        if (!profile) return sendHttpError(res, httpError(404, 'Profile not found'));
        res.json({ user: { ...profile, email: req.user.email } });
    } catch (err) {
        console.error('getMe failed:', err);
        res.status(500).json({ error: 'Failed to load profile' });
    }
}

export async function updateMe(req, res) {
    try {
        const result = normalizeDisplayName(req.body?.displayName);
        if (!result.ok) {
            return sendHttpError(res, httpError(400, result.error));
        }
        const profile = await prisma.user.update({
            where: { id: req.user.id },
            data: { displayName: result.value },
            select: {
                id: true,
                displayName: true,
                balance: true,
                role: true,
            },
        });
        res.json({ user: { ...profile, email: req.user.email } });
    } catch (err) {
        console.error('updateMe failed:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}

export async function flushClicks(req, res) {
    try {
        const { delta, elapsedMs } = req.body ?? {};
        const result = await creditClicks({
            userId: req.user.id,
            delta,
            elapsedMs,
        });
        res.json(result);
    } catch (err) {
        if (err.http) return sendHttpError(res, err);
        console.error('flushClicks failed:', err);
        res.status(500).json({ error: 'Failed to credit clicks' });
    }
}
```

- [ ] **Step 2: Wire the route**

Open `backend/routes/meRoutes.js`. Update the imports and add a `PATCH /` route:

```js
import express from 'express';
import { getMe, updateMe, flushClicks } from '../controllers/meController.js';
import addressesRoutes from './addressesRoutes.js';

const router = express.Router();

router.get('/', getMe);
router.patch('/', updateMe);
router.post('/clicks', flushClicks);
router.use('/addresses', addressesRoutes);

export default router;
```

- [ ] **Step 3: Backend test sanity check**

Run: `cd backend && npm test`
Expected: all existing tests still pass (no regressions). The helper test from Task 1 still passes.

- [ ] **Step 4: Smoke-test the route by starting the server**

Run: `cd backend && npm run dev`
Expected: server logs `Server is running on http://127.0.0.1:3000` with no startup errors. Stop the server (Ctrl+C) once you've confirmed it boots.

- [ ] **Step 5: Commit**

```bash
git add backend/controllers/meController.js backend/routes/meRoutes.js
git commit -m "feat(backend): add PATCH /me to update display name"
```

---

## Task 3: Frontend service `updateMyProfile`

**Files:**
- Modify: `frontend/src/services/profileService.js`

- [ ] **Step 1: Add the new export**

Replace the entire contents of `frontend/src/services/profileService.js` with:

```js
export async function fetchProfile(authedFetch) {
  try {
    const res = await authedFetch('/me');
    if (!res.ok) return null;
    const body = await res.json();
    return body.user ?? null;
  } catch {
    return null;
  }
}

export async function updateMyProfile(authedFetch, { displayName }) {
  const res = await authedFetch('/me', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to update profile');
  }
  const body = await res.json();
  return body.user ?? null;
}
```

- [ ] **Step 2: Type-check via build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/profileService.js
git commit -m "feat(frontend): add updateMyProfile service for PATCH /me"
```

---

## Task 4: `AccountSection` component (read-only email/balance + inline-edit display name)

**Files:**
- Create: `frontend/src/components/profile/AccountSection.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/profile/AccountSection.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { updateMyProfile } from '../../services/profileService.js';

const SECTION_CLS = 'bg-surface border border-line rounded-xl p-6';
const LABEL_CLS = 'text-[11px] uppercase tracking-wider text-muted mb-1 block';
const INPUT_CLS =
  'w-full max-w-sm border border-line rounded-md px-3 py-2 text-sm bg-surface text-ink focus:outline-none focus:border-accent disabled:opacity-50';
const PRIMARY_BTN =
  'px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 font-medium transition-colors';
const SECONDARY_BTN =
  'px-3 py-1.5 text-sm rounded-lg border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors';

const MAX_LENGTH = 50;
const SUCCESS_TIMEOUT_MS = 3000;

export default function AccountSection() {
  const { user, profile, authedFetch, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const successTimerRef = useRef(null);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  function showSuccess(message) {
    setSuccess(message);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccess(null), SUCCESS_TIMEOUT_MS);
  }

  function startEdit() {
    setDraft(profile?.displayName ?? '');
    setError(null);
    setSuccess(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft('');
    setError(null);
  }

  async function save() {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setError('Display name must not be empty.');
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`Display name must be ${MAX_LENGTH} characters or fewer.`);
      return;
    }
    if (trimmed === (profile?.displayName ?? '')) {
      cancelEdit();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateMyProfile(authedFetch, { displayName: trimmed });
      await refreshProfile();
      setEditing(false);
      setDraft('');
      showSuccess('Saved');
    } catch (err) {
      setError(err?.message ?? 'Could not save display name.');
    } finally {
      setSaving(false);
    }
  }

  const displayName = profile?.displayName ?? '';
  const balance = profile?.balance ?? 0;

  return (
    <section className={SECTION_CLS} aria-labelledby="account-heading">
      <h3 id="account-heading" className="font-display text-[22px] text-ink mb-4">
        Account
      </h3>

      <div className="grid gap-4">
        <div>
          <span className={LABEL_CLS}>Email</span>
          <p className="text-sm text-ink">{user?.email ?? '—'}</p>
        </div>

        <div>
          <span className={LABEL_CLS}>Display name</span>
          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className={INPUT_CLS}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                maxLength={MAX_LENGTH + 10}
                autoFocus
              />
              <button type="button" className={PRIMARY_BTN} onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className={SECONDARY_BTN} onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-sm text-ink">{displayName || <span className="text-muted">Not set</span>}</p>
              <button type="button" className={SECONDARY_BTN} onClick={startEdit}>
                Edit
              </button>
            </div>
          )}
        </div>

        <div>
          <span className={LABEL_CLS}>Balance</span>
          <p className="text-sm text-ink">
            {balance.toLocaleString()} {balance === 1 ? 'point' : 'points'}
          </p>
        </div>
      </div>

      {error && <p className="text-danger text-sm mt-3">{error}</p>}
      {success && <p className="text-emerald-600 text-sm mt-3">{success}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Type-check via build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors. (Warnings are tolerated only if pre-existing.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/profile/AccountSection.jsx
git commit -m "feat(frontend): add AccountSection for profile page"
```

---

## Task 5: `AddressesSection` component (list + add/edit/delete)

**Files:**
- Create: `frontend/src/components/profile/AddressesSection.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/profile/AddressesSection.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import {
  fetchAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from '../../services/addressesService.js';
import AddressForm from '../AddressForm.jsx';

const SECTION_CLS = 'bg-surface border border-line rounded-xl p-6';
const PRIMARY_BTN =
  'px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 font-medium transition-colors';
const SECONDARY_BTN =
  'px-3 py-1.5 text-sm rounded-lg border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors';
const DANGER_BTN =
  'px-3 py-1.5 text-sm rounded-lg border border-line text-danger hover:bg-danger/5 disabled:opacity-50 transition-colors';

function formatAddress(a) {
  const parts = [a.line1];
  if (a.line2) parts.push(a.line2);
  parts.push(`${a.city}, ${a.state} ${a.postalCode}`);
  parts.push(a.country);
  return parts;
}

export default function AddressesSection() {
  const { authedFetch } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [mode, setMode] = useState({ kind: 'idle' });
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchAddresses(authedFetch);
        if (!cancelled) setAddresses(data ?? []);
      } catch (err) {
        if (!cancelled) setLoadError(err?.message ?? 'Could not load addresses.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authedFetch]);

  async function handleCreate(payload) {
    setActionError(null);
    const created = await createAddress(authedFetch, payload);
    setAddresses((prev) => [...prev, created]);
    setMode({ kind: 'idle' });
  }

  async function handleUpdate(id, payload) {
    setActionError(null);
    const updated = await updateAddress(authedFetch, id, payload);
    setAddresses((prev) => prev.map((a) => (a.id === id ? updated : a)));
    setMode({ kind: 'idle' });
  }

  async function handleDelete(id) {
    setActionError(null);
    setBusyId(id);
    try {
      await deleteAddress(authedFetch, id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setActionError(err?.message ?? 'Could not delete address.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={SECTION_CLS} aria-labelledby="addresses-heading">
      <div className="flex items-center justify-between mb-4">
        <h3 id="addresses-heading" className="font-display text-[22px] text-ink">
          Saved addresses
        </h3>
        {mode.kind === 'idle' && !loading && !loadError && (
          <button type="button" className={PRIMARY_BTN} onClick={() => setMode({ kind: 'create' })}>
            Add address
          </button>
        )}
      </div>

      {loading && <p className="text-muted text-sm">Loading…</p>}
      {loadError && <p className="text-danger text-sm">{loadError}</p>}
      {actionError && <p className="text-danger text-sm mb-3">{actionError}</p>}

      {!loading && !loadError && (
        <>
          {mode.kind === 'create' && (
            <div className="mb-4">
              <AddressForm
                submitLabel="Save"
                onSubmit={handleCreate}
                onCancel={() => setMode({ kind: 'idle' })}
              />
            </div>
          )}

          {addresses.length === 0 && mode.kind !== 'create' ? (
            <p className="text-muted text-sm">No saved addresses yet.</p>
          ) : (
            <ul className="grid gap-3">
              {addresses.map((a) => (
                <li key={a.id} className="border border-line rounded-lg p-4 bg-cream/30">
                  {mode.kind === 'edit' && mode.id === a.id ? (
                    <AddressForm
                      initial={a}
                      submitLabel="Save"
                      onSubmit={(payload) => handleUpdate(a.id, payload)}
                      onCancel={() => setMode({ kind: 'idle' })}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-ink leading-snug">
                        {formatAddress(a).map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          className={SECONDARY_BTN}
                          onClick={() => setMode({ kind: 'edit', id: a.id })}
                          disabled={busyId === a.id}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={DANGER_BTN}
                          onClick={() => handleDelete(a.id)}
                          disabled={busyId === a.id}
                        >
                          {busyId === a.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
```

Note on error handling: `AddressForm`'s own `handleSubmit` catches errors thrown from `onSubmit` and displays them inside the form. So `handleCreate` / `handleUpdate` re-throw naturally (they don't try/catch — letting the error propagate to `AddressForm`). `handleDelete` has no form to host its error, so it sets `actionError` on the section.

- [ ] **Step 2: Type-check via build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/profile/AddressesSection.jsx
git commit -m "feat(frontend): add AddressesSection for profile page"
```

---

## Task 6: `SecuritySection` component (change password)

**Files:**
- Create: `frontend/src/components/profile/SecuritySection.jsx`

- [ ] **Step 1: Create the component**

Create `frontend/src/components/profile/SecuritySection.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { supabase } from '../../lib/supabase.js';

const SECTION_CLS = 'bg-surface border border-line rounded-xl p-6';
const LABEL_CLS = 'text-[11px] uppercase tracking-wider text-muted mb-1 block';
const INPUT_CLS =
  'w-full max-w-sm border border-line rounded-md px-3 py-2 text-sm bg-surface text-ink focus:outline-none focus:border-accent disabled:opacity-50';
const PRIMARY_BTN =
  'px-4 py-1.5 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 font-medium transition-colors';

const MIN_PASSWORD_LENGTH = 6;
const SUCCESS_TIMEOUT_MS = 3000;

export default function SecuritySection() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({}); // { current?, next?, form? }
  const [success, setSuccess] = useState(null);
  const successTimerRef = useRef(null);

  useEffect(() => () => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  function showSuccess(message) {
    setSuccess(message);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccess(null), SUCCESS_TIMEOUT_MS);
  }

  function clearAllErrors() {
    setErrors({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    clearAllErrors();
    setSuccess(null);

    if (!currentPassword) {
      setErrors({ current: 'Enter your current password.' });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrors({ next: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrors({ next: 'Passwords do not match.' });
      return;
    }
    if (!user?.email) {
      setErrors({ form: 'Cannot change password without an email on file.' });
      return;
    }

    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        setErrors({ current: 'Current password is incorrect.' });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setErrors({ next: updateError.message ?? 'Could not update password.' });
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccess('Password updated');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={SECTION_CLS} aria-labelledby="security-heading">
      <h3 id="security-heading" className="font-display text-[22px] text-ink mb-4">
        Security
      </h3>

      <form onSubmit={handleSubmit} className="grid gap-3 max-w-sm">
        <div>
          <label htmlFor="current-password" className={LABEL_CLS}>
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            className={INPUT_CLS}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={submitting}
          />
          {errors.current && <p className="text-danger text-sm mt-1">{errors.current}</p>}
        </div>

        <div>
          <label htmlFor="new-password" className={LABEL_CLS}>
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            className={INPUT_CLS}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={submitting}
          />
          {errors.next && <p className="text-danger text-sm mt-1">{errors.next}</p>}
        </div>

        <div>
          <label htmlFor="confirm-password" className={LABEL_CLS}>
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            className={INPUT_CLS}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
          />
        </div>

        {errors.form && <p className="text-danger text-sm">{errors.form}</p>}

        <div>
          <button type="submit" className={PRIMARY_BTN} disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </div>

        {success && <p className="text-emerald-600 text-sm">{success}</p>}
      </form>
    </section>
  );
}
```

- [ ] **Step 2: Type-check via build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/profile/SecuritySection.jsx
git commit -m "feat(frontend): add SecuritySection for profile page"
```

---

## Task 7: `ProfilePage` container

**Files:**
- Create: `frontend/src/pages/ProfilePage.jsx`

- [ ] **Step 1: Create the page**

Create `frontend/src/pages/ProfilePage.jsx`:

```jsx
import clsx from 'clsx';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.js';
import Ornament from '../components/Ornament.jsx';
import AccountSection from '../components/profile/AccountSection.jsx';
import AddressesSection from '../components/profile/AddressesSection.jsx';
import SecuritySection from '../components/profile/SecuritySection.jsx';

const BACK_BTN = clsx(
  'bg-transparent text-muted border border-line rounded-lg p-3',
  'font-sans font-medium text-[12px] leading-[1] tracking-[0.1em] uppercase',
  '[transition:color_180ms_ease,border-color_180ms_ease]',
  'hover:text-accent hover:border-accent',
  'motion-reduce:transition-none',
);

function ProfileHeader() {
  return (
    <header className="text-center mb-10">
      <h2 className="font-display font-normal text-[42px] leading-[1.1] tracking-[-0.015em] text-ink m-0 [font-variation-settings:'opsz'_48] max-[880px]:text-[32px]">
        Profile
      </h2>
      <Ornament className="mt-5" />
    </header>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/" replace />;

  return (
    <main className="flex-1 p-8 max-w-full overflow-y-auto max-sm:px-4 max-sm:py-5">
      <div className="w-full animate-checkout-rise motion-reduce:animate-none">
        <ProfileHeader />

        <div className="mb-6 flex justify-start">
          <button className={BACK_BTN} onClick={() => navigate('/')}>
            Back to home
          </button>
        </div>

        <div className="grid gap-5 max-w-3xl">
          <AccountSection />
          <AddressesSection />
          <SecuritySection />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Type-check via build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ProfilePage.jsx
git commit -m "feat(frontend): add ProfilePage container"
```

---

## Task 8: Wire `/profile` route in `App.jsx`

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Import the page**

Open `frontend/src/App.jsx`. Add this import alongside the other page imports (e.g., immediately after the `OrderHistoryPage` import on line 6):

```js
import ProfilePage from './pages/ProfilePage.jsx'
```

- [ ] **Step 2: Add the route**

Inside the `<Routes>` block, add a `/profile` route immediately before the `/orders` route. The new line:

```jsx
        <Route path="/profile" element={<ProfilePage />} />
```

The `/orders` block stays unchanged. After this step the relevant slice of the file looks like:

```jsx
        <Route path="/help" element={<main className={MAIN_CLS}><HelpPage /></main>} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/orders" element={<OrderHistoryPage addItem={addItem} />} />
```

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(frontend): register /profile route"
```

---

## Task 9: Wire `ProfileMenu`'s "Profile" item to navigate

**Files:**
- Modify: `frontend/src/components/ProfileMenu.jsx:105-109`

- [ ] **Step 1: Replace the no-op onClick**

Open `frontend/src/components/ProfileMenu.jsx`. Find the "Profile" `<MenuItem>` (currently lines 105–109):

```jsx
          <MenuItem
            icon={<UserIcon className="w-[18px] h-[18px]" />}
            label="Profile"
            onClick={() => setOpen(false)}
          />
```

Replace it with:

```jsx
          <MenuItem
            icon={<UserIcon className="w-[18px] h-[18px]" />}
            label="Profile"
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          />
```

This matches the pattern already used by the "Order History" item at `ProfileMenu.jsx:110-117` and the "Admin" item at `ProfileMenu.jsx:95-104`. `navigate` is already in scope from `const navigate = useNavigate();` on line 12.

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProfileMenu.jsx
git commit -m "feat(frontend): wire ProfileMenu Profile item to /profile"
```

---

## Task 10: Manual verification (end-to-end)

**Files:** none modified.

This is the manual test plan from the spec. Run these against `npm run dev` from the repo root.

- [ ] **Step 1: Start the dev servers**

Run (from repo root): `npm run dev`
Expected: backend boots on `127.0.0.1:3000`, frontend on `127.0.0.1:5173`. No startup errors.

- [ ] **Step 2: Sign in as a real user, then exercise the flows**

Open `http://127.0.0.1:5173` in a browser, sign in.

For each item below, perform the action and confirm the expected outcome before moving on:

- Click avatar → menu → "Profile" → URL is `/profile`, three sections render (Account, Saved addresses, Security).
- Click "Edit" on display name, change it, click Save → header avatar's initial updates immediately; a green "Saved" appears under the section and clears after ~3s; refresh the page and the new name is still there.
- Click "Edit" on display name, clear the field, click Save → red "Display name must not be empty." appears; no network request is made; field stays in edit mode.
- Click "Edit" on display name, type 51 'a' chars, click Save → red "Display name must be 50 characters or fewer." appears; no network request.
- Click "Edit" on display name, change nothing, click Save → exits edit mode silently with no network request (verify in the Network tab).
- Click "Add address", fill out the form, Save → it appears in the list. Open `/checkout` (with at least one item in the cart): the new address shows up in `AddressSelector`.
- Click "Edit" on an address, change a field, Save → the list updates immediately; `/checkout` reflects the change.
- Click "Delete" on an address → it disappears from the list; `/checkout` no longer shows it.
- In Security, type a wrong current password + valid new password (twice) → red "Current password is incorrect." under the current-password field; nothing else changes.
- In Security, type correct current password + new password + a different confirm value → red "Passwords do not match." under the new-password field, no network call (verify in Network tab — only the `signInWithPassword` request is suppressed because validation runs first).
- In Security, type correct current password + a 3-char new password + matching confirm → red "New password must be at least 6 characters." (no network call).
- In Security, type correct current password + valid new password + matching confirm → green "Password updated" appears for ~3s; inputs clear. Sign out, sign back in with the new password — works.
- Open `/profile` while logged out (sign out first, then visit the URL directly) → redirects to `/`.

- [ ] **Step 3: Stop the dev servers**

Ctrl+C the `npm run dev` process.

No commit for this task — it's a verification gate.

---

## Task 11: Check off the TODO item

**Files:**
- Modify: `TODO.md`

- [ ] **Step 1: Update the line under "Missing from Tier 2"**

In `TODO.md`, change:

```
- [ ] User profile page — the profile menu item navigates nowhere. There's a /me endpoint but no page to view/edit display name, etc.
```

to:

```
- [x] User profile page — the profile menu item navigates nowhere. There's a /me endpoint but no page to view/edit display name, etc.
```

- [ ] **Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs(todo): check off Tier 2 user profile page"
```
