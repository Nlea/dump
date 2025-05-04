import { Hono } from "hono";
import OpenAI from "openai";
import { cors } from "hono/cors";
import proompts from "./proompts";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "/proompt/*",
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

export default app;
