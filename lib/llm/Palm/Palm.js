import { PredictionServiceClient, helpers } from '@google-cloud/aiplatform';
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
    project;
    apiEndpoint;
    location;
    publisher;
    predictionServiceClient;
    constructor(project, apiEndpoint = 'us-central1-aiplatform.googleapis.com', location = 'us-central1', publisher = 'google') {
        this.project = project;
        this.apiEndpoint = apiEndpoint;
        this.location = location;
        this.publisher = publisher;
        const clientOptions = {
            apiEndpoint: this.apiEndpoint,
        };
        this.predictionServiceClient = new PredictionServiceClient(clientOptions);
    }
    getEndpoint(model) {
        return `projects/${this.project}/locations/${this.location}/publishers/${this.publisher}/models/${model}`;
    }
    async callPredict(instance, parameters, model = 'chat-bison@001') {
        const endpoint = this.getEndpoint(model);
        const request = {
            endpoint,
            instances: [helpers.toValue(instance)],
            parameters: helpers.toValue(parameters),
        };
        try {
            const [response] = await this.predictionServiceClient.predict(request);
            let resData = response.predictions;
            const result = {
                predictions: resData.map((element) => {
                    return helpers.fromValue(element);
                }),
                metadata: helpers.fromValue(response.metadata),
            };
            return result;
        }
        catch (error) {
            console.error(`Error occurred during prediction: ${error}`);
            throw error;
        }
    }
}
