
// database.js - MongoDB Connection & Operations

const { MongoClient } = require('mongodb');

/*
 *DATABASE STATE
*/

let client = null;
let products_collection = null;

/**
 * Initialize MongoDB connection
 */
const connectDB = async (mongoURI) => {
  try {
    client = new MongoClient(mongoURI);
    await client.connect();
    
    const db = client.db('shivashakti_db');
    products_collection = db.collection('products');
    
    console.log('✅ Connected to MongoDB');
    return products_collection;
    
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    throw error;
  }
};

/**
 * Get all products (with optional category filter)
 */
const getProducts = async (category = null) => {
  try {
    if (!products_collection) {
      throw new Error('Database not connected');
    }

    const query = category
      ? { category: { $regex: new RegExp(`^${category.trim()}$`, 'i') } }
      : {};

    const docs = await products_collection.find(query).toArray();
    console.log(`[DB] Products fetched: "${category || 'all'}" → ${docs.length} results`);

    // Convert ObjectId to string
    docs.forEach(d => {
      d._id = d._id.toString();
    });

    return docs;

  } catch (error) {
    console.error('[DB ERROR]', error.message);
    throw error;
  }
};

/**
 * Add a new product
 */
const addProduct = async (productData) => {
  try {
    if (!products_collection) {
      throw new Error('Database not connected');
    }

    const { name, price, image_url, category } = productData;

    if (!name || !price || !image_url || !category) {
      throw new Error('Missing required fields');
    }

    const product = {
      name,
      price: Number(price),
      image_url,
      category: category.trim(),
      createdAt: new Date()
    };

    const result = await products_collection.insertOne(product);
    product._id = result.insertedId.toString();

    console.log(`[DB] Product added: ${name}`);
    return product;

  } catch (error) {
    console.error('[DB ERROR]', error.message);
    throw error;
  }
};

/**
 * Delete a product by name
 */
const deleteProduct = async (name) => {
  try {
    if (!products_collection) {
      throw new Error('Database not connected');
    }

    if (!name) {
      throw new Error('Product name required');
    }

    const result = await products_collection.deleteOne({ name });

    if (result.deletedCount === 0) {
      throw new Error('Product not found');
    }

    console.log(`[DB] Product deleted: ${name}`);
    return { success: true, message: 'Product deleted' };

  } catch (error) {
    console.error('[DB ERROR]', error.message);
    throw error;
  }
};

/**
 * Check if database is connected
 */
const isConnected = () => {
  return products_collection !== null;
};

// EXPORTS
module.exports = {
  connectDB,
  getProducts,
  addProduct,
  deleteProduct,
  isConnected
};