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
