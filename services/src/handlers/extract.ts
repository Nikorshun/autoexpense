import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import {
  TextractClient,
  AnalyzeExpenseCommand,
  type ExpenseField,
} from '@aws-sdk/client-textract';
import type { PipelinePayload, LineItem } from '../lib/types';

const s3 = new S3Client({});
const textract = new TextractClient({});

/**
 * Step 1 of the pipeline: turn a raw artefact into structured fields.
 *  - email  -> parse the text body (free, no Textract charge)
 *  - upload -> Amazon Textract AnalyzeExpense (purpose-built for receipts)
 */
export async function handler(payload: PipelinePayload): Promise<PipelinePayload> {
  if (!payload.s3Bucket || !payload.s3Key) {
    throw new Error('extract: missing s3Bucket/s3Key');
  }

  if (payload.source === 'upload') {
    return extractWithTextract(payload);
  }
  return extractFromEmail(payload);
}

async function extractWithTextract(payload: PipelinePayload): Promise<PipelinePayload> {
  const res = await textract.send(
    new AnalyzeExpenseCommand({
      Document: { S3Object: { Bucket: payload.s3Bucket, Name: payload.s3Key } },
    }),
  );

  const doc = res.ExpenseDocuments?.[0];
  const summary = doc?.SummaryFields ?? [];

  const merchant = fieldValue(summary, 'VENDOR_NAME') ?? 'Unknown merchant';
  const total = parseFloat(fieldValue(summary, 'TOTAL')?.replace(/[^0-9.]/g, '') ?? '0');
  const date = fieldValue(summary, 'INVOICE_RECEIPT_DATE') ?? new Date().toISOString();

  const lineItems: LineItem[] =
    doc?.LineItemGroups?.flatMap((g) =>
      (g.LineItems ?? []).map((li) => {
        const desc = fieldValue(li.LineItemExpenseFields ?? [], 'ITEM') ?? 'Item';
        const price = parseFloat(
          fieldValue(li.LineItemExpenseFields ?? [], 'PRICE')?.replace(/[^0-9.]/g, '') ?? '0',
        );
        return { description: desc, amount: price };
      }),
    ) ?? [];

  // Textract returns per-field confidence (0-100); average and normalise.
  const confidences = summary
    .map((f) => f.ValueDetection?.Confidence ?? 0)
    .filter((c) => c > 0);
  const confidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
    : 0.5;

  return {
    ...payload,
    extracted: { merchant, date, amount: total, currency: 'GBP', lineItems, confidence },
  };
}

async function extractFromEmail(payload: PipelinePayload): Promise<PipelinePayload> {
  const obj = await s3.send(
    new GetObjectCommand({ Bucket: payload.s3Bucket, Key: payload.s3Key }),
  );
  const body = (await obj.Body?.transformToString()) ?? '';

  // Lightweight parse. Production would use a MIME parser (e.g. mailparser) and
  // per-merchant templates; this demonstrates the free, no-OCR email path.
  const merchant =
    body.match(/From:.*?<?([A-Za-z0-9 .'&-]{2,40})@/i)?.[1]?.trim() ||
    body.match(/receipt from ([A-Za-z0-9 .'&-]{2,40})/i)?.[1]?.trim() ||
    'Email merchant';
  const amountMatch = body.match(/(?:total|amount)\D{0,8}([0-9]+\.[0-9]{2})/i);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  return {
    ...payload,
    extracted: {
      merchant,
      date: new Date().toISOString(),
      amount,
      currency: 'GBP',
      lineItems: [],
      confidence: amount > 0 ? 0.85 : 0.4,
    },
  };
}

function fieldValue(fields: ExpenseField[], type: string): string | undefined {
  return fields.find((f) => f.Type?.Text === type)?.ValueDetection?.Text ?? undefined;
}
