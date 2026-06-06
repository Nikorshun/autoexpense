// Lazy, cost-aware categorisation (see docs/COSTS.md tweak #2).
//
// A free rules table handles the common, confident cases. Only when the rules
// can't decide with confidence does the caller fall back to Amazon Bedrock,
// keeping LLM token spend near zero.

interface RuleHit {
  category: string;
  confidence: number;
}

const RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /coffee|starbucks|costa|pret|cafe|nero/i, category: 'Meals & Entertainment' },
  { pattern: /uber|lyft|train|rail|trainline|taxi|shell|bp|fuel/i, category: 'Travel' },
  { pattern: /aws|amazon web|figma|github|notion|slack|adobe|subscription/i, category: 'Software & Subscriptions' },
  { pattern: /wework|office|staples|ryman/i, category: 'Office' },
  { pattern: /hotel|airbnb|booking\.com|premier inn/i, category: 'Lodging' },
];

/**
 * Returns a category and confidence from the free rules table. If confidence is
 * below `threshold`, the caller should invoke Bedrock for a better answer.
 */
export function categorizeByRules(merchant: string): RuleHit {
  for (const rule of RULES) {
    if (rule.pattern.test(merchant)) {
      return { category: rule.category, confidence: 0.95 };
    }
  }
  return { category: 'Uncategorised', confidence: 0.3 };
}

export const BEDROCK_FALLBACK_THRESHOLD = 0.6;
