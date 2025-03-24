const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const Page = require("../models/Page");
const router = express.Router();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes key
const IV_LENGTH = 16; // Initialization vector length
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN; // جلب التوكن من ملف .env

// دالة لتشفير البيانات
const encrypt = (text) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

// جلب الصفحات الخاصة بالمستخدم
router.get("/user/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    res.json({ success: true, pages: user.pages });
  } catch (error) {
    res.status(500).json({ success: false, message: "خطأ في جلب الصفحات", error: error.message });
  }
});

// إضافة صفحة جديدة
router.post("/add", async (req, res) => {
  try {
    const { userId, pageId, pageName } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    user.pages.push({ pageId, pageName });
    await user.save();

    res.json({ success: true, message: "✅ الصفحة أضيفت بنجاح!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "❌ حدث خطأ أثناء إضافة الصفحة!", error: error.message });
  }
});

// تحديث إعدادات صفحة معينة
router.put("/update/:pageId", async (req, res) => {
  try {
    const { pageId } = req.params;
    const { prompt, botSettings } = req.body;

    const page = await Page.findOne({ pageId });
    if (!page) return res.status(404).json({ success: false, message: "الصفحة غير موجودة" });

    if (prompt) page.prompt = prompt;
    if (botSettings) page.botSettings = botSettings;

    await page.save();
    res.json({ success: true, message: "✅ تم تحديث إعدادات الصفحة بنجاح!", page });
  } catch (error) {
    res.status(500).json({ success: false, message: "❌ حدث خطأ أثناء تحديث إعدادات الصفحة!", error: error.message });
  }
});

module.exports = router;