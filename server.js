require('dotenv').config(); // ✅ Must be FIRST

const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('templates'));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const MONGO_URI = process.env.MONGO_URI;
let products_collection;

MongoClient.connect(MONGO_URI).then(client => {
  const db = client.db('shivashakti_db');
  products_collection = db.collection('products');
  console.log('✅ Connected to MongoDB');
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'shakti.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'templates', 'admin.html')));

app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image part' });
  const { name, price, category } = req.body;
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream((error, result) => {
        if (error) reject(error);
        else resolve(result);
      }).end(req.file.buffer);
    });
    const product_data = { name, price, image_url: result.secure_url, category };
    const inserted = await products_collection.insertOne(product_data);
    product_data._id = inserted.insertedId.toString();
    res.status(201).json({ message: 'Product uploaded successfully!', product: product_data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/products', async (req, res) => {
  const { category } = req.query;
  try {
    // ✅ Case-insensitive search — fixes mismatch between "pure-pattu" and "Pure Pattu"
    const query = category ? { category: { $regex: new RegExp(`^${category.trim()}$`, 'i') } } : {};
    const docs = await products_collection.find(query).toArray();
    console.log(`Filter: "${category}" → ${docs.length} results`);
    docs.forEach(d => d._id = d._id.toString());
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/delete', async (req, res) => {
  const { name } = req.body;
  try {
    const result = await products_collection.deleteOne({ name });
    if (result.deletedCount) return res.json({ message: 'Deleted' });
    res.status(404).json({ error: 'Not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Only ONE app.listen at the bottom
app.listen(process.env.PORT || 5000, () => console.log('🚀 Server running at http://localhost:5000'));