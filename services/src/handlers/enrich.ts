import type { PipelinePayload } from '../lib/types';
import { categorizeByRules, BEDROCK_FALLBACK_THRESHOLD } from '../lib/categorize';

/**
 * Step 2: assign a category. Free rules run first; only low-confidence cases
 * would fall through to Bedrock (lazy invocation — see docs/COSTS.md).
 */
export async function handler(payload: PipelinePayload): Promise<PipelinePayload> {
  if (!payload.extracted) {
    throw new Error('enrich: payload not yet extracted');
  }

  const ruleHit = categorizeByRules(payload.extracted.merchant);

  let category = ruleHit.category;
  if (ruleHit.confidence < BEDROCK_FALLBACK_THRESHOLD) {
    category = await categorizeWithBedrock(payload.extracted.merchant);
  }

  return { ...payload, category };
}

/**
 * Placeholder for the lazy Bedrock call. Wired to a real model via the Bedrock
 * Runtime SDK; stubbed here so the pipeline compiles and runs at $0 by default.
 */
async function categorizeWithBedrock(merchant: string): Promise<string> {
  // TODO: invoke Bedrock (e.g. anthropic.claude / amazon.titan) with a prompt:
  //   "Categorise this merchant into one of [...]: <merchant>"
  console.log(`[bedrock] would categorise low-confidence merchant: ${merchant}`);
  return 'Uncategorised';
}
