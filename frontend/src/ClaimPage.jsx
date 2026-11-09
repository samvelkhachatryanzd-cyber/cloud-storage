import { useEffect, useRef, useState } from 'react';
import { api, apiJson } from './api.js';
import { date, dateTime, fileSize, money } from './format.js';

export default function ClaimPage({ id, user, onBack }) {
  const [claim, setClaim] = useState(null);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInput = useRef(null);

  async function load() {
    try {
      setClaim(await apiJson(`/claims/${id}`));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview.url), [preview]);

  async function upload(event) {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      await api(`/claims/${id}/receipts`, { method: 'POST', body });
      setFile(null);
      fileInput.current.value = '';
      await load();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function open(receipt) {
    try {
      const response = await api(`/receipts/${receipt.id}/download`);
      const blob = await response.blob();
      setPreview({ receipt, url: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err.message);
    }
  }

  if (!claim) return <p className="status">{error || 'Loading...'}</p>;

  const canUpload = claim.employee.id === user.id;

  return (
    <>
      <p>
        <button type="button" className="link" onClick={onBack}>
          Back to all claims
        </button>
      </p>

      <section className="card">
        <h2>{claim.title}</h2>
        <dl>
          <dt>Employee</dt>
          <dd>{claim.employee.name}</dd>
          <dt>Date</dt>
          <dd>{date(claim.spentOn)}</dd>
          <dt>Amount</dt>
          <dd>{money(claim.amountCents)}</dd>
        </dl>
      </section>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Type</th>
            <th className="num">Size</th>
            <th>Uploaded by</th>
            <th>Uploaded at</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {claim.receipts.map((receipt) => (
            <tr key={receipt.id}>
              <td>{receipt.fileName}</td>
              <td>{receipt.contentType}</td>
              <td className="num">{fileSize(receipt.sizeBytes)}</td>
              <td>{receipt.uploader.name}</td>
              <td>{dateTime(receipt.createdAt)}</td>
              <td className="num">
                <button type="button" className="secondary" onClick={() => open(receipt)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {claim.receipts.length === 0 && <p className="status">No receipts yet.</p>}

      {canUpload && (
        <form onSubmit={upload} className="upload">
          <input ref={fileInput} type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
          <button type="submit" disabled={!file || uploading}>
            {uploading ? 'Uploading...' : 'Upload receipt'}
          </button>
          {uploadError && <span className="error">{uploadError}</span>}
        </form>
      )}

      {preview && (
        <section className="preview">
          <h3>{preview.receipt.fileName}</h3>
          {preview.receipt.contentType.startsWith('image/') ? (
            <img src={preview.url} alt={preview.receipt.fileName} />
          ) : (
            <iframe src={preview.url} title={preview.receipt.fileName} />
          )}
        </section>
      )}
    </>
  );
}
