const axios = require('axios');
require('dotenv').config();

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const SEND_API_URL = `https://graph.facebook.com/v17.0/me/messages`; // ✅ استخدم "me" بدلاً من Page_ID

// ✅ دالة إرسال الرسائل إلى ماسنجر
const sendMessage = async (senderId, message) => {
  const data = {
    recipient: { id: senderId },
    message: { text: message },
  };

  try {
    const response = await axios.post(SEND_API_URL, data, {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });
    console.log(`✅ Message sent successfully to user ${senderId}:`, response.data);
  } catch (error) {
    console.error("❌ Error sending message:", error.response?.data || error);
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
    console.log(`✍️ Typing indicator set for user ${senderId}`);
  } catch (error) {
    console.error("❌ Error setting typing indicator:", error.response?.data || error);
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
    console.log(`✅ Typing indicator stopped for user ${senderId}`);
  } catch (error) {
    console.error("❌ Error stopping typing indicator:", error.response?.data || error);
  }
};

module.exports = { sendMessage, setTypingOn, setTypingOff };
