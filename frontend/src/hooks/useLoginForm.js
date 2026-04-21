import { useState } from 'react';
import { useAuth } from '../auth/useAuth.js';

export function useLoginForm({ onSuccess } = {}) {
  const { signIn, signUp } = useAuth();
  const [mode, setModeState] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setMode = (next) => {
    setModeState(next);
    setError(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { error: authError } =
        mode === 'login'
          ? await signIn(email, password)
          : await signUp(email, password, fullName);
      if (authError) {
        setError(authError.message);
      } else if (onSuccess) {
        onSuccess();
      }
    } catch {
      setError('Could not reach auth server, please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    mode,
    setMode,
    email,
    setEmail,
    password,
    setPassword,
    fullName,
    setFullName,
    error,
    submitting,
    onSubmit,
  };
}
