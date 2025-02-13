const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let selectedModel = "gemini-1.5-pro"; // ✅ الموديل الافتراضي

// ✅ تحديث الموديل المختار
const setModel = (model) => {
  selectedModel = model;
};

// ✅ جلب الموديل الحالي
const getModel = () => selectedModel;

// ✅ إرسال البرومبت باستخدام الموديل المختار
const chatCompletion = async (fullPrompt, modelType = selectedModel, retries = 3) => {
  try {
    console.log(`🔍 استخدام الموديل: ${modelType}`);

    const model = genAI.getGenerativeModel({ model: modelType });

    const result = await model.generateContent({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: 8192
      }
    });

    const text = result.response.candidates[0].content.parts[0].text.trim();
    return { status: 1, response: text };

  } catch (error) {
    console.error("❌ Error calling Gemini:", error);

    if (error.status === 503 && retries > 0) {
      console.log(`🔄 إعادة المحاولة (${4 - retries})...`);
      await new Promise(res => setTimeout(res, 5000));
      return chatCompletion(fullPrompt, modelType, retries - 1);
    }

    return { status: 0, response: "⚠️ حدث خطأ أثناء الاتصال بـ Gemini. حاول لاحقًا." };
  }
};

module.exports = { chatCompletion, setModel, getModel };
