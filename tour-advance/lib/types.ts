// TAPS — Tour Advance Prep System
// Core domain types

export type UserRole = "ADMIN" | "PM" | "TM" | "VIEWER";

export type AKBCategory =
  | "POWER"
  | "RIGGING"
  | "STAGING"
  | "AUDIO"
  | "LIGHTING"
  | "VIDEO"
  | "BACKLINE"
  | "CATERING"
  | "HOSPITALITY"
  | "CONTACTS"
  | "LOGISTICS"
  | "PYRO"
  | "EFFECTS"
  | "GENERAL";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type GapStatus =
  | "MATCH"       // venue meets AKB requirement
  | "EXCEEDS"     // venue exceeds (may need discussion)
  | "SHORTFALL"   // venue falls short
  | "MISSING"     // AKB requires it, venue packet silent
  | "UNCLEAR"     // venue spec exists but ambiguous
  | "CONFLICT";   // direct contradiction

export type GapSeverity = "HIGH" | "MEDIUM" | "LOW";

// ─── Database row types ───────────────────────────────────────

export interface TapsUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  google_id: string | null;
  role: UserRole;
  created_at: string;
}

export interface Tour {
  id: string;
  name: string;
  artist: string;
  season: string | null;
  akb_locked: boolean;
  akb_locked_by: string | null;
  akb_locked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProductionRider {
  id: string;
  tour_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  raw_text: string | null;
  processed: boolean;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface AKBEntry {
  id: string;
  tour_id: string;
  rider_id: string | null;
  category: AKBCategory;
  key: string;
  value: string;
  unit: string | null;
  source_text: string | null;
  confidence: ConfidenceLevel;
  notes: string | null;
  created_at: string;
}

export interface Venue {
  id: string;
  tour_id: string;
  venue_name: string;
  city: string;
  state_province: string | null;
  country: string;
  address: string | null;
  capacity: number | null;
  load_in_date: string | null;
  show_date: string;
  advance_call_date: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VenueContact {
  id: string;
  venue_id: string;
  role: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: "AKB" | "TECH_PACKET" | "MANUAL" | null;
}

export interface TechPacket {
  id: string;
  venue_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  raw_text: string | null;
  processed: boolean;
  processing_error: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface VenueSpec {
  id: string;
  venue_id: string;
  packet_id: string;
  category: AKBCategory;
  key: string;
  value: string;
  unit: string | null;
  source_text: string | null;
  confidence: ConfidenceLevel;
  created_at: string;
}

export interface GapReport {
  id: string;
  venue_id: string;
  packet_id: string | null;
  category: AKBCategory;
  status: GapStatus;
  severity: GapSeverity;
  akb_entry_id: string | null;
  venue_spec_id: string | null;
  akb_key: string | null;
  akb_value: string | null;
  venue_value: string | null;
  description: string;
  suggested_action: string | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_notes: string | null;
  resolved_at: string | null;
  generated_at: string;
}

// ─── Claude extraction response types ────────────────────────

export interface ExtractedSpec {
  category: AKBCategory;
  key: string;
  value: string;
  unit?: string;
  source_text: string;
  confidence: ConfidenceLevel;
}

export interface ExtractedContact {
  role: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface ExtractionResult {
  specs: ExtractedSpec[];
  contacts: ExtractedContact[];
  raw_summary: string;
}

// ─── Gap analysis types ───────────────────────────────────────

export interface GapItem {
  category: AKBCategory;
  status: GapStatus;
  severity: GapSeverity;
  akb_entry_id?: string;
  venue_spec_id?: string;
  akb_key: string;
  akb_value?: string;
  venue_value?: string;
  description: string;
  suggested_action?: string;
}

export interface GapAnalysisResult {
  venue_id: string;
  packet_id: string;
  gaps: GapItem[];
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    by_status: Record<GapStatus, number>;
    by_category: Record<string, number>;
  };
}

// ─── API request/response types ───────────────────────────────

export interface CreateTourRequest {
  name: string;
  artist: string;
  season?: string;
}

export interface CreateVenueRequest {
  tour_id: string;
  venue_name: string;
  city: string;
  state_province?: string;
  country?: string;
  address?: string;
  capacity?: number;
  load_in_date?: string;
  show_date: string;
  advance_call_date?: string;
}

export interface ApiError {
  error: string;
  details?: string;
}
