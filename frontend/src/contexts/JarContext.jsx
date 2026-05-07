import { createContext, useContext, useMemo, useState } from 'react';

const JarContext = createContext(null);

export function JarProvider({ children }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <JarContext.Provider value={value}>{children}</JarContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useJar() {
  const ctx = useContext(JarContext);
  if (!ctx) {
    throw new Error('useJar must be used inside a <JarProvider>');
  }
  return ctx;
}
