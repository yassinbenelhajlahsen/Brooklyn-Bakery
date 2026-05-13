import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { supabase } from '../../lib/supabase.js';
import { updateMyProfile } from '../../services/profileService.js';

const SECTION_CLS = 'bg-surface border border-line rounded-2xl p-6 shadow-sm';
const LABEL_CLS = 'text-[11px] uppercase tracking-wider text-muted mb-1 block';

const INPUT_CLS =
  'w-full border border-line rounded-lg px-3 py-2.5 text-sm bg-white text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50';

const PRIMARY_BTN =
  'px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent-dark disabled:opacity-50 font-medium transition-colors';

const SECONDARY_BTN =
  'px-4 py-2 text-sm rounded-lg border border-line text-ink hover:bg-cream disabled:opacity-50 transition-colors';

const GHOST_BTN =
  'text-xs text-accent hover:text-accent-dark disabled:opacity-50 transition-colors';

const MAX_NAME_LENGTH = 50;
const SUCCESS_TIMEOUT_MS = 3000;
const MAX_AVATAR_SIZE_MB = 2;
const AVATAR_BUCKET = 'avatars';

export default function AccountSection() {
  const navigate = useNavigate();
  const { user, profile, authedFetch, refreshProfile } = useAuth();

  const [editingName, setEditingName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');

  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fileInputRef = useRef(null);
  const successTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  function showSuccess(message) {
    setSuccess(message);

    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }

    successTimerRef.current = setTimeout(() => {
      setSuccess(null);
    }, SUCCESS_TIMEOUT_MS);
  }

  function clearMessages() {
    setError(null);
    setSuccess(null);
  }

  function startEditName() {
    setDisplayNameDraft(profile?.displayName ?? '');
    setEditingName(true);
    clearMessages();
  }

  function cancelEditName() {
    setDisplayNameDraft('');
    setEditingName(false);
    setError(null);
  }

  async function saveDisplayName() {
    const trimmed = displayNameDraft.trim();

    if (!trimmed) {
      setError('Display name must not be empty.');
      return;
    }

    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Display name must be ${MAX_NAME_LENGTH} characters or fewer.`);
      return;
    }

    if (trimmed === (profile?.displayName ?? '')) {
      cancelEditName();
      return;
    }

    setSavingName(true);
    setError(null);

    try {
      await updateMyProfile(authedFetch, {
        displayName: trimmed,
      });

      await refreshProfile();

      setEditingName(false);
      setDisplayNameDraft('');
      showSuccess('Display name updated');
    } catch (err) {
      setError(err?.message ?? 'Could not update display name.');
    } finally {
      setSavingName(false);
    }
  }

  function startEditEmail() {
    setEmailDraft(user?.email ?? '');
    setEditingEmail(true);
    clearMessages();
  }

  function cancelEditEmail() {
    setEmailDraft('');
    setEditingEmail(false);
    setError(null);
  }

  async function saveEmail() {
    const trimmed = emailDraft.trim().toLowerCase();

    if (!trimmed) {
      setError('Email must not be empty.');
      return;
    }

    if (!trimmed.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (trimmed === user?.email) {
      cancelEditEmail();
      return;
    }

    setSavingEmail(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: trimmed,
      });

      if (updateError) {
        throw updateError;
      }

      setEditingEmail(false);
      setEmailDraft('');
      showSuccess('Confirmation email sent. Please verify the new email address.');
    } catch (err) {
      setError(err?.message ?? 'Could not update email.');
    } finally {
      setSavingEmail(false);
    }
  }

  function openFilePicker() {
    clearMessages();
    fileInputRef.current?.click();
  }

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    event.target.value = '';

    if (!user?.id) {
      setError('You must be signed in to upload a profile picture.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }

    const maxBytes = MAX_AVATAR_SIZE_MB * 1024 * 1024;

    if (file.size > maxBytes) {
      setError(`Profile picture must be smaller than ${MAX_AVATAR_SIZE_MB}MB.`);
      return;
    }

    setUploadingAvatar(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath);

      const avatarUrl = data.publicUrl;

      await updateMyProfile(authedFetch, {
        avatarUrl,
      });

      await refreshProfile();

      showSuccess('Profile picture updated');
    } catch (err) {
      setError(err?.message ?? 'Could not upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const displayName = profile?.displayName ?? '';
  const balance = profile?.balance ?? 0;
  const avatarUrl = profile?.avatarUrl ?? profile?.avatar_url ?? '';

  const initials =
    displayName
      ?.trim()
      ?.split(/\s+/)
      ?.map((part) => part[0])
      ?.join('')
      ?.slice(0, 2)
      ?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    '?';

  return (
    <section className={SECTION_CLS} aria-labelledby="account-heading">
      <div className="flex items-start justify-between gap-4 mb-6 max-sm:flex-col">
        <div>
          <h3 id="account-heading" className="font-display text-[24px] text-ink">
            Account
          </h3>
          <p className="text-sm text-muted mt-1">
            Manage your profile photo, login email, display name, and account points.
          </p>
        </div>

        <div className="rounded-full border border-line bg-cream px-4 py-2 text-sm text-ink">
          {profile?.role ?? 'customer'}
        </div>
      </div>

      <div className="grid grid-cols-[180px_1fr] gap-8 max-md:grid-cols-1">
        <aside className="flex flex-col items-center">
          <div className="h-28 w-28 rounded-full border border-line bg-cream overflow-hidden flex items-center justify-center shadow-sm">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-medium text-muted">
                {initials}
              </span>
            )}
          </div>

          <button
            type="button"
            className={`${SECONDARY_BTN} mt-4 w-full justify-center`}
            onClick={openFilePicker}
            disabled={uploadingAvatar}
          >
            {uploadingAvatar ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />

          <p className="text-xs text-muted mt-2 text-center">
            JPG, PNG, or WebP. Max {MAX_AVATAR_SIZE_MB}MB.
          </p>
        </aside>

        <div className="grid gap-4">
          <div className="rounded-xl border border-line bg-white/70 p-4">
            <div className="flex items-start justify-between gap-4 max-sm:flex-col">
              <div className="flex-1">
                <span className={LABEL_CLS}>Email</span>

                {editingEmail ? (
                  <input
                    className={INPUT_CLS}
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    disabled={savingEmail}
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-ink break-all">
                    {user?.email ?? '—'}
                  </p>
                )}
              </div>

              {editingEmail ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={PRIMARY_BTN}
                    onClick={saveEmail}
                    disabled={savingEmail}
                  >
                    {savingEmail ? 'Saving…' : 'Save'}
                  </button>

                  <button
                    type="button"
                    className={SECONDARY_BTN}
                    onClick={cancelEditEmail}
                    disabled={savingEmail}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className={SECONDARY_BTN} onClick={startEditEmail}>
                  Change
                </button>
              )}
            </div>

            <p className="text-xs text-muted mt-2">
              Changing your email may require verification later on.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-white/70 p-4">
            <div className="flex items-start justify-between gap-4 max-sm:flex-col">
              <div className="flex-1">
                <span className={LABEL_CLS}>Display name</span>

                {editingName ? (
                  <input
                    className={INPUT_CLS}
                    value={displayNameDraft}
                    onChange={(e) => setDisplayNameDraft(e.target.value)}
                    disabled={savingName}
                    maxLength={MAX_NAME_LENGTH + 10}
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-ink">
                    {displayName || <span className="text-muted">Not set</span>}
                  </p>
                )}
              </div>

              {editingName ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={PRIMARY_BTN}
                    onClick={saveDisplayName}
                    disabled={savingName}
                  >
                    {savingName ? 'Saving…' : 'Save'}
                  </button>

                  <button
                    type="button"
                    className={SECONDARY_BTN}
                    onClick={cancelEditName}
                    disabled={savingName}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" className={SECONDARY_BTN} onClick={startEditName}>
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white/70 p-4">
            <div className="flex items-start justify-between gap-4 max-sm:flex-col">
              <div>
                <span className={LABEL_CLS}>Balance</span>
                <p className="text-2xl font-display text-ink">
                  {balance.toLocaleString()}{' '}
                  <span className="text-sm font-sans text-muted">
                    {balance === 1 ? 'point' : 'points'}
                  </span>
                </p>
                <p className="text-xs text-muted mt-1">
                  Points are earned through activity and purchases.
                </p>
              </div>

              <button
                type="button"
                className={SECONDARY_BTN}
                onClick={() => navigate('/earn')}
              >
                Earn points
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white/70 p-4">
            <span className={LABEL_CLS}>Account ID</span>
            <p className="text-xs text-muted break-all">
              {user?.id ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className="mt-5 border-t border-line pt-4">
          {error && <p className="text-danger text-sm">{error}</p>}
          {success && <p className="text-emerald-600 text-sm">{success}</p>}
        </div>
      )}
    </section>
  );
}