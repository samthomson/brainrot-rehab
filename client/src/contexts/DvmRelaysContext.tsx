import { createContext, useContext, type ReactNode } from 'react';

const DvmRelaysContext = createContext<{
  enabledRelays: string[];
  setEnabledRelays: React.Dispatch<React.SetStateAction<string[]>>;
} | null>(null);

export function DvmRelaysProvider({
  enabledRelays,
  setEnabledRelays,
  children,
}: {
  enabledRelays: string[];
  setEnabledRelays: React.Dispatch<React.SetStateAction<string[]>>;
  children: ReactNode;
}) {
  return (
    <DvmRelaysContext.Provider value={{ enabledRelays, setEnabledRelays }}>
      {children}
    </DvmRelaysContext.Provider>
  );
}

export function useDvmRelays() {
  const ctx = useContext(DvmRelaysContext);
  if (!ctx) {
    throw new Error('useDvmRelays must be used within DvmRelaysProvider');
  }
  return ctx;
}
