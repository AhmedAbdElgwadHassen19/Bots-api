const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  facebookId: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  profilePicture: String,
  pages: [
    {
      pageId: String,
      pageName: String,
    },
  ],
});

module.exports = mongoose.model("User", UserSchema);