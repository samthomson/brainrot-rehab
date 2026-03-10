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
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-10">
              <Link to="/rot" className="flex items-center gap-3">
                <BrainrotLogo />
                <span className="font-semibold text-lg tracking-tight">
                  brainrot.rehab
                </span>
              </Link>
              <nav className="flex items-center gap-2">
                {navItems.map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      location.pathname === path
                        ? 'text-foreground bg-secondary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
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
