const mongoose = require('mongoose');
const Product = require('../models/Product');
const {
  getFallbackProducts,
  getFallbackProductById,
  saveFallbackProduct,
  deleteFallbackProduct,
} = require('../utils/fallbackStore');

// @desc    Get all products with search, category filter, sorting
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const { category, search, minPrice, maxPrice, sort, featured } = req.query;
      let query = {};

      if (category && category !== 'All') {
        query.category = category;
      }

      if (featured === 'true') {
        query.isFeatured = true;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
        ];
      }

      if (minPrice || maxPrice) {
        query.price = {};
        if (minPrice) query.price.$gte = Number(minPrice);
        if (maxPrice) query.price.$lte = Number(maxPrice);
      }

      let sortOption = { createdAt: -1 };
      if (sort === 'price-asc') sortOption = { price: 1 };
      if (sort === 'price-desc') sortOption = { price: -1 };
      if (sort === 'rating') sortOption = { rating: -1 };

      const products = await Product.find(query).sort(sortOption);
      if (products && products.length > 0) {
        return res.json(products);
      }
    }
  } catch (error) {
    console.warn('MongoDB getProducts warning, using fallback catalog:', error.message);
  }

  // Zero-downtime fallback for Render / offline DB
  return res.json(getFallbackProducts(req.query));
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1 && mongoose.Types.ObjectId.isValid(req.params.id)) {
      const product = await Product.findById(req.params.id);
      if (product) {
        return res.json(product);
      }
    }
  } catch (error) {
    console.warn('MongoDB getProductById warning:', error.message);
  }

  const fallback = getFallbackProductById(req.params.id);
  if (fallback) {
    return res.json(fallback);
  }
  return res.status(404).json({ message: 'Product not found' });
};

// @desc    Create a new product (admin or seller)
// @route   POST /api/products
// @access  Private/Admin or Seller
const createProduct = async (req, res) => {
  try {
    const productData = {
      ...req.body,
      seller: req.user ? req.user._id : null,
      sellerShopName: req.user?.shopName || req.user?.name || 'AeroSport Official',
    };
    const product = new Product(productData);
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get products created by logged in seller
// @route   GET /api/products/seller/my-products
// @access  Private/Seller
const getMyProducts = async (req, res) => {
  try {
    let query = {};
    if (req.user && req.user.role !== 'admin') {
      query.seller = req.user._id;
    }
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Seller or Admin
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (req.user.role !== 'admin' && String(product.seller) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update product details (name, description, price, stock, category, etc.)
// @route   PUT /api/products/:id
// @access  Private/Seller or Admin
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (req.user.role !== 'admin' && String(product.seller) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to edit this product' });
    }

    if (req.body.name) product.name = req.body.name.trim();
    if (req.body.description !== undefined) product.description = req.body.description.trim();
    if (req.body.price !== undefined) product.price = Number(req.body.price);
    if (req.body.originalPrice !== undefined) product.originalPrice = Number(req.body.originalPrice);
    if (req.body.stock !== undefined) product.stock = Number(req.body.stock);
    if (req.body.category) product.category = req.body.category;
    if (req.body.brand) product.brand = req.body.brand.trim();
    if (req.body.image) product.image = req.body.image.trim();
    if (req.body.badge !== undefined) product.badge = req.body.badge;
    if (req.body.features && Array.isArray(req.body.features)) product.features = req.body.features;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  getMyProducts,
  updateProduct,
  deleteProduct,
};
