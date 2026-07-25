import fs from 'node:fs';
import crypto from 'node:crypto';

const files = ['pigpen-v5.1.json', 'pigpen-v5.2.json'];
const allowed = {
  runtime_class: new Set(['constitutional_system','sovereign_authority','runtime_operator','creative_cognition','support_entity']),
  authority: new Set(['S0','S1','S2','S3','S4']),
  rollback: new Set(['R0','R1','R2','R3','R4','R5']),
  audit: new Set(['CONSTITUTIONAL','FULL_SOVEREIGN','FULL','STANDARD']),
  active_status: new Set(['ALWAYS_ON','ON_DEMAND'])
};

function sha256(path) {
  return crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
}
function load(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
function duplicates(values) {
  const seen = new Set(); const dup = new Set();
  for (const value of values) { const key = String(value).toLowerCase(); if (seen.has(key)) dup.add(value); seen.add(key); }
  return [...dup];
}

const report = { generated_at: new Date().toISOString(), files: {}, errors: [], warnings: [] };
for (const file of files) {
  if (!fs.existsSync(file)) { report.errors.push(`Missing ${file}`); continue; }
  const data = load(file);
  const operators = data.operators ?? [];
  report.files[file] = {
    sha256: sha256(file),
    declared_version: data.registry?.version ?? null,
    declared_status: data.registry?.status ?? null,
    declared_total: data.registry?.total_operators ?? null,
    actual_total: operators.length,
    duplicate_ids: duplicates(operators.map(o => o.id)),
    duplicate_names: duplicates(operators.map(o => o.name))
  };
  if (operators.length !== data.registry?.total_operators) report.errors.push(`${file}: declared total does not match actual total`);
  if (operators.length !== 46) report.errors.push(`${file}: expected 46 operators, found ${operators.length}`);
  for (const field of ['id','name','title','tier','weight','runtime_class','authority','active_status','rollback','audit','allowed_actions','restricted','auto_invocation','cognitive_identity','phase_ownership']) {
    const missing = operators.filter(o => o[field] === undefined || o[field] === null).map(o => o.id ?? o.name ?? 'UNKNOWN');
    if (missing.length) report.errors.push(`${file}: missing ${field} for ${missing.join(', ')}`);
  }
  for (const [field, values] of Object.entries(allowed)) {
    const invalid = operators.filter(o => !values.has(o[field])).map(o => `${o.id}:${o[field]}`);
    if (invalid.length) report.errors.push(`${file}: invalid ${field}: ${invalid.join(', ')}`);
  }
  const invalidWeight = operators.filter(o => !Number.isInteger(o.weight) || o.weight < 1 || o.weight > 5).map(o => `${o.id}:${o.weight}`);
  if (invalidWeight.length) report.errors.push(`${file}: invalid weight: ${invalidWeight.join(', ')}`);
  if (report.files[file].duplicate_ids.length) report.errors.push(`${file}: duplicate IDs detected`);
  if (report.files[file].duplicate_names.length) report.errors.push(`${file}: duplicate names detected`);
}

if (fs.existsSync('pigpen-v5.1.json') && fs.existsSync('pigpen-v5.2.json')) {
  const v51 = load('pigpen-v5.1.json'); const v52 = load('pigpen-v5.2.json');
  const ids51 = new Set((v51.operators ?? []).map(o => o.id));
  const ids52 = new Set((v52.operators ?? []).map(o => o.id));
  report.version_comparison = {
    ids_only_in_v5_1: [...ids51].filter(x => !ids52.has(x)),
    ids_only_in_v5_2: [...ids52].filter(x => !ids51.has(x)),
    v5_2_declares_canonical: v52.registry?.status === 'CANONICAL',
    v5_2_change_note: v52.registry?.change_from_v5_1 ?? null
  };
}

if (!fs.existsSync('pigpen-v4.4.1.json') && !fs.existsSync('pigpen-v4.4.1.md')) {
  report.warnings.push('Narrative companion v4.4.1 is not present as a repository file; checksum cannot be computed from this repository.');
}

fs.mkdirSync('governance', { recursive: true });
fs.writeFileSync('governance/pigpen-hardening-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exit(1);
