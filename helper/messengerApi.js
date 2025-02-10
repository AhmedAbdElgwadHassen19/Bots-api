const axios = require('axios');
require('dotenv').config();

const SEND_API_URL = `https://graph.facebook.com/v17.0/me/messages`;
const APP_ACCESS_TOKEN = process.env.APP_ACCESS_TOKEN;

if (!APP_ACCESS_TOKEN) {
  console.error("❌ APP_ACCESS_TOKEN مفقود. تأكد من ضبط ملف .env بشكل صحيح.");
  process.exit(1);
}

let cachedPageTokens = null;

const getPageTokens = async (retryCount = 0) => {
  if (cachedPageTokens) return cachedPageTokens;
  try {
    const response = await axios.get(`https://graph.facebook.com/me/accounts`, {
      params: { access_token: APP_ACCESS_TOKEN }
    });

    const pages = response.data.data;
    console.log("✅ الصفحات المرتبطة بالتطبيق:", pages);

    if (pages.length === 0) {
      console.warn("⚠️ لا توجد صفحات مرتبطة بالتطبيق.");
      return {};
    }

    cachedPageTokens = {};
    pages.forEach(page => {
      cachedPageTokens[page.id] = page.access_token;
    });

    return cachedPageTokens;
  } catch (error) {
    console.error("❌ خطأ في جلب الصفحات:", error.response?.data || error);
    
    if (retryCount < 3) {
      console.log(`🔄 إعادة المحاولة (${retryCount + 1}/3)...`);
      await new Promise(res => setTimeout(res, 2000));
      return getPageTokens(retryCount + 1);
    }
    return {};
  }
};

const sendMessage = async (senderId, message, pageId) => {
  const pageTokens = await getPageTokens();
  if (!pageTokens[pageId]) {
    console.error(`❌ لا يوجد توكن لهذه الصفحة: ${pageId}`);
    return false;
  }
  const pageToken = pageTokens[pageId];

  const data = {
    recipient: { id: senderId },
    message: { text: message },
  };

  try {
    const response = await axios.post(SEND_API_URL, data, {
      params: { access_token: pageToken }
    });
    console.log(`✅ تم إرسال الرسالة إلى المستخدم ${senderId}:`, response.data);
    return true;
  } catch (error) {
    console.error("❌ خطأ في إرسال الرسالة:", error.response?.data || error);
    return false;
  }
};

const setTypingOn = async (senderId, pageId) => {
  const pageTokens = await getPageTokens();
  if (!pageTokens[pageId]) {
    console.error(`❌ لا يوجد توكن لهذه الصفحة: ${pageId}`);
    return;
  }
  const pageToken = pageTokens[pageId];

  const data = {
    recipient: { id: senderId },
    sender_action: "typing_on",
  };

  try {
    await axios.post(SEND_API_URL, data, {
      params: { access_token: pageToken }
    });
    console.log(`✍️ Typing indicator set for user ${senderId}`);
  } catch (error) {
    console.error("❌ Error setting typing indicator:", error.response?.data || error);
  }
};

const setTypingOff = async (senderId, pageId) => {
  const pageTokens = await getPageTokens();
  if (!pageTokens[pageId]) {
    console.error(`❌ لا يوجد توكن لهذه الصفحة: ${pageId}`);
    return;
  }
  const pageToken = pageTokens[pageId];

  const data = {
    recipient: { id: senderId },
    sender_action: "typing_off",
  };

  try {
    await axios.post(SEND_API_URL, data, {
      params: { access_token: pageToken }
    });
    console.log(`✅ Typing indicator stopped for user ${senderId}`);
  } catch (error) {
    console.error("❌ Error stopping typing indicator:", error.response?.data || error);
  }
};

module.exports = { sendMessage, setTypingOn, setTypingOff };