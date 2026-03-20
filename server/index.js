import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: "1mb" }));

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({ apiKey });
}

const analysisSchema = {
  name: "flowmap_location_analysis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      name: { type: "string" },
      address: { type: "string" },
      latitude: { type: "number" },
      longitude: { type: "number" },
      traffic_score: { type: "number" },
      peak_hours: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            hour: { type: "string" },
            traffic: { type: "number" },
          },
          required: ["hour", "traffic"],
        },
      },
      daily_pattern: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            day: { type: "string" },
            traffic: { type: "number" },
          },
          required: ["day", "traffic"],
        },
      },
      nearby_pois: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            type: { type: "string" },
            distance: { type: "string" },
          },
          required: ["name", "type", "distance"],
        },
      },
      demographics: {
        type: "object",
        additionalProperties: false,
        properties: {
          commuters: { type: "number" },
          residents: { type: "number" },
          tourists: { type: "number" },
          shoppers: { type: "number" },
        },
        required: ["commuters", "residents", "tourists", "shoppers"],
      },
      estimated_daily_foot_traffic: { type: "number" },
      business_suitability: {
        type: "string",
        enum: ["excellent", "good", "moderate", "low"],
      },
      notes: { type: "string" },
    },
    required: [
      "name",
      "address",
      "latitude",
      "longitude",
      "traffic_score",
      "peak_hours",
      "daily_pattern",
      "nearby_pois",
      "demographics",
      "estimated_daily_foot_traffic",
      "business_suitability",
      "notes",
    ],
  },
};

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/analyze", async (request, response) => {
  try {
    const { location } = request.body ?? {};

    if (!location?.name || typeof location.latitude !== "number" || typeof location.longitude !== "number") {
      response.status(400).json({ error: "A resolved location with coordinates is required." });
      return;
    }

    const client = getOpenAIClient();

    const prompt = [
      "You are a commercial foot-traffic analyst.",
      "Estimate likely pedestrian activity for the provided location using the address, coordinates, and place context.",
      "Be realistic and conservative. Do not pretend you have live sensor data.",
      "Return a practical estimate for a business owner deciding whether to evaluate this location further.",
      "",
      `Name: ${location.name}`,
      `Address: ${location.address}`,
      `Latitude: ${location.latitude}`,
      `Longitude: ${location.longitude}`,
      `Place type: ${location.placeType || "unknown"}`,
      `Context: ${location.context || "unknown"}`,
      "",
      "Rules:",
      "- traffic_score must be between 0 and 100",
      "- peak_hours must cover 6AM through 11PM inclusive",
      "- daily_pattern must cover Mon through Sun",
      "- demographics must sum to 100",
      "- nearby_pois should be plausible nearby destinations or anchors",
      "- notes should briefly explain the estimate and uncertainty",
    ].join("\n");

    const result = await client.responses.create({
      model: "gpt-5-mini",
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "Generate structured JSON only. Follow the schema exactly.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: analysisSchema.name,
          strict: true,
          schema: analysisSchema.schema,
        },
      },
    });

    const payload = JSON.parse(result.output_text);
    response.json(payload);
  } catch (error) {
    const message = error?.message || "Analysis failed.";
    response.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`FlowMap analysis server listening on http://localhost:${port}`);
});
