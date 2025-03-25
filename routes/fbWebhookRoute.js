const express = require("express");
const {
  sendMessage,
  setTypingOn,
  setTypingOff,
} = require("../helper/messengerApi");
const { chatCompletion, getModel , setPrompt } = require("../helper/openaiApi");
require("dotenv").config();
const { setModel, setApiKey } = require("../helper/openaiApi");
const axios = require("axios"); // ✅ استيراد axios
const mongoose = require("mongoose");
const router = express.Router();
let SenderId = null;
let conversationContext = "";
let botActive = true; //  ✅البوت مفعل افتراضيًا
let botActivationTime = Date.now(); // ✅ وقت تشغيل البوت
const Image = require("../models/Image");

// ✅ الاتصال بـ `MongoDB Atlas`
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ تم الاتصال بقاعدة البيانات MongoDB بنجاح!"))
  .catch((err) => console.error("❌ فشل الاتصال بقاعدة البيانات:", err));

const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// ✅ إعداد `Cloudinary`
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ إعداد `Multer` لاستقبال الصور
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ API لرفع الصور إلى `Cloudinary` وتخزينها في `MongoDB`
router.post("/api/upload-image", upload.single("image"), async (req, res) => {
  try {
    console.log("📥 البيانات المستلمة من الـ frontend:", req.file, req.body);

    if (!req.file || !req.body.product_name) {
      return res
        .status(400)
        .json({ error: "❌ الرجاء رفع صورة وإدخال اسم المنتج." });
    }

    // ✅ رفع الصورة إلى `Cloudinary`
    cloudinary.uploader
      .upload_stream({ resource_type: "image" }, async (error, result) => {
        if (error) {
          console.error("❌ خطأ في رفع الصورة إلى Cloudinary:", error);
          return res
            .status(500)
            .json({ error: "❌ خطأ أثناء رفع الصورة إلى Cloudinary." });
        }

        console.log("✅ تم رفع الصورة إلى Cloudinary:", result.secure_url);

        // ✅ حفظ بيانات الصورة في `MongoDB`
        const newImage = new Image({
          image_url: result.secure_url,
          product_name: req.body.product_name,
        });

        await newImage.save();
        console.log("✅ تم حفظ الصورة في قاعدة البيانات!");

        res.json({
          success: true,
          imageUrl: result.secure_url,
          message: "✅ تم رفع الصورة بنجاح!",
        });
      })
      .end(req.file.buffer);
  } catch (error) {
    console.error("❌ خطأ في API رفع الصورة:", error);
    res
      .status(500)
      .json({ error: "❌ حدث خطأ غير متوقع أثناء معالجة الصورة." });
  }
});

// ✅ API لتحديث حالة البوت من الفرونت إند
router.post("/api/set-bot-status", (req, res) => {
  botActive = req.body.botActive;
  if (botActive) {
    botActivationTime = Date.now(); // ✅ تحديث وقت التفعيل عند تشغيل البوت
  }
  console.log(
    `🔄 حالة البوت تم تحديثها: ${botActive ? "✅ مفعل" : "⛔ متوقف"}`
  );
  res.json({
    message: `تم تحديث حالة البوت إلى: ${botActive ? "✅ مفعل" : "⛔ متوقف"}`,
  });
});

// ✅ API لتحديث الموديل المختار من الفرونت إند
router.post("/api/set-model", (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ message: "❌ الرجاء اختيار موديل صحيح." });
  }

  setModel(model);
  console.log(`🔄 تم تحديث الموديل إلى: ${getModel()}`);

  res.json({ message: `✅ تم تحديث الموديل إلى: ${getModel()}` });
});

router.post("/api/check-api-key", async (req, res) => {
  console.log("📩 استقبال API Key من الفرونت إند:", req.body); // ✅ تحقق من استقبال المفتاح

  const { apiKey } = req.body;

  if (!apiKey || apiKey.trim() === "") {
    console.error("❌ لم يتم إرسال `API Key` أو أنه فارغ!");
    return res
      .status(400)
      .json({ valid: false, error: "❌ الرجاء إدخال مفتاح API صالح." });
  }

  try {
    console.log("🚀 التحقق من المفتاح عبر Google:", apiKey);
    const googleResponse = await axios.get(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
    );

    console.log("✅ استجابة Google:", googleResponse.data);

    if (googleResponse.status === 200) {
      // ✅ المفتاح صالح → احفظه في `openaiApi.js`
      setApiKey(apiKey);
      console.log(`🔑 API Key تم تحديثه: ${apiKey}`);
      return res.json({
        valid: true,
        message: "✅ مفتاح API صالح وتم حفظه بنجاح!",
      });
    }
  } catch (error) {
    console.error(
      "❌ مفتاح API غير صالح:",
      error.response ? error.response.data : error.message
    );
    return res
      .status(400)
      .json({
        valid: false,
        error: "❌ مفتاح API غير صالح، الرجاء إدخال مفتاح صحيح.",
      });
  }
});

