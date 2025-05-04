import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

type Env = {
  // Add your bindings here, e.g. Workers KV, D1, Workers AI, etc.
  MY_WORKFLOW: Workflow;
};

// User-defined params passed to your workflow
type Params = {
  email: string;
  metadata: Record<string, string>;
};

export class InsertResearchPaperWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    // Can access bindings on `this.env`
    // Can access params on `event.payload`

    const chunks = await step.do('create chunks', async () => {
      // Fetch a list of files from $SOME_SERVICE
      
    });

    const embeddings = await step.do('create embeddings', async () => {
     
    });

    const storeembeddings = await step.do('store embeddings', async () => {
     
    });

    const poems = await step.do('create poems', async () => {
     
    });

    const storepoems = await step.do('store poems', async () => {
     
    });

}}

export default InsertResearchPaperWorkflow;

