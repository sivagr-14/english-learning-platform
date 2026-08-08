import { readJson } from "../utils/json";

export interface DurablePlanMember {
  batch_number: number;
  position: number;
  external_candidate_id: string;
  result_id?: string | null;
  entry_payload?: any;
  validation_status?: string | null;
}

export function pendingPlanMembers<T extends DurablePlanMember>(plan: T[]): T[] {
  return plan.filter(
    (member) => !member.result_id || member.validation_status !== "valid",
  );
}

export function reconstructDurableBatches(plan: DurablePlanMember[]) {
  const missing = pendingPlanMembers(plan);
  if (missing.length) {
    throw new Error(
      `Generation incomplete: ${missing.length} of ${plan.length} planned entries have no durable valid result.`,
    );
  }

  const batches = new Map<number, any[]>();
  const seenPositions = new Set<string>();
  for (const member of plan) {
    const key = `${member.batch_number}:${member.position}`;
    if (seenPositions.has(key)) {
      throw new Error(`Duplicate immutable plan position ${key}.`);
    }
    seenPositions.add(key);
    const entries = batches.get(member.batch_number) ?? [];
    entries.push(readJson(member.entry_payload, member.entry_payload));
    batches.set(member.batch_number, entries);
  }

  return Array.from(batches.entries()).map(([batchNumber, entries]) => ({
    batchNumber,
    entries,
  }));
}
