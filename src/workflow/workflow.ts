import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import Replicate from "replicate";
import OpenAI from "openai";
import { R2Bucket } from '@cloudflare/workers-types';

type Env = {
    REPLICATE_API_KEY: string;
    OPENAI_API_KEY: string;
    BUCKET: R2Bucket;
};




// User-defined params passed to your workflow
export type Params = {
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
      return chunks;
    });

    const summary = await step.do('summarize chunks', async () => {
      const openai = new OpenAI({
        apiKey: this.env.OPENAI_API_KEY
      });

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Transform these technical concepts into visual ideas that could be illustrated: ${chunks.join('\n\n')}\n\n Provide a short 2-3 sentence summary focusing on visual elements and metaphors that represent the key ideas and always include a goose.`

          },
          {
            role: "user",
            content: chunks.join('\n\n')
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      });

      const summary = response.choices[0].message.content;
      console.log('Generated summary:', summary);
      return summary;
    });

    const prompt = await step.do('create prompt', async () => {



      const promptStyles = [
        `Create a clean, educational whiteboard-style illustration of ${summary} using clear diagrams and labeled sketches. Style: minimalistic line art with pops of primary color, resembling a classroom explainer video.`,
        `Design a 90s tattoo-style artwork depicting ${summary} as part of an old-school composition. Include thick outlines, banners, roses, lightning bolts, and vintage fonts. Style: traditional Americana tattoo art from the 1990s with a slightly grungy twist.`,
        `Illustrate an expressive, emotional scene in the style of Frida Kahlo representing ${summary}. Integrate surreal elements, vibrant folkloric patterns, flora and fauna, and deep emotional symbolism. Style: oil-painting-inspired, introspective and colorful with Mexican cultural motifs.`
      ];
      
      const randomIndex = Math.floor(Math.random() * promptStyles.length);
      console.log(promptStyles[randomIndex]);
      return promptStyles[randomIndex];
    });

    const imageUrl = await step.do('create images', async () => {

        const replicate = new Replicate({
            auth: this.env.REPLICATE_API_KEY,
          });

        const input = {
            prompt: prompt,
            go_fast: true,
            megapixels: "1",
            num_outputs: 1,
            aspect_ratio: "1:1",
            output_format: "webp",
            output_quality: 80,
            num_inference_steps: 4
          };
          
          const output = await replicate.run("black-forest-labs/flux-schnell", { input }) as Array<{ url: () => URL }>;
          
          // Get the URL from the first output and extract just the href
          const urlObject = output[0].url();
          const imageUrl = urlObject.href;
          console.log('Generated image URL:', imageUrl);
          return imageUrl;
      
    });

    const fileName = await step.do('store images', async () => {
        // Fetch the image from the URL
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const imageData = await response.arrayBuffer();
        
        // Generate a unique filename using timestamp and random string
        const timestamp = new Date().toISOString();
        const randomStr = Math.random().toString(36).substring(7);
        const filename = `image-${timestamp}-${randomStr}.webp`;
        
        // Store in R2
        await this.env.BUCKET.put(filename, imageData);
        
        // Return the R2 URL
        return filename;
    });
     


}}

export default InsertResearchPaperWorkflow;

