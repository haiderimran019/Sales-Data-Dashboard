export type Project = {
  id: string;
  name: string;
  slug: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
};

export type ProjectVersion = {
  id: string;
  version_number: number;
  organization_id: string;
  project_id: string;
  created_at: string;
};

export type DatasetColumn = {
  id: string;
  dataset_id: string;
  original_name: string;
  normalized_name: string;
  inferred_type: string;
  semantic_type: string;
  confidence: number;
  null_percentage: number;
  uniqueness_percentage: number;
  statistics?: {
    minimum?: number | string;
    maximum?: number | string;
    mean?: number;
    median?: number;
  } | null;
};

export type Dataset = {
  id: string;
  name: string;
  row_count: number | null;
  column_count: number;
  quality_score: number | null;
  domain: string;
  domain_confidence: number;
  profile_scope: string;
  quality_details?: {
    warnings?: string[];
    missing_value_count?: number;
    missing_percentage?: number;
    duplicate_row_count?: number;
    duplicate_percentage?: number;
  };
};

export type Relationship = {
  left_dataset_id: string;
  left_column_id: string;
  right_dataset_id: string;
  right_column_id: string;
  relationship_type: string;
  confidence: number;
};

export type Opportunity = {
  kind: string;
  title: string;
  description: string;
  confidence: number;
};

export type ProfileResponse = {
  datasets: Dataset[];
  columns: DatasetColumn[];
  relationships: Relationship[];
  opportunities: Opportunity[];
};

export type ExtractionMetadata = {
  tables?: {
    name: string;
    columns: string[];
    rows: Record<string, unknown>[];
    row_count?: number;
  }[];
  text_blocks?: { location: string; text: string }[];
  warnings?: string[];
  metadata?: Record<string, unknown>;
};

export type UploadedFile = {
  id: string;
  original_filename: string;
  detected_type: string | null;
  extraction_status: string;
  extraction_metadata: ExtractionMetadata | null;
  file_size: number;
  created_at: string;
};

export type UploadItem = {
  filename: string;
  accepted: boolean;
  error?: string;
  file?: UploadedFile;
};

export type AnalysisResult = {
  id: string;
  analysis_type: string;
  title: string;
  description: string;
  status: string;
  result_data: {
    groups?: { key: string; value: number; contribution_percentage: number }[];
    points?: { period: string; value: number; count?: number; period_over_period_percentage: number | null }[];
    bins?: { start: number; end: number; count: number }[];
    coefficient?: number | null;
    potential_anomalies?: { row_index: number; value: number; severity: string }[];
    [key: string]: unknown;
  } | null;
  result_scope: string;
  warnings: string[] | null;
  units?: string | null;
};

export type AnalysisRun = {
  id: string;
  status: string;
  created_at: string;
  plan: { analyses: { analysis_type: string }[] };
  results: AnalysisResult[];
};

export type AIInsightEvidence = {
  statement: string;
  source: string;
  scope: string;
};

export type AIInsightPayload = {
  title?: string;
  summary?: string;
  recommendation?: string;
  question?: string;
  description?: string;
  explanation?: string;
  evidence?: AIInsightEvidence[];
  supporting_evidence?: AIInsightEvidence[];
  confidence?: number;
  uncertainty?: string;
  risks?: string[];
  next_step?: string;
  importance?: number;
  timeframe?: string;
};

export type AIInsightItem = {
  id: string;
  item_type: "insight" | "recommendation" | "suggested_question" | "future_signal" | string;
  classification: "FACT" | "CALCULATION" | "INFERENCE" | "RECOMMENDATION" | "PREDICTION" | string;
  priority_score: number;
  payload: AIInsightPayload;
  created_at?: string;
};

export type AIInsightRun = {
  id: string;
  provider: string;
  model: string;
  created_at: string;
  context_metadata: {
    dataset_count: number;
    result_count: number;
    forecast_count?: number;
    limits?: Record<string, boolean>;
  };
  items: AIInsightItem[];
};

export type ForecastPoint = {
  period: string;
  value: number;
};

export type Forecast = {
  id: string;
  date_column: string;
  measure_column: string;
  frequency: string;
  historical_observation_count: number;
  forecast_horizon: number;
  historical_values: ForecastPoint[];
  forecast_values: ForecastPoint[];
  lower_bound: ForecastPoint[];
  upper_bound: ForecastPoint[];
  method: string;
  mae: number | null;
  warnings: string[] | null;
  result_scope: string;
  created_at?: string;
};

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      // Keep default statusText
    }
    throw new Error(errorDetail);
  }
  return response.json() as Promise<T>;
}
