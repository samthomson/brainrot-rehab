import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { BrainrotLogo } from '@/components/BrainrotLogo';
import { LoginArea } from '@/components/auth/LoginArea';
import { SettingsModal } from '@/components/SettingsModal';
import { usePersistedState } from '@/hooks/usePersistedState';
import { DEFAULT_BLOSSOM_UPLOAD_URL, DEFAULT_DVM_PUBKEY } from '@/lib/dvmRelays';

const navItems = [
  { path: '/rot', label: 'Rot' },
  { path: '/rehab', label: 'Rehab' },
] as const;

export function BrainrotLayout() {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [dvmPubkey, setDvmPubkey] = usePersistedState<string>('video-remix-dvm-pubkey', DEFAULT_DVM_PUBKEY);
  const [blossomUploadUrl, setBlossomUploadUrl] = usePersistedState<string>('video-remix-blossom-url', DEFAULT_BLOSSOM_UPLOAD_URL);
  const [additionalRelays, setAdditionalRelays] = usePersistedState<string[]>('video-remix-additional-relays', []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/rot" className="flex items-center gap-3 group">
                <BrainrotLogo />
                <span className="flex items-baseline gap-0 text-xl font-sans">
                  <span className="font-black tracking-tight text-primary underline decoration-foreground decoration-2 underline-offset-[0.47rem]">brainrot</span>
                  <span className="font-bold text-foreground tracking-wide">.</span>
                  <span className="font-bold text-foreground tracking-wide underline decoration-primary decoration-2 underline-offset-[0.47rem]">rehab</span>
                </span>
              </Link>
              <nav className="flex items-center gap-1.5">
                {navItems.map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    className={`relative px-5 py-2.5 text-sm font-semibold rounded-full transition-all duration-200 ${
                      location.pathname === path
                        ? 'bg-primary text-primary-foreground shadow-[0_0_18px_hsl(var(--primary)/0.45)]'
                        : 'text-muted-foreground hover:text-primary border border-transparent hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <LoginArea
              simplified
              onSettingsClick={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        dvmPubkey={dvmPubkey}
        onDvmPubkeyChange={setDvmPubkey}
        blossomUploadUrl={blossomUploadUrl}
        onBlossomUrlChange={setBlossomUploadUrl}
        additionalRelays={additionalRelays}
        onAdditionalRelaysChange={setAdditionalRelays}
      />
    </div>
  );
}
