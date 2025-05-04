import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

type Env = {
  // Add your bindings here, e.g. Workers KV, D1, Workers AI, etc.
  MY_WORKFLOW: Workflow;
  REPLICATE_API_KEY: string;
};

// User-defined params passed to your workflow
type Params = {
  email: string;
  metadata: Record<string, string>;
  chunks: string[];
};

export class InsertResearchPaperWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`

    const chunks = await step.do('store chunks', async () => {
      const chunks = event.payload.chunks || [];
      chunks.forEach((chunk: string) => {
        console.log(chunk);
      });
      return chunks.join(' ');
    });

    const prompt = await step.do('create prompt', async () => {
      const promptStyles = [
        `Create a whiteboard-style illustration with bold sketch lines explaining: ${chunks}. Include a playful goose somewhere in the drawing interacting with the concepts. Use a hand-drawn style with thick marker lines.`,
        `Illustrate ${chunks} in a San Francisco themed setting. Include iconic SF elements like the Golden Gate Bridge, cable cars, or fog-covered hills. Make it feel like a tech meetup in the Bay Area.`,
        `Create an artistic and abstract visualization of: ${chunks}. Use bold colors, experimental shapes, and a contemporary art style that could be displayed in a modern gallery. Make it both scientific and avant-garde.`
      ];
      
      const randomIndex = Math.floor(Math.random() * promptStyles.length);
      return promptStyles[randomIndex];
    });

    interface ReplicateResponse {
      id: string;
      status: string;
      output: string[];
    }

    const createimages = await step.do('create images', async () => {
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.env.REPLICATE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',  // Stable Diffusion v2.1
          input: {
            prompt: prompt
          }
        })
      });

      const prediction = await response.json() as ReplicateResponse;
      return {
        id: prediction.id,
        status: prediction.status,
        output: prediction.output
      };
    });

    const storeimages = await step.do('store images', async () => {
        //store images in R2
     
    });
     


}}

export default InsertResearchPaperWorkflow;

