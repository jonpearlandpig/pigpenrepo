import Anthropic from "@anthropic-ai/sdk";
import type { AKBEntry, ExtractionResult, ExtractedSpec, ExtractedContact, GapItem, GapStatus, GapSeverity, AKBCategory } from "@/lib/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const AKB_CATEGORIES = [
  "POWER", "RIGGING", "STAGING", "AUDIO", "LIGHTING", "VIDEO",
  "BACKLINE", "CATERING", "HOSPITALITY", "CONTACTS", "LOGISTICS",
  "PYRO", "EFFECTS", "GENERAL",
];

// ─────────────────────────────────────────────────────────────
// PRODUCTION RIDER EXTRACTION
// Parses the tour's official production rider into structured AKB entries.
// ─────────────────────────────────────────────────────────────

const RIDER_EXTRACTION_SYSTEM = `You are a concert tour production expert who reads official production riders and extracts structured technical requirements.

A production rider is the touring artist's official technical requirements document. It is the authoritative source of truth (AKB) for what every venue must provide.

You extract every technical requirement, specification, and contact from the rider and return structured JSON.

Categories:
- POWER: power requirements (amperage, voltage, phases, distro needs, generator requirements)
- RIGGING: hang points, weight limits, trim heights, bridle specifications, motor requirements
- STAGING: stage dimensions, deck heights, wing space, downstage edge, stage pocket requirements
- AUDIO: PA system specs (make/model), monitor requirements, console specs, mix position requirements
- LIGHTING: rig specifications, dimmer/node count, follow spot positions and count, lighting console
- VIDEO: LED wall specs, projector requirements, IMAG setup, camera count and positions
- BACKLINE: instrument specifications, amplifier requirements, drum kit specs
- CATERING: meal counts, dietary restrictions, meal timing, runner requirements
- HOSPITALITY: dressing room requirements, parking, credential counts, internet requirements
- CONTACTS: advance contacts by department (production manager, lighting director, audio engineer, etc.)
- LOGISTICS: truck count, bus count, load-in time requirements, advance schedule
- PYRO: pyrotechnic requirements, permits needed, safety officer requirements
- EFFECTS: CO2, confetti, cryo, fog/haze requirements
- GENERAL: anything that doesn't fit above categories

Return ONLY valid JSON matching this exact schema:
{
  "specs": [
    {
      "category": "<CATEGORY>",
      "key": "<specific requirement name, concise>",
      "value": "<the actual requirement/specification>",
      "unit": "<unit of measurement if applicable, else null>",
      "source_text": "<verbatim quote from the document>",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "contacts": [
    {
      "role": "<their role/title>",
      "name": "<full name if present>",
      "email": "<email if present>",
      "phone": "<phone if present>"
    }
  ],
  "raw_summary": "<2-3 sentence summary of the tour's overall production scope>"
}

Confidence levels:
- HIGH: requirement is explicitly stated with clear values
- MEDIUM: requirement is implied or partially specified
- LOW: requirement is vague, contradictory, or needs interpretation

Extract everything. Do not summarize or skip items. If a value is a range, capture the full range.`;

export async function extractProductionRider(
  rawText: string,
  tourName: string
): Promise<ExtractionResult> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8096,
    system: RIDER_EXTRACTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract all technical requirements from this production rider for tour: "${tourName}"\n\n---\n\n${rawText}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown code fences if present
  const jsonText = text.replace(/^```json\s*/m, "").replace(/\s*```$/m, "").trim();

  let parsed: ExtractionResult;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Claude returned invalid JSON for rider extraction: ${text.slice(0, 200)}`);
  }

  return parsed;
}

// ─────────────────────────────────────────────────────────────
// TECH PACKET EXTRACTION
// Parses a venue's technical packet into structured venue specs.
// ─────────────────────────────────────────────────────────────

const VENUE_EXTRACTION_SYSTEM = `You are a concert venue technical expert who reads venue technical packets and extracts structured specifications.

A venue technical packet describes what the venue can provide — its physical specs, equipment inventory, contacts, and capabilities.

You extract every piece of technical information from the venue packet and return structured JSON.

Use the same categories as production riders:
POWER, RIGGING, STAGING, AUDIO, LIGHTING, VIDEO, BACKLINE, CATERING, HOSPITALITY, CONTACTS, LOGISTICS, PYRO, EFFECTS, GENERAL

