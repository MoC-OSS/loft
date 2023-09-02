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
    categories: string[];
    blocked: boolean;
    scores: number[];
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
//# sourceMappingURL=response.d.ts.map