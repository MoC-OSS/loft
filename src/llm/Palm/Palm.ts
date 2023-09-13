import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
import { Metadata, Prediction, PredictionResponse } from './@types/response';
import { PredictionInstance, PredictionParameters } from './@types/request';
import { cleanObject } from '../../helpers';

// const palm = new Palm('gcp-project-name', 'model-name');
//   const instance: PredictionInstance = {
//     context: 'My name is Miles. You are an astronomer, knowledgeable about the solar system.',
//     examples: [
//       { input: { content: 'How many moons does Mars have?' }, output: { content: 'The planet Mars has two moons, Phobos and Deimos.' } }
//     ],
//     messages: [
//       { author: 'user', content: 'How many planets are there in the solar system?' }
//     ]
//   };
export class Palm {
  private predictionServiceClient: PredictionServiceClient;

  constructor(
    private project: string,
    private apiEndpoint: string = 'us-central1-aiplatform.googleapis.com',
    private location: string = 'us-central1',
    private publisher: string = 'google',
  ) {
    const clientOptions = {
      apiEndpoint: this.apiEndpoint,
    };

    this.predictionServiceClient = new PredictionServiceClient(clientOptions);
  }

  private getEndpoint(model: string): string {
    return `projects/${this.project}/locations/${this.location}/publishers/${this.publisher}/models/${model}`;
  }

  public async callPredict(
    instance: PredictionInstance,
    parameters: PredictionParameters,
    model: string = 'chat-bison@001',
  ): Promise<PredictionResponse> {
    const endpoint = this.getEndpoint(model);
    const request = {
      endpoint,
      instances: [helpers.toValue(cleanObject(instance))],
      parameters: helpers.toValue(cleanObject(parameters)),
    };

    try {
      const [response] = await this.predictionServiceClient.predict(
        request as any,
      );
      let resData = response.predictions as unknown as protobuf.common.IValue[];

      const result = {
        predictions: resData.map((element) => {
          return helpers.fromValue(element);
        }) as Prediction[],
        metadata: helpers.fromValue(
          response.metadata as unknown as protobuf.common.IValue,
        ) as Metadata,
      };

      return result;
    } catch (error) {
      console.error(`Error occurred during prediction: ${error}`);
      throw error;
    }
  }
}
