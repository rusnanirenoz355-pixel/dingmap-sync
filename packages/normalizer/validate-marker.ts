import { z } from "zod";

export const cleanMarkerSchema = z.object({
  source: z.string().min(1),
  siteName: z.string().min(1),
  address: z.string().min(1),
  originType: z.enum(["web", "manual_paste", "excel", "dingmap"]),
  syncAction: z.enum(["create", "update", "archive", "noop", "review"]),
  syncStatus: z.enum(["pending", "need_confirm", "synced", "failed", "skipped"]),
});

export function validateMarker(input: unknown) {
  return cleanMarkerSchema.safeParse(input);
}