// ✅ تخزين المحادثات لكل مستخدم أثناء تشغيل السيرفر (ذاكرة قصيرة المدى)
let userSessions = {};

// ✅ التحقق من Webhook عند تسجيله في Meta Developer Console
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
// ✅ API لإرسال التوكن من الفرونت إند
router.post("/api/tokens", (req, res) => {
  try {
    let { inputTokens, outputTokens } = req.body;

    inputTokens = parseInt(inputTokens);
    outputTokens = parseInt(outputTokens);

    if (isNaN(inputTokens) || isNaN(outputTokens)) {
      console.error("❌ قيم التوكنات غير صالحة:", {
        inputTokens,
        outputTokens,
      });
      return res
        .status(400)
        .json({ message: "❌ الرجاء إدخال قيم رقمية صحيحة." });
    }

    console.log(
      `✅ توكنات مستلمة: Input - ${inputTokens}, Output - ${outputTokens}`
    );
    res.json({
      message: "✅ تم استقبال التوكنات بنجاح!",
      inputTokens,
      outputTokens,
    });
  } catch (error) {
    console.error("❌ خطأ أثناء معالجة التوكنات:", error);
    res.status(500).json({ message: "❌ حدث خطأ غير متوقع." });
  }
});

router.post("/api/send-prompt", async (req, res) => {
  try {
    let { prompt, inputTokens, outputTokens } = req.body;
    console.log("🔢 inputTokens:", inputTokens);
    console.log("🔢 outputTokens:", outputTokens);
    if (!prompt || prompt.trim() === "") {
      console.error("❌ برومبت غير صالح:", { prompt });
      return res.status(400).json({ message: "❌ الرجاء إدخال برومبت صحيح." });
    }

    console.log(`✅ برومبت مستلم: ${prompt}`);

    setPrompt(prompt);
    const response = await chatCompletion(prompt, inputTokens, outputTokens );

    if (!response || response.status === 0) {
      console.error("❌ لم يتمكن Gemini من الرد.");
      return res
        .status(500)
        .json({ message: "❌ لم يتمكن Gemini من معالجة البرومبت." });
    }

    console.log("🤖 رد Gemini:", response.response);

    // ✅ إرسال الرد إلى الفرونت إند
    res.json({
      message: "✅ تم استقبال البرومبت بنجاح!",
      prompt,
      response: response.response,
    });
  } catch (error) {
    console.error("❌ خطأ أثناء معالجة البرومبت:", error);
    res.status(500).json({ message: "❌ حدث خطأ غير متوقع." });
  }
});

// ✅ تحديث سياق المحادثة لكل مستخدم مع حد أقصى 15 رسالة
function updateUserSession(userId, userMessage) {
  if (!userSessions[userId]) {
    userSessions[userId] = { conversation: [], lastProduct: null, lastMessageTime: Date.now() };
  }

  userSessions[userId].conversation.push(userMessage);
  userSessions[userId].lastMessageTime = Date.now();

  // ✅ الاحتفاظ بآخر 15 رسالة فقط
  if (userSessions[userId].conversation.length > 15) {
    userSessions[userId].conversation.shift();
  }
}

// ✅ استقبال رسائل ماسنجر وإرسالها إلى Gemini

