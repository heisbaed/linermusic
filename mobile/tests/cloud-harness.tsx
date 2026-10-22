// Test-only entry. Vite's production build includes index.html, never this harness.
import { createRoot } from 'react-dom/client';
import { useAccount } from '../src/useAccount';
import { storeCineUser } from '../src/FirebaseAuth';
import type { AccountState } from '../src/AppContext';
declare global { interface Window { __cloudHarness: { account: AccountState; setSession: typeof storeCineUser } } }
function Harness() {
  const account = useAccount();
  window.__cloudHarness = { account, setSession: storeCineUser };
  return <main><h1>Cloud regression harness</h1><p>{account.syncStatus}</p></main>;
}
createRoot(document.getElementById('root')!).render(<Harness />);
