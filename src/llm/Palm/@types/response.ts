export interface Candidate {
  author: string;
  content: string;
}

export interface Citation {
  startIndex: number;
  endIndex: number;
  url: string;
  title: string;
  license: string;
  publicationDate: string;
}

export interface SafetyAttribute {
  categories: string[]; // Assuming categories are strings, adjust as needed
  blocked: boolean;
  scores: number[]; // Assuming scores are numbers, adjust as needed
}

export interface TokenMetadata {
  total_tokens: number;
  total_billable_characters: number;
}

export interface Prediction {
  candidates: Candidate[];
  citationMetadata: {
    citations: Citation[];
  };
  safetyAttributes: SafetyAttribute[];
}

export interface Metadata {
  tokenMetadata: {
    input_token_count: TokenMetadata;
    output_token_count: TokenMetadata;
  };
}

export interface PredictionResponse {
  predictions: Prediction[];
  metadata: Metadata;
}