router.post('/webhook', async (req, res) => {
  try {
    console.log("📩 Received Webhook Event:", JSON.stringify(req.body, null, 2));

    if (!botActive) {
      console.warn("⛔ البوت متوقف، لن يتم إرسال أي رسالة.");
      return;
    }
    if (!getModel()) {
      console.warn("⚠️ لم يتم اختيار موديل بعد. الرجاء اختيار موديل قبل بدء المحادثة.");
      return;
    }

    const body = req.body;
    res.status(200).send('EVENT_RECEIVED');

    if (!body.entry || !body.entry[0].messaging) {
      console.warn("⚠️ Received webhook but no valid messaging event.");
      return;
    }

    const messageEvent = body.entry[0].messaging[0];
    const SenderId = messageEvent.sender.id;
    const userMessage = messageEvent.message?.text?.trim(); // ✅ تنظيف النص من المسافات الزائدة

    if (!userMessage) {
      console.warn("⚠️ Received a non-text message, ignoring it.");
      return;
    }
    console.log("📨 Received Message from Messenger:", userMessage);

    updateUserSession(SenderId, userMessage);
    // ✅ تفعيل "يكتب..." قبل البحث عن المنتج
    await setTypingOn(SenderId);

    // ✅ التحقق مما إذا كان المستخدم يطلب رؤية آخر منتج تم ذكره
    if (["وريني", "أعرض", "أظهر لي", "عايز أشوفه", "مشاهدة"].some(keyword => userMessage.includes(keyword))) {
      const lastProductName = userSessions[SenderId]?.lastProduct;
      
      if (lastProductName) {
          console.log(`✅ المستخدم يريد رؤية المنتج السابق: ${lastProductName}`);
          const product = await Image.findOne({ product_name: { $regex: new RegExp(lastProductName, "i") } });
  
          if (product) {
              console.log(`✅ المنتج متوفر: ${product.product_name}, إرسال الصورة.`);
              await sendMessage(SenderId, { attachment: { type: "image", payload: { url: product.image_url } } });
              return await setTypingOff(SenderId);
          }
      }
  
      console.log("❌ لا يوجد منتج سابق، البحث عن منتج مشابه...");
      const allProducts = await Image.find({});
      let bestMatch = null;
      let maxMatchCount = 0;
  
      allProducts.forEach(p => {
          const matchCount = (userMessage.match(new RegExp(p.product_name, "gi")) || []).length;
          if (matchCount > maxMatchCount) {
              maxMatchCount = matchCount;
              bestMatch = p;
          }
      });
  
      if (bestMatch) {
          console.log(`✅ وجدنا منتج مشابه: ${bestMatch.product_name}, إرسال الصورة.`);
          await sendMessage(SenderId, { attachment: { type: "image", payload: { url: bestMatch.image_url } } });
          return await setTypingOff(SenderId);
      }
  
      console.log("❌ لا يوجد منتج مطابق أو مشابه.");
      await sendMessage(SenderId, "للاسف غير متوفير");
      return await setTypingOff(SenderId);
  }

    // ✅ البحث عن المنتج في `MongoDB` باستخدام regex
    // ✅ التحقق مما إذا كانت الرسالة تتعلق برؤية صورة منتج
const isImageRequest = ["وريني", "أعرض", "أظهر لي", "عايز أشوفه", "مشاهدة"].some(keyword => userMessage.includes(keyword));

if (isImageRequest) {
    const product = await Image.findOne({ 
        product_name: { $regex: new RegExp(userMessage, "i") } 
    });

    if (product) {
        console.log(`✅ المنتج متوفر: ${product.product_name}, إرسال الصورة.`);
        await sendMessage(senderId, { attachment: { type: "image", payload: { url: product.image_url } } });
        return;
    }

    // ✅ إذا لم يكن المنتج موجودًا، لا يتم إرسال أي رد
    console.log("❌ المنتج غير متوفر، ولن يتم إرسال أي رد.");
    return;
}

if (!conversationContext) {
  console.warn("⚠️ No prompt set from frontend. Using default.");
  conversationContext = "أنت مساعد ذكي يجيب فقط ضمن النطاق المحدد له.";
}
// ✅ إنشاء برومبت باستخدام المحادثة الكاملة لكل مستخدم
    const lastMessages = userSessions[SenderId].conversation.slice(-10); // الاحتفاظ بآخر 10 رسائل فقط
    const fullPrompt = `${conversationContext}\n${lastMessages.join("\n")}\nAssistant:`;

// ✅ إرسال الطلب إلى Gemini
const geminiResponse = await chatCompletion(fullPrompt);

if (!geminiResponse || !geminiResponse.response) {
      console.error("❌ Error: Gemini response is empty.");
      await sendMessage(SenderId, " ");
      return;
    }

// ✅ إرسال رد Gemini إلى المستخدم
console.log("🤖 Gemini Response:", geminiResponse.response);

// ✅ تحديث المحادثة بإضافة رد البوت
userSessions[SenderId].conversation.push(`Assistant: ${geminiResponse.response}`);

// ✅ إذا تجاوزت المحادثة 10 رسالة، احذف الأقدم
if (userSessions[SenderId].conversation.length > 10) {
  userSessions[SenderId].conversation.shift();
}
    await sendMessage(SenderId, geminiResponse.response);
    // ✅ إيقاف "يكتب..." بعد إرسال الرد
    await setTypingOff(SenderId);

  } catch (error) {
    console.error("❌ Error processing message:", error);
    await sendMessage(SenderId, "❌ حدث خطأ أثناء معالجة الطلب.");
    await setTypingOff(SenderId);
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

