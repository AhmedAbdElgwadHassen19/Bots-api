const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.post("/facebook-login", async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ success: false, message: "❌ التوكن غير موجود!" });
    }

    const fbResponse = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
    );

    if (!fbResponse.data || !fbResponse.data.id) {
      return res.status(400).json({ success: false, message: "❌ التوكن غير صالح!" });
    }

    const { id, name, email, picture } = fbResponse.data;

    let user = await User.findOne({ facebookId: id });

    if (!user) {
      user = new User({
        facebookId: id,
        name,
        email: email || "",
        profilePicture: picture?.data?.url || "",
      });

      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });

    res.json({ success: true, user, token });
  } catch (error) {
    res.status(500).json({ error: "❌ تسجيل الدخول فشل!", details: error.message });
  }
});

module.exports = router;
