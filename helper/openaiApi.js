const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let selectedModel = null; // ❌ لا يوجد موديل افتراضي، يجب على المستخدم اختياره

// ✅ تحديث الموديل المختار من الفرونت
const setModel = (model) => {
  if (!model) {
    console.error("❌ لم يتم استقبال موديل صالح!");
    return;
  }
  selectedModel = model;
  console.log(`✅ تم تحديث الموديل إلى: ${selectedModel}`);
};

// ✅ جلب الموديل الحالي
const getModel = () => selectedModel;

// ✅ إرسال البرومبت باستخدام الموديل المختار
const chatCompletion = async (fullPrompt, retries = 3) => {
  try {
    if (!selectedModel) {
      console.error("");
      return { status: 0, response: "" };
    }

    console.log(`🔍 استخدام الموديل: ${selectedModel}`);

    const model = genAI.getGenerativeModel({ model: selectedModel });

    const result = await model.generateContent({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: 300
      }
    });

    if (!result || !result.response || !result.response.candidates || result.response.candidates.length === 0) {
      throw new Error("");
    }

    const text = result.response.candidates[0].content.parts[0].text.trim();
    return { status: 1, response: text };

  } catch (error) {
    console.error("", error);

    if (error.message.includes("Invalid model") || error.message.includes("not found")) {
      return { status: 0, response: "" };
    }

    if (error.status === 503 && retries > 0) {
      console.log(`🔄 إعادة المحاولة (${3 - retries})...`);
      await new Promise(res => setTimeout(res, 3000));
      return chatCompletion(fullPrompt, retries - 1);
    }

    return { status: 0, response: "" };
  }
};

// ✅ منع إرسال البرومبت إذا لم يتم اختيار موديل
const isModelSelected = () => selectedModel !== null;

module.exports = { chatCompletion, setModel, getModel, isModelSelected };
