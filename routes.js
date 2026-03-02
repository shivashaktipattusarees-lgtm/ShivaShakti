// routes.js - All API & Auth Routes

const express = require('express');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const auth = require('./auth');
const db = require('./database');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * GET / - Serve customer frontend (shakti.html)
 */
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'shakti.html'));
});

/**
 * GET /admin - Serve admin panel (admin.html)
 */
router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

/**
 * GET /health - Health check
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'Server running', 
    port: 5000,
    database: db.isConnected() ? 'Connected' : 'Disconnected'
  });
});

/**
 * GET /auth/google - Redirect to Google OAuth
 */
router.get('/auth/google', (req, res) => {
  const authURL = auth.getGoogleAuthURL();
  res.redirect(authURL);
});

/**
 * GET /auth/google/callback - OAuth callback handler
 */
router.get('/auth/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.send(auth.popupHtml({ error: error || 'Login cancelled' }));
  }

  try {
    const userInfo = await auth.getGoogleUserInfo(code);
    const { email, name, picture } = userInfo;
    
    res.send(auth.popupHtml({ email, name, picture }));

  } catch (error) {
    console.error('[OAUTH ERROR]', error.message);
    res.send(auth.popupHtml({ error: error.message }));
  }
});

/**
 * POST /auth/send-otp - Send OTP to authorized email
 */
router.post('/auth/send-otp', async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = await auth.sendOTP(email);
    res.json(result);

  } catch (error) {
    console.error('[OTP SEND ERROR]', error.message);
    
    if (error.message === 'Unauthorised email') {
      return res.status(403).json({ error: 'Unauthorised email' });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /auth/verify-otp - Verify OTP
 */
router.post('/auth/verify-otp', (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const otp = (req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP required' });
    }

    const result = auth.verifyOTP(email, otp);
    res.json(result);

  } catch (error) {
    console.error('[OTP VERIFY ERROR]', error.message);
    
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/products - Get all products (with optional category filter)
 */
router.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;
    const products = await db.getProducts(category);
    res.json(products);

  } catch (error) {
    console.error('[GET PRODUCTS ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/upload - Upload new product
 */
router.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const { name, price, category } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ error: 'Missing required fields: name, price, category' });
    }

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream((error, result) => {
        if (error) reject(error);
        else resolve(result);
      }).end(req.file.buffer);
    });

    // Save to database
    const productData = {
      name: name.trim(),
      price: Number(price),
      image_url: result.secure_url,
      category: category.trim()
    };

    const product = await db.addProduct(productData);
    console.log(`[UPLOAD] Product uploaded: ${name}`);

    res.status(201).json({ 
      message: 'Product uploaded successfully!', 
      product 
    });

  } catch (error) {
    console.error('[UPLOAD ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/delete - Delete product
 */
router.delete('/api/delete', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name required' });
    }

    const result = await db.deleteProduct(name);
    res.json(result);

  } catch (error) {
    console.error('[DELETE ERROR]', error.message);
    
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

module.exports = router;