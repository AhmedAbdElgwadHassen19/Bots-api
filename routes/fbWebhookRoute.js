const express = require('express');
const { sendMessage, setTypingOn, setTypingOff } = require('../helper/messengerApi');
const { chatCompletion } = require('../helper/openaiApi');
require('dotenv').config();

const router = express.Router();
let lastSenderId = null;
let conversationContext = "";

// ✅ تخزين المحادثات لكل مستخدم أثناء تشغيل السيرفر (ذاكرة قصيرة المدى)
let userSessions = {};

// ✅ التحقق من Webhook عند تسجيله في Meta Developer Console
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

// ✅ تحديث سياق المحادثة لكل مستخدم مع حد أقصى 30 رسالة
function updateUserSession(userId, userMessage) {
  if (!userSessions[userId]) {
    userSessions[userId] = { conversation: [] };
  }

  userSessions[userId].conversation.push(`User: ${userMessage}`);

  // ✅ إذا تجاوزت المحادثة 30 رسالة، احذف الأقدم
  if (userSessions[userId].conversation.length > 30) {
    userSessions[userId].conversation.shift();
  }
}

// ✅ استقبال رسائل ماسنجر وإرسالها إلى Gemini
router.post('/webhook', async (req, res) => {
  try {
    console.log("📩 Received Webhook Event:", JSON.stringify(req.body, null, 2));

    const body = req.body;
    res.status(200).send('EVENT_RECEIVED'); // ✅ تأكيد استلام الحدث لفيسبوك

    if (!body.entry || !body.entry[0].messaging) {
      console.warn("⚠️ Received webhook but no valid messaging event.");
      return;
    }

    const messageEvent = body.entry[0].messaging[0];

    // ✅ **تجنب الرد على رسائل البوت نفسه**
    if (messageEvent.message?.is_echo) {
      console.warn("⚠️ Ignoring bot's own message.");
      return;
    }

    // ✅ **تجنب الرد على إشعارات التسليم والقراءة**
    if (messageEvent.delivery || messageEvent.read) {
      console.warn("⚠️ Ignoring delivery/read notification.");
      return;
    }

    lastSenderId = messageEvent.sender.id;
    const userMessage = messageEvent.message?.text;

    // ✅ **إذا لم تكن الرسالة نصية، تجاهلها بدون إرسال أي رد**
    if (!userMessage) {
      console.warn("⚠️ Received a non-text message, ignoring it.");
      return;
    }

    console.log("📨 Received Message from Messenger:", userMessage);

    // ✅ التأكد من أن هناك برومبت من الفرونت
    if (!conversationContext) {
      console.warn("⚠️ No prompt set from frontend. Using default.");
      conversationContext = "أنت مساعد ذكي يجيب فقط ضمن النطاق المحدد له.";
    }

    // ✅ تحديث جلسة المستخدم بالمحادثة الجديدة
    updateUserSession(lastSenderId, userMessage);

    // ✅ إنشاء برومبت باستخدام المحادثة الكاملة لكل مستخدم
    const fullPrompt = `${conversationContext}\n${userSessions[lastSenderId].conversation.join("\n")}\nAssistant:`;

    console.log("🧠 Sending to Gemini with context:", fullPrompt);

    // ✅ إرسال السؤال إلى Gemini
    const geminiResponse = await chatCompletion(fullPrompt);

    // ✅ التحقق من استجابة `Gemini`
    if (!geminiResponse || !geminiResponse.response) {
      console.error("❌ Error: Gemini response is empty.");
      await sendMessage(lastSenderId, "⚠️ لم أتمكن من معالجة طلبك، حاول مرة أخرى لاحقًا.");
      return;
    }

    console.log("🤖 Gemini Response:", geminiResponse.response);

    // ✅ تحديث المحادثة بإضافة رد البوت
    userSessions[lastSenderId].conversation.push(`Assistant: ${geminiResponse.response}`);

    // ✅ إذا تجاوزت المحادثة 30 رسالة، احذف الأقدم
    if (userSessions[lastSenderId].conversation.length > 30) {
      userSessions[lastSenderId].conversation.shift();
    }

    // ✅ إرسال الرد إلى ماسنجر
    await sendMessage(lastSenderId, geminiResponse.response);
    
    // ✅ إيقاف الكتابة بعد إرسال الرد
    await setTypingOff(lastSenderId);
    
  } catch (error) {
    console.error("❌ Error processing message:", error);
    await sendMessage(lastSenderId, "⚠️ حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى لاحقًا.");
  }
});

// ✅ مسح الجلسة بعد 30 دقيقة من آخر تفاعل
setInterval(() => {
  const now = Date.now();
  for (const userId in userSessions) {
    const lastMessageTime = userSessions[userId].lastMessageTime || now;
    if (now - lastMessageTime > 30 * 60 * 1000) {
      console.log(`🗑️ حذف جلسة المستخدم ${userId} بعد 30 دقيقة من عدم النشاط.`);
      delete userSessions[userId];
    }
  }
}, 5 * 60 * 1000); // تشغيل التنظيف كل 5 دقائق

module.exports = { router };
