const express = require('express');
const { sendMessage, setTypingOn, setTypingOff } = require('../helper/messengerApi');
const { chatCompletion } = require('../helper/openaiApi');
require('dotenv').config();

const router = express.Router();
let chatMemory = {}; // ✅ تخزين المحادثات لكل مستخدم بشكل منفصل

// ✅ **التحقق من Webhook عند تسجيله في Meta Developer Console**
router.get('/webhook', (req, res) => {
  console.log("🔍 Received Webhook Verification Request");

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      console.log('✅ Webhook Verified Successfully!');
      return res.status(200).send(challenge);
    } else {
      console.log('❌ Webhook Verification Failed! Invalid Token');
      return res.status(403).send('Forbidden: Verification Failed');
    }
  }
  res.status(400).send('❌ Bad Request: Missing Parameters');
});

// ✅ استقبال البرومبت من الفرونت لتحديث سياق المحادثة
router.post('/send-prompt', async (req, res) => {
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

// ✅ استقبال رسائل ماسنجر وإرسالها إلى Gemini مع حفظ المحادثات السابقة
router.post('/webhook', async (req, res) => {
  try {
    console.log("📩 Received Webhook Event");

    const body = req.body;
    res.status(200).send('EVENT_RECEIVED'); // ✅ تأكيد استلام الحدث لفيسبوك

    if (!body.entry || !body.entry[0].messaging) {
      console.warn("⚠️ Received webhook but no valid messaging event.");
      return;
    }

    const messageEvent = body.entry[0].messaging[0];

    // ✅ **تجنب الرد على رسائل البوت نفسه**
    if (messageEvent.message?.is_echo || messageEvent.delivery || messageEvent.read) {
      console.warn("⚠️ Ignoring bot's own message or delivery/read notifications.");
      return;
    }

    const senderId = messageEvent.sender.id;
    const userMessage = messageEvent.message?.text;

    if (!userMessage) {
      console.warn("⚠️ Received a non-text message, ignoring it.");
      return;
    }

    console.log(`📨 Received Message from Messenger (${senderId}):`, userMessage);

    // ✅ إنشاء ذاكرة محادثة للمستخدم إذا لم تكن موجودة
    if (!chatMemory[senderId]) {
      chatMemory[senderId] = [];
    }

    // ✅ إضافة الرسالة الجديدة إلى الذاكرة
    chatMemory[senderId].push({ user: userMessage });

    // ✅ التأكد من أن ذاكرة المستخدم لا تتجاوز 10 رسائل
    if (chatMemory[senderId].length > 10) {
      chatMemory[senderId].shift(); // حذف أقدم رسالة للحفاظ على الحجم
    }

    // ✅ البحث عن محادثات مشابهة داخل ذاكرة المستخدم
    let previousResponse = chatMemory[senderId].find(msg => msg.user.includes(userMessage));

    if (previousResponse && previousResponse.bot) {
      console.log("♻️ استرجاع رد سابق:", previousResponse.bot);
      await sendMessage(senderId, previousResponse.bot);
      return;
    }

    // ✅ إرسال حالة "يكتب..."
    await setTypingOn(senderId);

    // ✅ تجهيز البرومبت مع المحادثات السابقة
    let chatHistory = chatMemory[senderId].map(msg => `User: ${msg.user}\nAssistant: ${msg.bot || ""}`).join("\n");
    const fullPrompt = `${conversationContext}\n\n${chatHistory}\nUser: ${userMessage}\nAssistant:`;

    console.log("🧠 Sending to Gemini with prompt:", fullPrompt);

    // ✅ إرسال السؤال إلى Gemini
    const geminiResponse = await chatCompletion(fullPrompt);

    if (!geminiResponse || !geminiResponse.response) {
      console.error("❌ Error: Gemini response is empty.");
      await sendMessage(senderId, "⚠️ لم أتمكن من معالجة طلبك، حاول مرة أخرى لاحقًا.");
      return;
    }

    console.log("🤖 Gemini Response:", geminiResponse.response);

    // ✅ حفظ رد Gemini في الذاكرة
    chatMemory[senderId][chatMemory[senderId].length - 1].bot = geminiResponse.response;

    // ✅ إرسال الرد إلى ماسنجر
    await sendMessage(senderId, geminiResponse.response);
    
    // ✅ إيقاف حالة "يكتب..."
    await setTypingOff(senderId);
    
  } catch (error) {
    console.error("❌ Error processing message:", error);
    await sendMessage(lastSenderId, "⚠️ حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى لاحقًا.");
  }
});

module.exports = { router };
