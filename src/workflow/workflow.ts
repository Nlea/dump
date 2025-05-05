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
  url: string;
  chunks: string[];
};

export class InsertResearchPaperWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`
    const chunks = await step.do('create chunks from research paper', async () => {
      const url = event.payload.url;
      const response = await fetch(url);
      let text = await response.text();
      
      // Remove HTML tags and decode HTML entities
      text = text.replace(/<[^>]*>/g, '') // Remove HTML tags
                 .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
                 .replace(/&amp;/g, '&') // Replace &amp; with &
                 .replace(/&lt;/g, '<') // Replace &lt; with <
                 .replace(/&gt;/g, '>') // Replace &gt; with >
                 .replace(/&quot;/g, '"') // Replace &quot; with "
                 .replace(/&#39;/g, "'") // Replace &#39; with '
                 .replace(/\s+/g, ' ') // Replace multiple spaces with single space
                 .trim(); // Remove leading/trailing whitespace
      
      // Create chunks similar to Next.js approach
      const chunkSize = 1000; // Adjust this value based on your needs
      const overlap = 200;   // Overlap between chunks to maintain context
      const chunks: string[] = [];
      
      let i = 0;
      while (i < text.length) {
        // Calculate the end of the current chunk
        const end = Math.min(i + chunkSize, text.length);
        
        // Get the chunk
        const chunk = text.slice(i, end);
        
        // Add the chunk to our array
        chunks.push(chunk);
        
        // Move to next position, accounting for overlap
        i = end - overlap;
        
        // If we're near the end, make sure we don't create tiny chunks
        if (i + chunkSize >= text.length) {
          i = text.length;
        }
      }
      
      return chunks;
    })
      

    const storedChunks = await step.do('store chunks', async () => {
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
        model: "o4-mini",
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
        temperature: 1,
        max_completion_tokens: 100
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

