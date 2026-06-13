import { generateClient } from 'aws-amplify/api';

const client = generateClient();

export interface Institution {
  id: string;
  name: string;
  logo?: string | null;
  bic?: string | null;
}

const LIST_INSTITUTIONS = `
  query ListInstitutions($country: String!) {
    listInstitutions(country: $country) { id name logo bic }
  }
`;
const CONNECT_BANK = `
  mutation ConnectBank($institutionId: String!) {
    connectBank(institutionId: $institutionId) { link requisitionId }
  }
`;
const SYNC_BANK = `
  mutation SyncBank($requisitionId: String!) {
    syncBank(requisitionId: $requisitionId) { imported }
  }
`;

/** The GoCardless mock bank — lets you test the whole flow with no real bank. */
export const SANDBOX_INSTITUTION: Institution = {
  id: 'SANDBOXFINANCE_SFIN0000',
  name: 'Sandbox Finance (test bank)',
};

export async function listInstitutions(country = 'GB'): Promise<Institution[]> {
  const res = (await client.graphql({
    query: LIST_INSTITUTIONS,
    variables: { country },
  })) as { data: { listInstitutions: Institution[] } };
  return res.data.listInstitutions;
}

export async function connectBank(
  institutionId: string,
): Promise<{ link: string; requisitionId: string }> {
  const res = (await client.graphql({
    query: CONNECT_BANK,
    variables: { institutionId },
  })) as { data: { connectBank: { link: string; requisitionId: string } } };
  return res.data.connectBank;
}

export async function syncBank(requisitionId: string): Promise<number> {
  const res = (await client.graphql({
    query: SYNC_BANK,
    variables: { requisitionId },
  })) as { data: { syncBank: { imported: number } } };
  return res.data.syncBank.imported;
}

const PENDING_KEY = 'autoexpense.pendingRequisition';

export function rememberPendingRequisition(id: string): void {
  localStorage.setItem(PENDING_KEY, id);
}
export function takePendingRequisition(): string | null {
  const id = localStorage.getItem(PENDING_KEY);
  if (id) localStorage.removeItem(PENDING_KEY);
  return id;
}
