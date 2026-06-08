import { generateClient } from 'aws-amplify/api';
import type { Expense } from '../types';
import type { ExpenseRepository } from './repository';

const client = generateClient();

const FIELDS = `
  id merchant date amount currency category status source
  confidence policyNote createdAt updatedAt
`;

const LIST = `query ListExpenses { listExpenses { ${FIELDS} } }`;
const CREATE = `mutation Create($input: ExpenseInput!) { createExpense(input: $input) { ${FIELDS} } }`;
const UPDATE = `mutation Update($id: ID!, $input: ExpenseInput!) { updateExpense(id: $id, input: $input) { ${FIELDS} } }`;
const DELETE = `mutation Delete($id: ID!, $date: String!) { deleteExpense(id: $id, date: $date) }`;

/** Shape AppSync expects for ExpenseInput (no server-managed fields). */
function toInput(e: Expense) {
  return {
    merchant: e.merchant,
    date: e.date,
    amount: e.amount,
    currency: e.currency,
    category: e.category,
    status: e.status,
    source: e.source,
    confidence: e.confidence,
    policyNote: e.policyNote ?? null,
    createdAt: e.createdAt,
  };
}

/**
 * Cloud-backed repository. Reads and writes expenses through the AppSync
 * GraphQL API; every request is authenticated with the signed-in user's
 * Cognito token, and the resolvers scope all data to that user.
 */
export class AppSyncExpenseRepository implements ExpenseRepository {
  async list(): Promise<Expense[]> {
    const res = (await client.graphql({ query: LIST })) as {
      data: { listExpenses: Expense[] };
    };
    return res.data.listExpenses;
  }

  async create(expense: Expense): Promise<Expense> {
    const res = (await client.graphql({
      query: CREATE,
      variables: { input: toInput(expense) },
    })) as { data: { createExpense: Expense } };
    return res.data.createExpense;
  }

  async update(expense: Expense): Promise<Expense> {
    const res = (await client.graphql({
      query: UPDATE,
      variables: { id: expense.id, input: toInput(expense) },
    })) as { data: { updateExpense: Expense } };
    return res.data.updateExpense;
  }

  async remove(expense: Expense): Promise<void> {
    await client.graphql({
      query: DELETE,
      variables: { id: expense.id, date: expense.date },
    });
  }
}
