export function getProtectedPrefixes(): string[] {
  const raw = process.env.PROTECTED_PREFIXES;
  if (!raw) {
    return ["00_README_GOVERNANCE/", "01_CANON/", ".github/workflows/", "tools/pigpen/"];
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function extractTouchedPathsFromPatch(patch: string): string[] {
  const paths = new Set<string>();
  const lines = (patch || "").split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      const p = line.slice(4).trim();
      if (p.startsWith("b/")) paths.add(p.slice(2));
      else if (p !== "/dev/null") paths.add(p);
    }
  }
  return [...paths];
}

export function isProtectedPath(path: string, protectedPrefixes: string[]): boolean {
  return protectedPrefixes.some((pre) => path.startsWith(pre));
}