Return ONLY valid JSON matching this exact schema:
{
  "specs": [
    {
      "category": "<CATEGORY>",
      "key": "<specific spec name, matching rider terminology where possible>",
      "value": "<the venue's actual specification/capability>",
      "unit": "<unit of measurement if applicable, else null>",
      "source_text": "<verbatim quote from the document>",
      "confidence": "HIGH" | "MEDIUM" | "LOW"
    }
  ],
  "contacts": [
    {
      "role": "<their role/title>",
      "name": "<full name if present>",
      "email": "<email if present>",
      "phone": "<phone if present>"
    }
  ],
  "raw_summary": "<2-3 sentence summary of the venue's overall production capabilities>"
}

IMPORTANT: Use terminology that mirrors the production rider vocabulary so specs can be compared. For example, if a rider says "Main PA System" extract the venue's PA info under the same key "Main PA System".`;

export async function extractVenueTechPacket(
  rawText: string,
  venueName: string,
  city: string
): Promise<ExtractionResult> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8096,
    system: VENUE_EXTRACTION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Extract all technical specifications from this venue tech packet for: "${venueName}" in ${city}\n\n---\n\n${rawText}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonText = text.replace(/^```json\s*/m, "").replace(/\s*```$/m, "").trim();

  let parsed: ExtractionResult;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Claude returned invalid JSON for venue extraction: ${text.slice(0, 200)}`);
  }

  return parsed;
}

// ─────────────────────────────────────────────────────────────
// GAP ANALYSIS
// Compares AKB entries against venue specs, identifies issues.
// ─────────────────────────────────────────────────────────────

const GAP_ANALYSIS_SYSTEM = `You are a concert tour production manager performing a technical advance for a show.

You are comparing the tour's official technical requirements (AKB — Authoritative Knowledge Base) against what the venue has provided in their technical packet.

Your job is to identify every discrepancy, shortfall, missing item, or unclear spec that needs attention BEFORE the advance call.

For each AKB requirement, determine the status:
- MATCH: venue spec meets or satisfactorily addresses the requirement
- EXCEEDS: venue spec goes beyond the requirement (note if this causes any operational issue)
- SHORTFALL: venue spec falls short of the requirement (quantify the gap when possible)
- MISSING: AKB requires this but the venue packet has no information about it
- UNCLEAR: venue has something relevant but it is ambiguous or incomplete
- CONFLICT: venue spec directly contradicts the AKB requirement

Severity:
- HIGH: show-stopping — this MUST be resolved before the show can go on
- MEDIUM: needs discussion on the advance call — likely solvable but requires action
- LOW: informational — worth noting but unlikely to cause problems

Return ONLY valid JSON matching this exact schema:
{
  "gaps": [
    {
      "category": "<CATEGORY>",
      "status": "<MATCH|EXCEEDS|SHORTFALL|MISSING|UNCLEAR|CONFLICT>",
      "severity": "<HIGH|MEDIUM|LOW>",
      "akb_key": "<the AKB requirement key>",
      "akb_value": "<what the rider requires>",
      "venue_value": "<what the venue provides, or null if MISSING>",
      "description": "<clear explanation of the gap or confirmation of match>",
      "suggested_action": "<specific recommended action to resolve non-MATCH items>"
    }
  ]
}

Only include MATCH items when the match is exact and worth confirming. Focus on gaps that need attention.
Every SHORTFALL, MISSING, UNCLEAR, and CONFLICT must have a suggested_action.
HIGH severity items should be flagged as "MUST RESOLVE BEFORE ADVANCE CALL".`;

export async function analyzeGaps(
  akbEntries: AKBEntry[],
  venueSpecs: ExtractedSpec[],
  venueName: string,
  tourName: string
): Promise<GapItem[]> {
  const akbJson = JSON.stringify(
    akbEntries.map((e) => ({ id: e.id, category: e.category, key: e.key, value: e.value, unit: e.unit })),
    null,
    2
  );
  const venueJson = JSON.stringify(
    venueSpecs.map((s) => ({ category: s.category, key: s.key, value: s.value, unit: s.unit })),
    null,
    2
  );

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8096,
    system: GAP_ANALYSIS_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Compare the AKB requirements for tour "${tourName}" against the specs for venue "${venueName}".

## AKB Requirements (Tour Standard):
${akbJson}

## Venue Technical Specs:
${venueJson}

Identify all gaps, mismatches, and missing items.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonText = text.replace(/^```json\s*/m, "").replace(/\s*```$/m, "").trim();

  let parsed: { gaps: GapItem[] };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Claude returned invalid JSON for gap analysis: ${text.slice(0, 200)}`);
  }

  return parsed.gaps;
}
