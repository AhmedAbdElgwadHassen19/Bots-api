const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
let selectedModel = null;
let conversationContext = "";
let apiKey = "";
// ✅ دالة لاسترجاع الموديل المختار

// ✅ تحديث API Key
const setApiKey = (key) => {
    apiKey = key;
    console.log(`🔑 API Key تم تحديثه: ${apiKey}`);
};

// ✅ تحديث الموديل المختار
const setModel = (model) => {
  if (!model) {
    console.error("❌ لم يتم استقبال موديل صالح!");
    return;
  }
  selectedModel = model;
  console.log(`✅ تم تحديث الموديل إلى: ${selectedModel}`);
};
const getModel = () => selectedModel;
// ✅ تحديث `prompt` من الفرونت إند
const setPrompt = (prompt) => {
  if (!prompt || prompt.trim() === "") {
    console.error("❌ لم يتم استقبال برومبت صالح!");
    return;
  }
  conversationContext = prompt.trim();
  console.log(`✅ تم تحديث البرومبت إلى: ${conversationContext}`);
};

// ✅ تنفيذ `chatCompletion` مع دعم `MongoDB`
const chatCompletion = async (userMessage, inputTokens, outputTokens, retries = 3) => {
  try {
    if (!selectedModel) {
      console.error("⚠️ لم يتم تحديد موديل.");
      return { status: 0, response: "" };
    }
    if (!apiKey) {
      console.error("⚠️ لم يتم تعيين API Key بعد.");
      return { status: 0, response: "❌ لا يوجد API Key متاح." };
    }

    console.log(`🔍 استخدام الموديل: ${selectedModel}\n- برومبت: ${conversationContext}\n- رسالة المستخدم: ${
      userMessage}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: selectedModel });

    const fullPrompt = `${conversationContext}\nUser: ${userMessage}\nAssistant (يرجى الرد في حدود ${outputTokens} كلمة):`;

    const result = await model.generateContent({
      contents: [{ parts: [{ text: fullPrompt  }] }],
      generationConfig: {
        maxOutputTokens: outputTokens,
        temperature: 0.2,
        topP: 0.1
      }
    });

    if (!result || !result.response || !result.response.candidates || result.response.candidates.length === 0) {
      throw new Error("❌ لا يوجد رد من Gemini.");
    }

    const text = result.response.candidates[0].content.parts[0].text.trim();
    return { status: 1, response: text };

  } catch (error) {
    console.error("❌ خطأ أثناء معالجة البرومبت:", error);

    if (error.status === 503 && retries > 0) {
      console.log(`🔄 إعادة المحاولة بعد 5 ثواني (${3 - retries}/3)...`);
      await new Promise(res => setTimeout(res, 3000));
      return chatCompletion(userMessage, inputTokens, outputTokens, retries - 1);
    }

    return { status: 0, response: "" };
  }
};
// ✅ منع إرسال البرومبت إذا لم يتم اختيار موديل
const isModelSelected = () => selectedModel !== null;
module.exports = { chatCompletion, setModel, getModel, setPrompt, setApiKey , isModelSelected };
