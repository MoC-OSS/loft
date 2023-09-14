import { PredictionResponse } from './@types/response';
import { PredictionInstance, PredictionParameters } from './@types/request';
export declare class Palm {
    private project;
    private apiEndpoint;
    private location;
    private publisher;
    private predictionServiceClient;
    constructor(project: string, apiEndpoint?: string, location?: string, publisher?: string);
    private getEndpoint;
    callPredict(instance: PredictionInstance, parameters: PredictionParameters, model?: string): Promise<PredictionResponse>;
}
//# sourceMappingURL=Palm.d.ts.map