import { Hono } from "hono";
import OpenAI from "openai";
import proompts from "./proompts";
import { Params } from "./workflow/workflow";
import { createOpenAPISpec, createFiberplane } from "@fiberplane/hono";

type Env = {
  // Add your bindings here, e.g. Workers KV, D1, Workers AI, etc.
  STORING_WORKFLOW: Workflow;
  OPENAI_API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

app.post("/proompt/:variant", async (c) => {
  if (!Object.keys(proompts).includes(c.req.param("variant"))) {
    c.status(404);
    return c.text("Variant not found");
  }
  const client = new OpenAI({
    apiKey: c.env.OPENAI_API_KEY,
  });

  const response = await client.responses.create({
    model: "gpt-4.1",

    input: [
      {
        type: "message",
        role: "developer",
        content: proompts[c.req.param("variant")],
      },
      {
        type: "message",
        role: "user",
        content: await c.req.text(),
      },
    ],
    stream: true,
  });

  return new Response(response.toReadableStream(), {
    headers: {
      "content-type": "text/event-stream",
    },
  });
});

app.post("/workflow", async (c) => {
  const body = await c.req.json();
  
  if (!Array.isArray(body.chunks)) {
    c.status(400);
    return c.json({ error: "Request body must contain a 'chunks' array" });
  }

  let instance = await c.env.STORING_WORKFLOW.create({
    params: { chunks: body.chunks }
  });

  return Response.json({
    id: instance.id,
    details: await instance.status(),
  });
});

app.get("/openapi.json", (c) => {
  const spec = createOpenAPISpec(app, {
    info: { title: "My API", version: "1.0.0" }
  });
  return c.json(spec);
});

app.use(
  "/fp/*",
  createFiberplane({
    openapi: {
      url: "/openapi.json"
    }
  })
);



export default app;
export { InsertResearchPaperWorkflow } from './workflow/workflow';
  