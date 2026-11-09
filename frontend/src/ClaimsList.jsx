import { useEffect, useState } from 'react';
import { apiJson } from './api.js';
import { date, money } from './format.js';

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ title: '', amount: '', spentOn: today() });

export default function ClaimsList({ user, onOpen }) {
  const [claims, setClaims] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    try {
      setClaims(await apiJson('/claims'));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(event) {
    event.preventDefault();
    try {
      await apiJson('/claims', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title,
          amountCents: Math.round(Number(form.amount) * 100),
          spentOn: form.spentOn,
        }),
      });
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const showEmployee = user.role === 'finance';

  return (
    <>
      <form onSubmit={create} className="card row">
        <label>
          Title
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          Amount, €
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </label>
        <label>
          Date
          <input type="date" value={form.spentOn} onChange={(e) => setForm({ ...form, spentOn: e.target.value })} required />
        </label>
        <button type="submit">New claim</button>
      </form>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Title</th>
            {showEmployee && <th>Employee</th>}
            <th className="num">Amount</th>
            <th className="num">Receipts</th>
          </tr>
        </thead>
        <tbody>
          {claims &&
            claims.map((claim) => (
              <tr key={claim.id} className="clickable" onClick={() => onOpen(claim.id)}>
                <td>{date(claim.spentOn)}</td>
                <td>{claim.title}</td>
                {showEmployee && <td>{claim.employee.name}</td>}
                <td className="num">{money(claim.amountCents)}</td>
                <td className="num">{claim.receiptCount}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {claims && claims.length === 0 && <p className="status">No claims yet.</p>}
    </>
  );
}
