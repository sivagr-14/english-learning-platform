/**
 * Cost Analysis & Tracking Utility for Gemini API Usage
 * Helps estimate and track costs for vocabulary lesson generation
 * 
 * Usage:
 *   import { estimateJobCost, PRICING } from './cost-tracker';
 *   
 *   const estimate = estimateJobCost({
 *     documentSize: "50 pages",
 *     averageTokensPerChunk: 1500,
 *     escalationRate: 0.03
 *   });
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ModelPricing {
  provider: string;
  model: string;
  inputCost: number; // per 1M tokens
  outputCost: number; // per 1M tokens
  description: string;
}

/**
 * Current Gemini Model Pricing (as of August 2026)
 * All prices in USD per 1 million tokens
 * Source: https://ai.google.dev/pricing
 */
export const PRICING: Record<string, ModelPricing> = {
  "gemini-2.5-flash": {
    provider: "Google Gemini",
    model: "gemini-2.5-flash",
    inputCost: 0.075,
    outputCost: 0.30,
    description: "Fast, cost-effective model for high-volume work",
  },
  "gemini-2.5-pro": {
    provider: "Google Gemini",
    model: "gemini-2.5-pro",
    inputCost: 1.5,
    outputCost: 6.0,
    description: "Advanced reasoning model (40x more expensive)",
  },
  "gemini-2.0-flash": {
    provider: "Google Gemini",
    model: "gemini-2.0-flash",
    inputCost: 0.1,
    outputCost: 0.4,
    description: "Faster version of 2.0, cheaper escalation option",
  },
  "gpt-4-turbo": {
    provider: "OpenAI",
    model: "gpt-4-turbo",
    inputCost: 10.0,
    outputCost: 30.0,
    description: "OpenAI's advanced model (not recommended)",
  },
  "claude-3-sonnet": {
    provider: "Anthropic",
    model: "claude-3-sonnet",
    inputCost: 3.0,
    outputCost: 15.0,
    description: "Anthropic's efficient model",
  },
};

export interface GenerationStats {
  totalDocuments: number;
  averageTokensPerDocument: number;
  assessmentTokensPerChunk: number;
  generationTokensPerEntry: number;
  averageEntriesPerDocument: number;
  escalationRate: number; // 0.0 to 1.0
  batchCacheHitRate?: number; // 0.0 to 1.0 (optional)
}

export interface CostEstimate {
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  primaryCost: number;
  escalationCost: number;
  totalCost: number;
  costPerDocument: number;
  breakdown: {
    assessment: string;
    generation: string;
    escalation: string;
  };
  assumptions: string[];
}

/**
 * Calculate token usage for assessment phase
 * Typical: ~1500 input tokens per chunk, ~200 output tokens
 */
function estimateAssessmentTokens(
  chunksPerDocument: number,
  tokensPerChunk: number = 1500
): { input: number; output: number } {
  // System prompt (~400 tokens) + chunk content + JSON response (~200)
  const inputPerChunk = 400 + tokensPerChunk;
  const outputPerChunk = 200;

  return {
    input: inputPerChunk * chunksPerDocument,
    output: outputPerChunk * chunksPerDocument,
  };
}

/**
 * Calculate token usage for generation phase
 * Typical: ~1500 input tokens per lesson, ~1000 output tokens
 */
function estimateGenerationTokens(
  entriesPerDocument: number,
  tokensPerEntry: number = 1500
): { input: number; output: number } {
  // System prompt (~2000 tokens, quite large) + context + JSON response (~1000)
  const inputPerEntry = 2000 + tokensPerEntry;
  const outputPerEntry = 1000;

  return {
    input: inputPerEntry * entriesPerDocument,
    output: outputPerEntry * entriesPerDocument,
  };
}

/**
 * Main cost estimator for vocabulary lesson generation
 */
