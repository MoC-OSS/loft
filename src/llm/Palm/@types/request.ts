import { PalmMessage } from '../../../@types';

interface Example {
  input: { content: string; author?: string };
  output: { content: string; author?: string };
}

export interface PredictionInstance {
  context?: string;
  examples?: Example[];
  messages: PalmMessage[];
}

export interface PredictionParameters {
  // todo - add more parameters
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
}
