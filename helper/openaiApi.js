const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let selectedModel = null; // ❌ لا يوجد موديل افتراضي، يجب على المستخدم اختياره
let conversationContext = ""; // ✅ تخزين `prompt` القادم من الفرونت إند

// ✅ تحديث الموديل المختار من الفرونت
const setModel = (model) => {
  if (!model) {
    console.error("❌ لم يتم استقبال موديل صالح!");
    return;
  }
  selectedModel = model;
  console.log(`✅ تم تحديث الموديل إلى: ${selectedModel}`);
};

// ✅ تحديث `prompt` من الفرونت إند
const setPrompt = (prompt) => {
  if (!prompt || prompt.trim() === "") {
    console.error("❌ لم يتم استقبال برومبت صالح!");
    return;
  }
  conversationContext = prompt.trim();
  console.log(`✅ تم تحديث البرومبت إلى: ${conversationContext}`);
};

// ✅ جلب الموديل الحالي
const getModel = () => selectedModel;
console.log(`🚀 الموديل المستخدم: ${selectedModel}`);

// ✅ إرسال البرومبت باستخدام الموديل المختار مع دعم inputTokens و outputTokens
const chatCompletion = async (userMessage, inputTokens, outputTokens, retries = 3) => {
  try {
    if (!selectedModel) {
      console.error("⚠️ لم يتم تحديد موديل.");
      return { status: 0, response: "" };
    }

    if (!conversationContext) {
      console.warn("⚠️ لا يوجد برومبت محدد، سيتم استخدام برومبت افتراضي.");
    }

    console.log(`🔍 استخدام الموديل: ${selectedModel}\n- برومبت: ${conversationContext}\n- رسالة المستخدم: ${userMessage}\n- Input Tokens: ${inputTokens}\n- Output Tokens: ${outputTokens}`);

    const model = genAI.getGenerativeModel({ model: selectedModel });

    const fullPrompt = `${conversationContext}\nUser: ${userMessage}\nAssistant (يرجى الرد في حدود ${outputTokens} كلمة):`;




    console.log("📌 عدد التوكنات المطلوب:", outputTokens);

    const result = await model.generateContent({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: Math.min(outputTokens * 2, 100), // مضاعفة العدد لضمان الدقة
        temperature: 0.3,  
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
      await new Promise(res => setTimeout(res, 5000));
      return chatCompletion(userMessage, inputTokens, outputTokens, retries - 1);
    }

    return { status: 0, response: "" };
  }
};

// ✅ منع إرسال البرومبت إذا لم يتم اختيار موديل
const isModelSelected = () => selectedModel !== null;

module.exports = { chatCompletion, setModel, setPrompt , getModel, isModelSelected };
