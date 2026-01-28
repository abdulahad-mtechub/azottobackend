import express from "express";
import { flowSessionEngine } from "../engine/flowSessionEngine";
export const whatsappWebhook = express.Router();

// verify webhook
whatsappWebhook.get("/", (req, res) => {
  const VERIFY_TOKEN = "MY_VERIFY_TOKEN";
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// receive messages
whatsappWebhook.post("/", async (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];

  if (message) {
    const from = message.from;
    const text = message.text?.body;

    // START FLOW / ADVANCE FLOW
    await flowSessionEngine.processIncomingMessage({
      from,
      text,
      phoneNumberId: changes.value.metadata.phone_number_id,
    });
  }

  res.sendStatus(200);
});
