const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const chatCompletion = async (fullPrompt) => {
  try {
    console.log("🔍 Sending request to Gemini API with prompt:", fullPrompt);

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const result = await model.generateContent({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: 150, // ✅ تحديد الحد الأقصى لمنع الردود الطويلة جدًا
        temperature: 0.7 // ✅ ضبط مستوى العشوائية لمنع الإجابات غير المتوقعة
      }
    });

    if (!result.response || !result.response.candidates || result.response.candidates.length === 0) {
      throw new Error("⚠️ لم يتم استلام رد من Gemini.");
    }

    // ✅ استخراج النص بشكل صحيح والتأكد أنه رد واحد فقط
    const text = result.response.candidates[0].content.parts[0].text.trim();

    console.log("✅ Gemini Response:", text);
    return { status: 1, response: text };
  } catch (error) {
    console.error("❌ Error calling Gemini:", error);
    return { status: 0, response: "⚠️ حدث خطأ أثناء الاتصال بـ Gemini." };
  }
};

module.exports = { chatCompletion };
