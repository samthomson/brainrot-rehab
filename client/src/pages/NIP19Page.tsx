import { nip19 } from 'nostr-tools';
import { useParams, Navigate } from 'react-router-dom';
import NotFound from './NotFound';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  const { type } = decoded;

  switch (type) {
    case 'npub':
    case 'nprofile':
      return <Navigate to={`/profile/${identifier}`} replace />;

    case 'note':
      return <div>Note placeholder</div>;

    case 'nevent':
      return <div>Event placeholder</div>;

    case 'naddr':
      return <div>Addressable event placeholder</div>;

    default:
      return <NotFound />;
  }
} 