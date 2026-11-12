import { useEffect, useState } from 'react';
import { clearSession, getSession, saveSession } from './api.js';
import ClaimPage from './ClaimPage.jsx';
import ClaimsList from './ClaimsList.jsx';
import Login from './Login.jsx';
import { navigate, usePath } from './router.js';

const CLAIMS_PATH = '/claims';
const LOGIN_PATH = '/login';

const isClaimsList = (path) => /^\/claims\/?$/.test(path);

function claimIdFrom(path) {
  const match = /^\/claims\/(\d+)\/?$/.exec(path);
  return match ? Number(match[1]) : null;
}

export default function App() {
  const [session, setSession] = useState(getSession);
  const path = usePath();
  const claimId = claimIdFrom(path);
  const onClaims = claimId !== null || isClaimsList(path);

  useEffect(() => {
    if (session && !onClaims) navigate(CLAIMS_PATH, { replace: true });
    if (!session && !onClaims && path !== LOGIN_PATH) navigate(LOGIN_PATH, { replace: true });
  }, [session, onClaims, path]);

  function login(data) {
    saveSession(data);
    setSession(data);
  }

  function logout() {
    clearSession();
    setSession(null);
    navigate(LOGIN_PATH, { replace: true });
  }

  if (!session) return <Login onLogin={login} />;
  if (!onClaims) return null;

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
      {claimId !== null ? (
        <ClaimPage key={claimId} id={claimId} user={session.user} onBack={() => navigate(CLAIMS_PATH)} />
      ) : (
        <ClaimsList user={session.user} onOpen={(id) => navigate(`${CLAIMS_PATH}/${id}`)} />
      )}
    </main>
  );
}
