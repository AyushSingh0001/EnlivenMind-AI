const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require("mongoose");
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = 3000;

// ----------------- MongoDB Connection -----------------
mongoose
  .connect("mongodb://127.0.0.1:27017/users_data")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("Mongo Error", err));

// ----------------- Schema -----------------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  message: { type: String },
  time: { type: Date, default: Date.now }
});
const User = mongoose.model("user", userSchema);

// ----------------- Middleware -----------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ----------------- Helper Function to Sync JSON -----------------
function updateMessagesJSON() {
  const file = 'messages.json';
  User.find({})
    .then((contacts) => {
      fs.writeFileSync(file, JSON.stringify(contacts, null, 2));
      console.log("messages.json updated!");
    })
    .catch((err) => console.error("Error syncing messages.json:", err));
}

// ----------------- Routes -----------------

// Add new contact
app.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;

    // Save in DB
    const user = new User({ name, email, phone, message });
    await user.save();

    // Sync JSON file
    updateMessagesJSON();

    // Send email notification
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS }
    });

    const mailOptions = {
      from: email,
      to: process.env.GMAIL_USER,
      subject: `New Contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage:\n${message}`
    };

    await transporter.sendMail(mailOptions);

    console.log("New Contact Saved:", user);
    res.status(200).send('Message stored in DB + JSON and email sent');
  } catch (err) {
    console.error("Error in /contact:", err);
    res.status(500).send('Failed to store message');
  }
});

// Get all contacts
app.get('/contacts', async (req, res) => {
  try {
    const contacts = await User.find({});
    console.log("All Contacts:", contacts);
    res.json(contacts);
  } catch (err) {
    console.error("Error fetching contacts:", err);
    res.status(500).send("Failed to fetch contacts");
  }
});

// Delete single contact by ID
app.delete('/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);

    if (!deleted) return res.status(404).send("Contact not found");

    // Update messages.json after delete
    updateMessagesJSON();

    console.log("Deleted Contact:", deleted);
    res.status(200).send("Contact deleted successfully");
  } catch (err) {
    console.error("Error deleting contact:", err);
    res.status(500).send("Failed to delete contact");
  }
});

// Clear all contacts
app.delete('/contacts', async (req, res) => {
  try {
    const result = await User.deleteMany({});
    
    // Update messages.json after clear
    updateMessagesJSON();

    console.log(`Cleared ${result.deletedCount} contacts`);
    res.status(200).send(`Cleared ${result.deletedCount} contacts`);
  } catch (err) {
    console.error("Error clearing contacts:", err);
    res.status(500).send("Failed to clear contacts");
  }
});

// Fallback for homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------- Server -----------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