export function estimateJobCost(stats: GenerationStats): CostEstimate {
  const {
    totalDocuments,
    averageTokensPerDocument,
    assessmentTokensPerChunk,
    generationTokensPerEntry,
    averageEntriesPerDocument,
    escalationRate = 0.03,
  } = stats;

  // Estimate chunks per document (assuming ~2000 tokens per chunk)
  const chunksPerDocument = Math.ceil(averageTokensPerDocument / 2000);

  // PRIMARY TIER: Assessment
  const assessmentPrimary = estimateAssessmentTokens(
    chunksPerDocument * totalDocuments,
    assessmentTokensPerChunk
  );

  // PRIMARY TIER: Generation (most entries go primary)
  const generationPrimary = estimateGenerationTokens(
    averageEntriesPerDocument * totalDocuments * (1 - escalationRate),
    generationTokensPerEntry
  );

  // ESCALATION TIER: Only failed entries retry here
  const generationEscalation = estimateGenerationTokens(
    averageEntriesPerDocument * totalDocuments * escalationRate,
    generationTokensPerEntry
  );

  const totalInputTokens =
    assessmentPrimary.input +
    generationPrimary.input +
    generationEscalation.input;
  const totalOutputTokens =
    assessmentPrimary.output +
    generationPrimary.output +
    generationEscalation.output;

  const primaryPricing = PRICING["gemini-2.5-flash"];
  const escalationPricing = PRICING["gemini-2.0-flash"]; // Cheaper than pro

  const primaryCost =
    (assessmentPrimary.input * primaryPricing.inputCost +
      assessmentPrimary.output * primaryPricing.outputCost +
      generationPrimary.input * primaryPricing.inputCost +
      generationPrimary.output * primaryPricing.outputCost) /
    1_000_000;

  const escalationCost =
    (generationEscalation.input * escalationPricing.inputCost +
      generationEscalation.output * escalationPricing.outputCost) /
    1_000_000;

  const totalCost = primaryCost + escalationCost;

  return {
    model: "gemini-2.5-flash (primary) + gemini-2.0-flash (escalation)",
    totalInputTokens,
    totalOutputTokens,
    primaryCost,
    escalationCost,
    totalCost,
    costPerDocument: totalCost / totalDocuments,
    breakdown: {
      assessment: `${assessmentPrimary.input + assessmentPrimary.output} tokens @ Flash`,
      generation: `${generationPrimary.input + generationPrimary.output} tokens @ Flash (${((1 - escalationRate) * 100).toFixed(1)}%)`,
      escalation: `${generationEscalation.input + generationEscalation.output} tokens @ 2.0-Flash (${(escalationRate * 100).toFixed(1)}%)`,
    },
    assumptions: [
      `${totalDocuments} documents with ${averageTokensPerDocument} tokens each`,
      `${chunksPerDocument} chunks per document (2K tokens/chunk)`,
      `${averageEntriesPerDocument} vocabulary entries per document`,
      `${(escalationRate * 100).toFixed(1)}% escalation rate to premium tier`,
      `Primary tier: gemini-2.5-flash ($0.075/$0.30 per M input/output)`,
      `Escalation tier: gemini-2.0-flash ($0.10/$0.40 per M input/output)`,
    ],
  };
}

/**
 * Format cost estimate for display
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  return `
📊 Cost Estimate for Vocabulary Generation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Model Configuration:
  ${estimate.model}

Token Usage:
  Input Tokens:   ${estimate.totalInputTokens.toLocaleString()}
  Output Tokens:  ${estimate.totalOutputTokens.toLocaleString()}
  Total:          ${(estimate.totalInputTokens + estimate.totalOutputTokens).toLocaleString()}

Cost Breakdown:
  Primary Tier (Flash):        $${estimate.primaryCost.toFixed(2)}
  Escalation Tier (2.0-Flash): $${estimate.escalationCost.toFixed(2)}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total Cost:                  $${estimate.totalCost.toFixed(2)}
  Cost Per Document:           $${estimate.costPerDocument.toFixed(4)}

Details:
  ${estimate.breakdown.assessment}
  ${estimate.breakdown.generation}
  ${estimate.breakdown.escalation}

Assumptions:
${estimate.assumptions.map((a) => `  • ${a}`).join("\n")}
`;
}

/**
 * Real-world scenarios and their costs
 */
export const SCENARIOS = {
  smallTester: {
    name: "Small Tester (Local Testing)",
    stats: {
      totalDocuments: 1,
      averageTokensPerDocument: 10000, // ~5 pages
      assessmentTokensPerChunk: 1500,
      generationTokensPerEntry: 1500,
      averageEntriesPerDocument: 20,
      escalationRate: 0.05,
    },
  },
  mediumBatch: {
    name: "Medium Batch (10 Documents)",
    stats: {
      totalDocuments: 10,
      averageTokensPerDocument: 50000, // ~25 pages
      assessmentTokensPerChunk: 1500,
      generationTokensPerEntry: 1500,
      averageEntriesPerDocument: 50,
      escalationRate: 0.03,
    },
  },
  monthlyScale: {
    name: "Monthly Scale (1,000 Documents)",
    stats: {
      totalDocuments: 1000,
      averageTokensPerDocument: 100000, // ~50 pages
      assessmentTokensPerChunk: 1500,
      generationTokensPerEntry: 1500,
      averageEntriesPerDocument: 100,
      escalationRate: 0.03,
    },
  },
  largeScale: {
    name: "Large Scale (10K Documents/Month)",
    stats: {
      totalDocuments: 10000,
      averageTokensPerDocument: 100000,
      assessmentTokensPerChunk: 1500,
      generationTokensPerEntry: 1500,
      averageEntriesPerDocument: 100,
      escalationRate: 0.02, // Lower escalation at scale due to refined prompts
    },
  },
};

