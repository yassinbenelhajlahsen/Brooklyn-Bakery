import { useCallback, useEffect, useRef, useState } from 'react';

export function useTabUnderline(activeKey, extraDeps = []) {
  const parentRef = useRef(null);
  const tabRefs = useRef({});
  const [underlineStyle, setUnderlineStyle] = useState({
    transform: 'translateX(0px)',
    width: '0px',
  });

  useEffect(() => {
    const active = tabRefs.current[activeKey];
    if (!active || !parentRef.current) return;
    const parentRect = parentRef.current.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    setUnderlineStyle({
      transform: `translateX(${rect.left - parentRect.left}px)`,
      width: `${rect.width}px`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, ...extraDeps]);

  const registerTab = useCallback(
    (key) => (el) => {
      tabRefs.current[key] = el;
    },
    [],
  );

  return { parentRef, registerTab, underlineStyle };
}
