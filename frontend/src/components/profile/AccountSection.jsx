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
