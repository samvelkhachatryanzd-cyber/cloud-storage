import { useState } from 'react';
import { clearSession, getSession, saveSession } from './api.js';
import ClaimPage from './ClaimPage.jsx';
import ClaimsList from './ClaimsList.jsx';
import Login from './Login.jsx';

export default function App() {
  const [session, setSession] = useState(getSession);
  const [claimId, setClaimId] = useState(null);

  function login(data) {
    saveSession(data);
    setSession(data);
  }

  function logout() {
    clearSession();
    setSession(null);
    setClaimId(null);
  }

  if (!session) return <Login onLogin={login} />;

  return (
    <main>
      <header>
        <h1>Expense claims</h1>
        <span className="status">
          {session.user.name} · {session.user.role}
        </span>
        <button type="button" className="secondary" onClick={logout}>
          Log out
        </button>
      </header>
      {claimId ? (
        <ClaimPage id={claimId} user={session.user} onBack={() => setClaimId(null)} />
      ) : (
        <ClaimsList user={session.user} onOpen={setClaimId} />
      )}
    </main>
  );
}
