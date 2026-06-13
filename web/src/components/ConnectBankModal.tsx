import { useEffect, useState } from 'react';
import {
  listInstitutions,
  connectBank,
  rememberPendingRequisition,
  SANDBOX_INSTITUTION,
  type Institution,
} from '../data/bankingService';

interface Props {
  onClose: () => void;
}

/**
 * Lets the user pick their bank and start the GoCardless consent flow. On
 * confirm, we stash the requisition id and redirect to the bank; when the bank
 * redirects back, App.tsx finishes the sync.
 */
export function ConnectBankModal({ onClose }: Props) {
  const [banks, setBanks] = useState<Institution[]>([SANDBOX_INSTITUTION]);
  const [selected, setSelected] = useState(SANDBOX_INSTITUTION.id);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await listInstitutions('GB');
        setBanks([SANDBOX_INSTITUTION, ...list]);
      } catch {
        setError('Could not load bank list. You can still use the test bank.');
      } finally {
        setLoadingBanks(false);
      }
    })();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { link, requisitionId } = await connectBank(selected);
      rememberPendingRequisition(requisitionId);
      window.location.href = link; // hand off to the bank's consent page
    } catch (e) {
      console.error(e);
      setError('Could not start the bank connection. Check the backend secrets are set.');
      setConnecting(false);
    }
  };

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Connect a bank</h2>
        <p className="modal__sub">
          Securely link a bank via Open Banking to import your transactions. Start
          with the test bank to try the flow end-to-end.
        </p>

        <label className="field">
          <span>Bank</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={loadingBanks || connecting}
          >
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        {loadingBanks && <p className="modal__hint">Loading UK banks…</p>}

        {error && <p className="error">{error}</p>}

        <div className="modal__actions">
          <button className="btn btn--ghost" onClick={onClose} disabled={connecting}>
            Cancel
          </button>
          <button className="btn" onClick={handleConnect} disabled={connecting}>
            {connecting ? 'Redirecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
