import { listAssets } from "@/lib/db";
import { REQUIRED_ASSETS } from "@/lib/constants";

export async function getAssetCoverage(): Promise<{
  complete: boolean;
  missing: Array<{ kind: string; category: string }>;
}> {
  const assets = await listAssets();
  const available = new Set(assets.map((a) => `${a.kind}:${a.category}`));

  const missing = REQUIRED_ASSETS.filter(
    (item) => !available.has(`${item.kind}:${item.category}`)
  );

  return {
    complete: missing.length === 0,
    missing: missing.map((m) => ({ kind: m.kind, category: m.category }))
  };
}
