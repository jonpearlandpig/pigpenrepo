export type PigPenRisk = "low" | "medium" | "high";
export type PigPenAction = "PLAN" | "IMPLEMENT" | "FIX_CI" | "UNKNOWN";

export type PigPenPlan = {
  tid: string;
  taid: string;
  version: string;

  action: PigPenAction;
  intent: string;
  domain: string;
  risk: PigPenRisk;

  filesLikely: string[];
  steps: string[];
  tests: string[];
  rollback: string;

  twoKeyRequired: boolean;
};
