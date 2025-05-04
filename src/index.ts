import { Hono } from "hono";
import OpenAI from "openai";
import proompts from "./proompts";

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

export default app;
