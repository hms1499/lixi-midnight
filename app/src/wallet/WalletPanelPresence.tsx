import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Presence = { readonly count: number; register(): () => void };

const PresenceContext = createContext<Presence | null>(null);

/** Counts the wallet panels a page shows, so the header can drop its own Connect button (UX polish spec §3.8). */
export const WalletPanelPresenceProvider = ({ children }: { children: ReactNode }) => {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => n - 1);
  }, []);
  const value = useMemo(() => ({ count, register }), [count, register]);
  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

/** Counts the calling panel while it is mounted and `active`. */
export const useRegisterWalletPanel = (active: boolean): void => {
  const register = useContext(PresenceContext)?.register;
  useEffect(() => (active && register ? register() : undefined), [active, register]);
};

/** True while the page shows a wallet panel of its own. */
export const usePagePanelShown = (): boolean => (useContext(PresenceContext)?.count ?? 0) > 0;
