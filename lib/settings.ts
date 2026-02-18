import type { WorkflowMode } from "@/types";
import { getAppSetting } from "@/lib/db";

const KEY = "workflow";

export async function getWorkflowDefault(): Promise<WorkflowMode> {
  const setting = await getAppSetting<{ defaultMode?: WorkflowMode }>(KEY);
  if (setting?.defaultMode === "approval" || setting?.defaultMode === "autonomous") {
    return setting.defaultMode;
  }
  return "autonomous";
}
