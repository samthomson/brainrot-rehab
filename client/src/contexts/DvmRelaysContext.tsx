import { createContext, useContext, type ReactNode } from 'react';

const DvmRelaysContext = createContext<{
  userSelectedWriteRelays: string[];
  setUserSelectedWriteRelays: React.Dispatch<React.SetStateAction<string[]>>;
} | null>(null);

export function DvmRelaysProvider({
  userSelectedWriteRelays,
  setUserSelectedWriteRelays,
  children,
}: {
  userSelectedWriteRelays: string[];
  setUserSelectedWriteRelays: React.Dispatch<React.SetStateAction<string[]>>;
  children: ReactNode;
}) {
  return (
    <DvmRelaysContext.Provider value={{ userSelectedWriteRelays, setUserSelectedWriteRelays }}>
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
