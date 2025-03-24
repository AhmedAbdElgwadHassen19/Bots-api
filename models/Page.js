const mongoose = require("mongoose");

const PageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  pageId: String,
  pageName: String,
});

module.exports = mongoose.model("Page", PageSchema);
