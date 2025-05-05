import { Hono } from "hono";
import OpenAI from "openai";
import { cors } from "hono/cors";
import proompts from "./proompts";
import { Params } from "./workflow/workflow";
import { createOpenAPISpec, createFiberplane } from "@fiberplane/hono";

type Env = {
  // Add your bindings here, e.g. Workers KV, D1, Workers AI, etc.
  STORING_WORKFLOW: Workflow;
  OPENAI_API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/proompt/*",
  cors({
    origin: "*",
  }),
);

app.use(
  "/workflow",
  cors({
    origin: "*",
  }),
);
app.post("/proompt/:variant", async (c) => {
  if (c.req.header("Authorization") !== "Bearer dumpaihackathon") {
    console.log(c.req.header());
    c.status(401);
    return c.text("Not Authenticated");
  }
  if (!Object.keys(proompts).includes(c.req.param("variant"))) {
    c.status(404);
    return c.text("Variant not found");
  }

  const client = new OpenAI({
    apiKey: c.env.OPENAI_API_KEY,
  });

  let response: OpenAI.Responses.Response & {
    _request_id?: string | null;
  };
  try {
    response = await client.responses.create({
      model: "gpt-4o-mini-2024-07-18",
      input: [
        {
          type: "message",
          role: "system",
          content: proompts[c.req.param("variant")],
        },
        {
          type: "message",
          role: "user",
          content: await c.req.text(),
        },
      ],
    });
  } catch (e) {
    if (e instanceof OpenAI.RateLimitError) {
      c.status(429);
      return c.text(e.message);
    }
    c.status(500);
    return c.text((e as string).toString());
  }

  const output1 = response.output[0];
  if (output1.type !== "message") {
    c.status(500);
    return c.text("Something's wrong");
  }

  if (output1.content[0].type !== "output_text") {
    c.status(500);
    return c.text("No text present");
  }

  console.log("Foo", proompts[c.req.param("variant")], output1.content[0].text);

  c.header("Access-Control-Allow-Origin", "*");

  return c.text(output1.content[0].text);
});

app.post("/workflow", async (c) => {
  const body = await c.req.json();
  
  if (typeof body.url !== 'string' || !body.url) {



    c.status(400);
    return c.json({ error: "Request body must contain a valid 'url' string" });
  }

  let instance = await c.env.STORING_WORKFLOW.create({

    params: { url: body.url }

  });

  return Response.json({
    id: instance.id,
    details: await instance.status(),
  });
});

app.get("/openapi.json", (c) => {
  const spec = createOpenAPISpec(app, {
    info: { title: "My API", version: "1.0.0" },
  });
  return c.json(spec);
});

app.use(
  "/fp/*",
  createFiberplane({
    openapi: {
      url: "/openapi.json",
    },
  }),
);

export default app;
export { InsertResearchPaperWorkflow } from "./workflow/workflow";
