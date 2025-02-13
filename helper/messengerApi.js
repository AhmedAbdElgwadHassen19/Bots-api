const axios = require('axios');
require('dotenv').config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const SEND_API_URL = `https://graph.facebook.com/v17.0/me/messages`; // ✅ استخدم "me" بدلاً من Page_ID

// ✅ دالة إرسال الرسائل إلى ماسنجر
const sendMessage = async (senderId, message) => {
  console.log(`📩 جاري إرسال الرسالة إلى المستخدم ${senderId}: "${message}"`);

  const data = {
    recipient: { id: senderId },
    message: { text: message },
  };

  try {
    const response = await axios.post(SEND_API_URL, data, {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });

    console.log(`✅ تم إرسال الرسالة بنجاح:`, response.data);
  } catch (error) {
    console.error("❌ فشل في إرسال الرسالة إلى ماسنجر:");
    console.error(error.response?.data || error);

    if (error.response?.status === 400) {
      console.error("⚠️ تحقق من أن PAGE_ACCESS_TOKEN صالح.");
    }
  }
};


// ✅ تفعيل حالة "يكتب..."
const setTypingOn = async (senderId) => {
  const data = {
    recipient: { id: senderId },
    sender_action: "typing_on",
  };

  try {
    await axios.post(SEND_API_URL, data, {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });
    console.log(`✍️ تم تفعيل حالة الكتابة للمستخدم ${senderId}`);
  } catch (error) {
    console.error("❌ فشل في تفعيل حالة الكتابة:", error.response?.data || error);
  }
};

// ✅ إيقاف حالة "يكتب..."
const setTypingOff = async (senderId) => {
  const data = {
    recipient: { id: senderId },
    sender_action: "typing_off",
  };

  try {
    await axios.post(SEND_API_URL, data, {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });
    console.log(`✅ تم إيقاف حالة الكتابة للمستخدم ${senderId}`);
  } catch (error) {
    console.error("❌ فشل في إيقاف حالة الكتابة:", error.response?.data || error);
  }
};

module.exports = { sendMessage, setTypingOn, setTypingOff };
