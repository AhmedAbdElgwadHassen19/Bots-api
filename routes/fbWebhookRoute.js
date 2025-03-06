const express = require('express');
const { sendMessage, setTypingOn, setTypingOff } = require('../helper/messengerApi');
const { chatCompletion ,setPrompt } = require('../helper/openaiApi');
require('dotenv').config();
const { setModel, getModel, setApiKey  } = require('../helper/openaiApi');
const axios = require('axios'); // ✅ استيراد axios

const router = express.Router();
let lastSenderId = null;
let conversationContext = "";
let botActive = true; //  ✅البوت مفعل افتراضيًا
let botActivationTime = Date.now(); // ✅ وقت تشغيل البوت

// ✅ API لتحديث حالة البوت من الفرونت إند
router.post('/api/set-bot-status', (req, res) => {
  botActive = req.body.botActive;
  if (botActive) {
      botActivationTime = Date.now(); // ✅ تحديث وقت التفعيل عند تشغيل البوت
  }
  console.log(`🔄 حالة البوت تم تحديثها: ${botActive ? "✅ مفعل" : "⛔ متوقف"}`);
  res.json({ message: `تم تحديث حالة البوت إلى: ${botActive ? "✅ مفعل" : "⛔ متوقف"}` });
});

// ✅ API لتحديث الموديل المختار من الفرونت إند
router.post('/api/set-model', (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ message: "❌ الرجاء اختيار موديل صحيح." });
  }

  setModel(model);
  console.log(`🔄 تم تحديث الموديل إلى: ${getModel()}`);

  res.json({ message: `✅ تم تحديث الموديل إلى: ${getModel()}` });
});

router.post('/api/check-api-key', async (req, res) => {
  console.log("📩 استقبال API Key من الفرونت إند:", req.body); // ✅ تحقق من استقبال المفتاح

  const { apiKey } = req.body;

  if (!apiKey || apiKey.trim() === "") {
      console.error("❌ لم يتم إرسال `API Key` أو أنه فارغ!");
      return res.status(400).json({ valid: false, error: "❌ الرجاء إدخال مفتاح API صالح." });
  }

  try {
      console.log("🚀 التحقق من المفتاح عبر Google:", apiKey);
      const googleResponse = await axios.get(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);

      console.log("✅ استجابة Google:", googleResponse.data);

      if (googleResponse.status === 200) {
          // ✅ المفتاح صالح → احفظه في `openaiApi.js`
          setApiKey(apiKey);
          console.log(`🔑 API Key تم تحديثه: ${apiKey}`);
          return res.json({ valid: true, message: "✅ مفتاح API صالح وتم حفظه بنجاح!" });
      }
      
  } catch (error) {
      console.error("❌ مفتاح API غير صالح:", error.response ? error.response.data : error.message);
      return res.status(400).json({ valid: false, error: "❌ مفتاح API غير صالح، الرجاء إدخال مفتاح صحيح." });
  }
});

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
// ✅ API لإرسال التوكن من الفرونت إند
router.post('/api/tokens', (req, res) => {
  try {
    let { inputTokens, outputTokens } = req.body;

    inputTokens = parseInt(inputTokens);
    outputTokens = parseInt(outputTokens);

    if (isNaN(inputTokens) || isNaN(outputTokens)) {
      console.error("❌ قيم التوكنات غير صالحة:", { inputTokens, outputTokens });
      return res.status(400).json({ message: "❌ الرجاء إدخال قيم رقمية صحيحة." });
    }

    console.log(`✅ توكنات مستلمة: Input - ${inputTokens}, Output - ${outputTokens}`);
    res.json({ message: "✅ تم استقبال التوكنات بنجاح!", inputTokens, outputTokens });

  } catch (error) {
    console.error("❌ خطأ أثناء معالجة التوكنات:", error);
    res.status(500).json({ message: "❌ حدث خطأ غير متوقع." });
  }
});

