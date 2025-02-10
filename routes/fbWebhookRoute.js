const express = require("express");
const {
  sendMessage,
  setTypingOn,
  setTypingOff,
} = require("../helper/messengerApi");
const { chatCompletion } = require("../helper/openaiApi");
require("dotenv").config();

const router = express.Router();
let lastSenderId = null;
let conversationContext = "";

// ✅ **التحقق من Webhook عند تسجيله في Meta Developer Console**
router.get("/webhook", (req, res) => {
  console.log("🔍 Received Webhook Verification Request");

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      console.log("✅ Webhook Verified Successfully!");
      return res.status(200).send(challenge);
    } else {
      console.log("❌ Webhook Verification Failed! Invalid Token");
      return res.status(403).send("Forbidden: Verification Failed");
    }
  }
  res.status(400).send("❌ Bad Request: Missing Parameters");
});

// ✅ استقبال البرومبت من الفرونت لتحديث سياق المحادثة
router.post("/send-prompt", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ message: "❌ الرجاء إدخال برومبت صالح" });
    }

    conversationContext = prompt;
    console.log("🔄 تم تحديث سياق المحادثة:", conversationContext);

    res.json({ message: "✅ تم تحديث معلومات Gemini بنجاح!" });
  } catch (error) {
    console.error("❌ Error in /send-prompt:", error);
    res.status(500).json({ message: "⚠️ حدث خطأ غير متوقع" });
  }
});

// ✅ استقبال رسائل ماسنجر وإرسالها إلى Gemini
router.post("/webhook", async (req, res) => {
  try {
    console.log("📩 Received Webhook Event");

    const body = req.body;
    if (!body.entry || !Array.isArray(body.entry) || !body.entry[0].messaging) {
      console.warn("⚠️ Received invalid webhook event.");
      return res.sendStatus(400);
    }

    res.status(200).send("EVENT_RECEIVED");

    const messageEvent = body.entry[0].messaging[0];
    if (!messageEvent.sender || !messageEvent.message) return;

    lastSenderId = messageEvent.sender.id;
    const userMessage = messageEvent.message.text;

    if (!userMessage) return;

    console.log(`📨 User (${lastSenderId}): ${userMessage}`);

    // ✅ ضبط الكتابة لفترة قصيرة قبل الرد
    await setTypingOn(lastSenderId);
    setTimeout(async () => await setTypingOff(lastSenderId), 2000);

    const fullPrompt = `${conversationContext}\n\nUser: ${userMessage}\nAssistant:`;
    const geminiResponse = await chatCompletion(fullPrompt);

    if (!geminiResponse || !geminiResponse.response) {
      console.error("❌ Error: Empty response from Gemini");
      await sendMessage(
        lastSenderId,
        "⚠️ لم أتمكن من معالجة طلبك، حاول مرة أخرى لاحقًا."
      );
      return;
    }

    await sendMessage(lastSenderId, geminiResponse.response);
  } catch (error) {
    console.error("❌ Error processing webhook event:", error);
    await sendMessage(
      lastSenderId,
      "⚠️ حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى لاحقًا."
    );
  }
});

module.exports = { router };
