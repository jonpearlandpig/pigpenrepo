import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

export function applyPatch(patch: string) {
  writeFileSync("/tmp/pigpen.patch", patch, "utf8");
  execSync("git apply /tmp/pigpen.patch", { stdio: "inherit" });
}