/**
 * Compare costs across different model strategies
 */
export function comparePricingStrategies(stats: GenerationStats) {
  const strategies = [
    {
      name: "Recommended: Flash Primary + 2.0 Flash Escalation",
      primary: "gemini-2.5-flash",
      escalation: "gemini-2.0-flash",
      escalationRate: stats.escalationRate,
    },
    {
      name: "Aggressive Cost Cutting: Flash Both Tiers (No Escalation)",
      primary: "gemini-2.5-flash",
      escalation: "gemini-2.5-flash",
      escalationRate: 0, // No escalation = skip failed entries
    },
    {
      name: "Premium Quality: Flash Primary + Pro Escalation",
      primary: "gemini-2.5-flash",
      escalation: "gemini-2.5-pro",
      escalationRate: stats.escalationRate,
    },
    {
      name: "Alternative: OpenAI GPT-4 Turbo",
      primary: "gpt-4-turbo",
      escalation: "gpt-4-turbo",
      escalationRate: 0,
    },
  ];

  console.log("💰 PRICING STRATEGY COMPARISON\n");

  strategies.forEach((strategy) => {
    const assessment = estimateAssessmentTokens(
      Math.ceil(
        (stats.averageTokensPerDocument / 2000) * stats.totalDocuments
      ),
      stats.assessmentTokensPerChunk
    );
    const generation = estimateGenerationTokens(
      stats.averageEntriesPerDocument * stats.totalDocuments,
      stats.generationTokensPerEntry
    );

    const primaryPricing = PRICING[strategy.primary];
    const escalationPricing = PRICING[strategy.escalation];

    const primaryCost =
      (assessment.input * primaryPricing.inputCost +
        assessment.output * primaryPricing.outputCost +
        generation.input * primaryPricing.inputCost * (1 - strategy.escalationRate) +
        generation.output * primaryPricing.outputCost * (1 - strategy.escalationRate)) /
      1_000_000;

    const escalationCost =
      (generation.input * escalationPricing.inputCost * strategy.escalationRate +
        generation.output * escalationPricing.outputCost * strategy.escalationRate) /
      1_000_000;

    const totalCost = primaryCost + escalationCost;

    console.log(`${strategy.name}`);
    console.log(`  Primary: ${strategy.primary} + Escalation: ${strategy.escalation}`);
    console.log(`  Total Cost: $${totalCost.toFixed(2)}`);
    console.log(`  Per Document: $${(totalCost / stats.totalDocuments).toFixed(4)}`);
    console.log();
  });
}

/**
 * Usage tracking helper for production monitoring
 */
export interface UsageRecord {
  jobId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  tier: "primary" | "escalation";
  timestamp: Date;
}

export class UsageTracker {
  private records: UsageRecord[] = [];

  addRecord(record: UsageRecord) {
    this.records.push(record);
  }

  getTotalCost(): number {
    return this.records.reduce((total, record) => {
      const pricing = PRICING[record.model];
      if (!pricing) return total;

      const cost =
        (record.inputTokens * pricing.inputCost +
          record.outputTokens * pricing.outputCost) /
        1_000_000;
      return total + cost;
    }, 0);
  }

  getCostByModel(): Record<string, number> {
    const costs: Record<string, number> = {};

    this.records.forEach((record) => {
      const pricing = PRICING[record.model];
      if (!pricing) return;

      const cost =
        (record.inputTokens * pricing.inputCost +
          record.outputTokens * pricing.outputCost) /
        1_000_000;

      costs[record.model] = (costs[record.model] || 0) + cost;
    });

    return costs;
  }

  getCostByTier(): Record<string, number> {
    const costs: Record<"primary" | "escalation", number> = {
      primary: 0,
      escalation: 0,
    };

    this.records.forEach((record) => {
      const pricing = PRICING[record.model];
      if (!pricing) return;

      const cost =
        (record.inputTokens * pricing.inputCost +
          record.outputTokens * pricing.outputCost) /
        1_000_000;

      costs[record.tier] += cost;
    });

    return costs;
  }

  getSummary() {
    const totalCost = this.getTotalCost();
    const byModel = this.getCostByModel();
    const byTier = this.getCostByTier();

    return {
      totalRecords: this.records.length,
      totalCost,
      averageCostPerRecord: this.records.length ? totalCost / this.records.length : 0,
      costByModel: byModel,
      costByTier: byTier,
    };
  }
}

// Example usage
if (require.main === module) {
  console.log(
    formatCostEstimate(
      estimateJobCost(SCENARIOS.monthlyScale.stats)
    )
  );

  console.log("\n");
  comparePricingStrategies(SCENARIOS.monthlyScale.stats);
}
