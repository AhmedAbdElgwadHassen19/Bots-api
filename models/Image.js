const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  image_url: { type: String, required: true },
  product_name: { type: String, required: true }
});

const Image = mongoose.model("Image", ImageSchema);

module.exports = Image; // ✅ تصدير الموديل لاستخدامه في أي ملف آخر
