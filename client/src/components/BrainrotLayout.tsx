import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Link, useLocation } from 'react-router-dom';
import { Film } from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';
import { SettingsModal } from '@/components/SettingsModal';
import { usePersistedState } from '@/hooks/usePersistedState';
import { DEFAULT_BLOSSOM_UPLOAD_URL, DEFAULT_DVM_PUBKEY } from '@/lib/dvmRelays';

const navItems = [
  { path: '/rot', label: 'Rot' },
  { path: '/rotten', label: 'Rotten' },
  { path: '/rehab', label: 'Rehab' },
] as const;

export function BrainrotLayout() {
  const location = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [dvmPubkey, setDvmPubkey] = usePersistedState<string>('video-remix-dvm-pubkey', DEFAULT_DVM_PUBKEY);
  const [blossomUploadUrl, setBlossomUploadUrl] = usePersistedState<string>('video-remix-blossom-url', DEFAULT_BLOSSOM_UPLOAD_URL);
  const [additionalRelays, setAdditionalRelays] = usePersistedState<string[]>('video-remix-additional-relays', []);

  if (!dvmPubkey) {
    setDvmPubkey(DEFAULT_DVM_PUBKEY);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-zinc-50 to-neutral-100 dark:from-slate-950 dark:via-zinc-950 dark:to-neutral-950">
      <header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/rot" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Film className="h-6 w-6" />
                <span className="font-bold text-lg">brainrot.rehab</span>
              </Link>
              <nav className="flex items-center gap-6">
                {navItems.map(({ path, label }) => (
                  <Link
                    key={path}
                    to={path}
                    className={`text-sm font-medium transition-colors ${
                      location.pathname === path
                        ? 'text-foreground underline underline-offset-4'
                        : 'text-muted-foreground hover:text-foreground'
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