router.post('/api/send-prompt', async (req, res) => {
  try {
    let { prompt, inputTokens, outputTokens } = req.body;


    if (!prompt || prompt.trim() === "") {
      console.error("❌ برومبت غير صالح:", { prompt });
      return res.status(400).json({ message: "❌ الرجاء إدخال برومبت صحيح." });
    }

    console.log(`✅ برومبت مستلم: ${prompt}`);

    setPrompt(prompt);
    const response = await chatCompletion(prompt, inputTokens, outputTokens);
    

    if (!response || response.status === 0) {
      console.error("❌ لم يتمكن Gemini من الرد.");
      return res.status(500).json({ message: "❌ لم يتمكن Gemini من معالجة البرومبت." });
    }

    console.log("🤖 رد Gemini:", response.response);

    // ✅ إرسال الرد إلى الفرونت إند
    res.json({ message: "✅ تم استقبال البرومبت بنجاح!", prompt, response: response.response });

  } catch (error) {
    console.error("❌ خطأ أثناء معالجة البرومبت:", error);
    res.status(500).json({ message: "❌ حدث خطأ غير متوقع." });
  }
});

// ✅ تحديث سياق المحادثة لكل مستخدم مع حد أقصى 15 رسالة
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

    if (!botActive) {
      console.warn("⛔ البوت متوقف، لن يتم إرسال أي رسالة.");
      return; // 🔴 يتم تجاهل أي رسالة إذا كان البوت متوقفًا
    }
    if (!getModel()) {
      console.warn("⚠️ لم يتم اختيار موديل بعد. الرجاء اختيار موديل قبل بدء المحادثة.");
      return;
    }
    
    const body = req.body;
    res.status(200).send('EVENT_RECEIVED'); // ✅ تأكيد استلام الحدث لفيسبوك

    if (!body.entry || !body.entry[0].messaging) {
      console.warn("⚠️ Received webhook but no valid messaging event.");
      return;
    }

    const messageEvent = body.entry[0].messaging[0];
    const messageTimestamp = messageEvent.timestamp; // ✅ وقت إرسال الرسالة
    // ✅ تجاهل أي رسالة تم استلامها أثناء توقف البوت
    if (messageTimestamp < botActivationTime) {
        console.warn("⏳ تم تجاهل رسالة قديمة.");
        return;
    }


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
    const lastMessages = userSessions[lastSenderId].conversation.slice(-10); // الاحتفاظ بآخر 10 رسائل فقط
    const fullPrompt = `${conversationContext}\n${lastMessages.join("\n")}\nAssistant:`;


    // ✅ إرسال السؤال إلى Gemini
    const geminiResponse = await chatCompletion(fullPrompt);

    // ✅ التحقق من استجابة `Gemini`
    if (!geminiResponse || !geminiResponse.response) {
      console.error("❌ Error: Gemini response is empty.");
      await sendMessage(lastSenderId, " ");
      return;
    }

    console.log("🤖 Gemini Response:", geminiResponse.response);

    // ✅ تحديث المحادثة بإضافة رد البوت
    userSessions[lastSenderId].conversation.push(`Assistant: ${geminiResponse.response}`);

    // ✅ إذا تجاوزت المحادثة 10 رسالة، احذف الأقدم
    if (userSessions[lastSenderId].conversation.length > 10) {
      userSessions[lastSenderId].conversation.shift();
    }

    // ✅ إرسال الرد إلى ماسنجر
    await sendMessage(lastSenderId, geminiResponse.response);
    
    // ✅ إيقاف الكتابة بعد إرسال الرد
    await setTypingOff(lastSenderId);
    
  } catch (error) {
    console.error("❌ Error processing message:", error);
    await sendMessage(lastSenderId, " ");
  }
});

// ✅ مسح الجلسة بعد 10 دقيقة من آخر تفاعل
setInterval(() => {
  const now = Date.now();
  for (const userId in userSessions) {
    const lastMessageTime = userSessions[userId].lastMessageTime || now;
    if (now - lastMessageTime > 10 * 60 * 1000) {
      console.log(`🗑️ حذف جلسة المستخدم ${userId} بعد 15 دقيقة من عدم النشاط.`);
      delete userSessions[userId];
    }
  }
}, 5 * 60 * 1000); // تشغيل التنظيف كل 5 دقائق

module.exports = { router };
