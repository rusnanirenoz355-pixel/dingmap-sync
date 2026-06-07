export interface RawRecord {
  id?: number;
  source: string;
  sourceId?: string | null;
  rawTitle?: string | null;
  rawAddress?: string | null;
  rawPhone?: string | null;
  rawSalary?: string | null;
  rawWelfare?: string | null;
  rawManager?: string | null;
  rawJson: Record<string, unknown>;
  fetchedAt: string;
  parseStatus: "pending" | "parsed" | "failed";
  createdAt?: string;
}
