const express = require('express');
const dotenv = require('dotenv');
const webhookRouter = require('./routes/webhook');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Routes
app.use('/webhook', webhookRouter);

// Health check
app.get('/', (req, res) => {
    res.send('WhatsApp Webhook Service is running.');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
