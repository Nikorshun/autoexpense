import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { randomUUID } from 'node:crypto';
import { putExpense } from '../lib/dynamo';
import { categorizeByRules } from '../lib/categorize';
import type { Expense } from '../lib/types';

// GoCardless Bank Account Data API (formerly Nordigen). Free for personal use.
const GC_BASE = 'https://bankaccountdata.gocardless.com/api/v2';

const ssm = new SSMClient({});

const WEB_URL = process.env.WEB_URL ?? '';
const SECRET_ID_PARAM = process.env.GC_SECRET_ID_PARAM ?? '/autoexpense/gocardless/secret_id';
const SECRET_KEY_PARAM = process.env.GC_SECRET_KEY_PARAM ?? '/autoexpense/gocardless/secret_key';

/** AppSync Lambda-resolver event shape (see the resolver in infra). */
interface ResolverEvent {
  field: 'connectBank' | 'syncBank' | 'listInstitutions';
  sub: string;
  args: { institutionId?: string; requisitionId?: string; country?: string };
}

export async function handler(event: ResolverEvent): Promise<unknown> {
  const token = await getAccessToken();

  switch (event.field) {
    case 'listInstitutions':
      return listInstitutions(token, event.args.country);
    case 'connectBank':
      return connectBank(token, event.sub, event.args.institutionId);
    case 'syncBank':
      return syncBank(token, event.sub, event.args.requisitionId);
    default:
      throw new Error(`Unknown field: ${(event as ResolverEvent).field}`);
  }
}

// --- listInstitutions: banks available in a country ------------------------

async function listInstitutions(token: string, country = 'GB') {
  const res = await fetch(`${GC_BASE}/institutions/?country=${country}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`GoCardless institutions failed: ${res.status}`);
  const json = (await res.json()) as Array<{
    id: string;
    name: string;
    logo?: string;
    bic?: string;
  }>;
  return json.map((i) => ({
    id: i.id,
    name: i.name,
    logo: i.logo ?? null,
    bic: i.bic ?? null,
  }));
}

// --- GoCardless auth -------------------------------------------------------

async function getSecret(name: string): Promise<string> {
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  const value = res.Parameter?.Value;
  if (!value) throw new Error(`Missing SSM parameter: ${name}`);
  return value;
}

async function getAccessToken(): Promise<string> {
  const [secretId, secretKey] = await Promise.all([
    getSecret(SECRET_ID_PARAM),
    getSecret(SECRET_KEY_PARAM),
  ]);
  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_id: secretId, secret_key: secretKey }),
  });
  if (!res.ok) throw new Error(`GoCardless token failed: ${res.status}`);
  const json = (await res.json()) as { access: string };
  return json.access;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// --- connectBank: start a consent flow -------------------------------------

async function connectBank(token: string, sub: string, institutionId?: string) {
  if (!institutionId) throw new Error('connectBank: institutionId is required');

  const reference = `${sub}:${Date.now()}`;
  const res = await fetch(`${GC_BASE}/requisitions/`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      institution_id: institutionId,
      redirect: WEB_URL,
      reference,
      user_language: 'EN',
    }),
  });
  if (!res.ok) throw new Error(`GoCardless requisition failed: ${res.status}`);
  const json = (await res.json()) as { id: string; link: string };
  return { link: json.link, requisitionId: json.id };
}

// --- syncBank: pull transactions after consent -----------------------------

interface GcTransaction {
  internalTransactionId?: string;
  transactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  transactionAmount: { amount: string; currency: string };
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
}

async function syncBank(token: string, sub: string, requisitionId?: string) {
  if (!requisitionId) throw new Error('syncBank: requisitionId is required');

  // 1. Which accounts did the user grant?
  const reqRes = await fetch(`${GC_BASE}/requisitions/${requisitionId}/`, {
    headers: authHeaders(token),
  });
  if (!reqRes.ok) throw new Error(`GoCardless requisition lookup failed: ${reqRes.status}`);
  const requisition = (await reqRes.json()) as { accounts: string[] };

  let imported = 0;

  // 2. Pull booked transactions for each account and store them as expenses.
  for (const accountId of requisition.accounts ?? []) {
    const txRes = await fetch(`${GC_BASE}/accounts/${accountId}/transactions/`, {
      headers: authHeaders(token),
    });
    if (!txRes.ok) continue;
    const body = (await txRes.json()) as {
      transactions?: { booked?: GcTransaction[] };
    };
    const booked = body.transactions?.booked ?? [];

    for (const tx of booked) {
      const amount = parseFloat(tx.transactionAmount.amount);
      // Only money out (debits) are expenses.
      if (!(amount < 0)) continue;

      const merchant =
        tx.creditorName || tx.remittanceInformationUnstructured || 'Card payment';
      const { category, confidence } = categorizeByRules(merchant);
      const date = tx.bookingDate || tx.valueDate || new Date().toISOString();
      // Idempotent id: re-syncing the same transaction overwrites, never dupes.
      const id = tx.internalTransactionId || tx.transactionId || randomUUID();
      const now = new Date().toISOString();

      const expense: Expense = {
        id,
        userId: sub,
        merchant: merchant.trim(),
        date,
        amount: Math.abs(amount),
        currency: tx.transactionAmount.currency || 'GBP',
        category,
        status: confidence >= 0.6 ? 'auto_approved' : 'needs_review',
        source: 'open_banking',
        confidence,
        policyNote: 'Imported from linked bank via Open Banking.',
        createdAt: now,
        updatedAt: now,
      };
      await putExpense(expense);
      imported += 1;
    }
  }

  return { imported };
}
