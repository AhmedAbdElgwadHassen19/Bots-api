const express = require('express');
require('dotenv').config();
const cors = require('cors');
const fbWebhookRoute = require('./routes/fbWebhookRoute');
const app = express();
const PORT = process.env.PORT || 5000;
const authRoutes = require("./routes/authRoutes");
const pageRoutes = require("./routes/pageRoutes");

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', fbWebhookRoute.router);
app.use('/api', fbWebhookRoute.router); 

app.use("/api/auth", authRoutes);
app.use("/api/pages", pageRoutes);

app.get('/', (req, res) => {
  res.send('✅ Server is running!');
});

app.listen(PORT, (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    return;
  }
  console.log(`🚀 Server is running on port ${PORT}`);
});
