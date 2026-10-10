// High-availability fallback store for zero-downtime deployments
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const usersById = new Map();
const usersByEmail = new Map();

// Helper to register in-memory user with valid ObjectId format
const saveUser = (userData) => {
  let id = userData._id ? String(userData._id) : '';
  if (!id || (!mongoose.Types.ObjectId.isValid(id) && !id.startsWith('seed_'))) {
    id = new mongoose.Types.ObjectId().toString();
  }
  const cleanEmail = userData.email.toLowerCase().trim();
  const userObj = {
    _id: id,
    name: userData.name || 'Athlete',
    username: userData.username || cleanEmail.split('@')[0],
    email: cleanEmail,
    password: userData.password,
    plainPassword: userData.plainPassword || userData.password,
    role: userData.role || 'user',
    isSeller: !!userData.isSeller,
    shopName: userData.shopName || '',
    shopDescription: userData.shopDescription || '',
    phone: userData.phone || '',
    region: userData.region || 'Toshkent shahri',
    district: userData.district || 'Chilonzor tumani',
    bio: userData.bio || 'Sports & fitness enthusiast',
    fitnessGoal: userData.fitnessGoal || 'General Fitness',
    favoriteSports: userData.favoriteSports || ['Running', 'Gym'],
    height: userData.height || 175,
    weight: userData.weight || 70,
    avatar: userData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    isChatBanned: false,
    chatBanReason: '',
    createdAt: new Date().toISOString(),
    matchPassword: async function (enteredPassword) {
      if (this.plainPassword && this.plainPassword === enteredPassword) return true;
      try {
        return await bcrypt.compare(enteredPassword, this.password);
      } catch (e) {
        return false;
      }
    },
  };
  usersById.set(id, userObj);
  usersByEmail.set(cleanEmail, userObj);
  return userObj;
};

// Seed essential demo accounts with valid 24-hex ObjectIds
const alexId = '6aca4cd299ba20eaee8be401';
const alexUser = saveUser({
  _id: alexId,
  name: 'Alex Johnson',
  username: 'alex_athlete',
  email: 'alex@example.com',
  password: 'password123',
  plainPassword: 'password123',
  role: 'user',
  bio: 'Marathon enthusiast and weekend football player.',
});
usersById.set('seed_alex_001', alexUser);

const adminId = '6aca4cd299ba20eaee8be402';
const adminUser = saveUser({
  _id: adminId,
  name: 'Admin Profile',
  username: 'admin',
  email: 'admin@gmail.com',
  password: 'admin12345',
  plainPassword: 'admin12345',
  role: 'admin',
  bio: 'Bosh administrator',
});
usersById.set('seed_admin_001', adminUser);

const sellerId = '6aca4cd299ba20eaee8be403';
const sellerUser = saveUser({
  _id: sellerId,
  name: 'Sardor Rahimiy',
  username: 'pro_sports_shop',
  email: 'seller1@example.com',
  password: 'password123',
  plainPassword: 'password123',
  role: 'seller',
  isSeller: true,
  shopName: 'ProSports Tashkent',
  bio: 'Official athletic gear retailer.',
});
usersById.set('seed_seller_001', sellerUser);

// Fallback collections
const seedData = require('../seed/seedData');

const makeId = (prefixHex, index) => {
  const pad = String(index).padStart(4, '0');
  return `${prefixHex}${pad}`;
};

// Initialize products
const fallbackProducts = (seedData.products || []).map((p, i) => {
  const id = p._id ? String(p._id) : makeId('6aca4cd299ba20eaee8b', 1000 + i);
  return {
    ...p,
    _id: id,
    id: id,
    createdAt: new Date().toISOString(),
    seller: sellerId,
    sellerShopName: 'AeroSport Official',
  };
});

const getFallbackProducts = (queryParams = {}) => {
  let list = [...fallbackProducts];
  const { category, search, minPrice, maxPrice, sort, featured } = queryParams;

  if (category && category !== 'All') {
    list = list.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
  }
  if (featured === 'true') {
    list = list.filter(p => !!p.isFeatured);
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(p =>
      (p.name && p.name.toLowerCase().includes(s)) ||
      (p.description && p.description.toLowerCase().includes(s)) ||
      (p.brand && p.brand.toLowerCase().includes(s))
    );
  }
  if (minPrice) {
    list = list.filter(p => p.price >= Number(minPrice));
  }
  if (maxPrice) {
    list = list.filter(p => p.price <= Number(maxPrice));
  }
  if (sort === 'price-asc') {
    list.sort((a, b) => a.price - b.price);
  } else if (sort === 'price-desc') {
    list.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
  return list;
};

const getFallbackProductById = (id) => {
  return fallbackProducts.find(p => String(p._id) === String(id) || String(p.id) === String(id)) || null;
};

const saveFallbackProduct = (productData) => {
  const id = productData._id ? String(productData._id) : new mongoose.Types.ObjectId().toString();
  const newProduct = {
    ...productData,
    _id: id,
    id: id,
    createdAt: new Date().toISOString(),
  };
  fallbackProducts.unshift(newProduct);
  return newProduct;
};

const deleteFallbackProduct = (id) => {
  const idx = fallbackProducts.findIndex(p => String(p._id) === String(id) || String(p.id) === String(id));
  if (idx !== -1) {
    fallbackProducts.splice(idx, 1);
    return true;
  }
  return false;
};

// Initialize events
const fallbackEvents = (seedData.events || []).map((e, i) => {
  const id = e._id ? String(e._id) : makeId('6aca4cd299ba20eaee8b', 2000 + i);
  return {
    ...e,
    _id: id,
    id: id,
    registeredUsers: [],
    createdAt: new Date().toISOString(),
  };
});

const getFallbackEvents = (queryParams = {}) => {
  let list = [...fallbackEvents];
  const { type, search, city, difficulty } = queryParams;
  if (type && type !== 'all') {
    list = list.filter(e => e.type && e.type.toLowerCase() === type.toLowerCase());
  }
  if (difficulty && difficulty !== 'all') {
    list = list.filter(e => e.difficulty && e.difficulty.toLowerCase() === difficulty.toLowerCase());
  }
  if (city) {
    list = list.filter(e => e.city && e.city.toLowerCase().includes(city.toLowerCase()));
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(e =>
      (e.title && e.title.toLowerCase().includes(s)) ||
      (e.location && e.location.toLowerCase().includes(s)) ||
      (e.description && e.description.toLowerCase().includes(s))
    );
  }
  return list;
};

const getFallbackEventById = (id) => {
  return fallbackEvents.find(e => String(e._id) === String(id) || String(e.id) === String(id)) || null;
};

// Initialize facilities
const fallbackFacilities = (seedData.facilities || []).map((f, i) => {
  const id = f._id ? String(f._id) : makeId('6aca4cd299ba20eaee8b', 3000 + i);
  return {
    ...f,
    _id: id,
    id: id,
    createdAt: new Date().toISOString(),
  };
});

const getFallbackFacilities = (queryParams = {}) => {
  let list = [...fallbackFacilities];
  const { type, search, city } = queryParams;
  if (type && type !== 'all') {
    list = list.filter(f => f.type && f.type.toLowerCase() === type.toLowerCase());
  }
  if (city) {
    list = list.filter(f => f.city && f.city.toLowerCase().includes(city.toLowerCase()));
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(f =>
      (f.name && f.name.toLowerCase().includes(s)) ||
      (f.address && f.address.toLowerCase().includes(s)) ||
      (f.description && f.description.toLowerCase().includes(s))
    );
  }
  return list;
};

const getFallbackFacilityById = (id) => {
  return fallbackFacilities.find(f => String(f._id) === String(id) || String(f.id) === String(id)) || null;
};

// Initialize trainers
const fallbackTrainers = (seedData.trainers || []).map((t, i) => {
  const id = t._id ? String(t._id) : makeId('6aca4cd299ba20eaee8b', 4000 + i);
  return {
    ...t,
    _id: id,
    id: id,
    createdAt: new Date().toISOString(),
  };
});

const getFallbackTrainers = (queryParams = {}) => {
  let list = [...fallbackTrainers];
  const { sport, search, specialization } = queryParams;
  if (sport && sport !== 'all') {
    list = list.filter(t => t.sports && t.sports.some(s => s.toLowerCase().includes(sport.toLowerCase())));
  }
  if (specialization && specialization !== 'all') {
    list = list.filter(t => t.specialization && t.specialization.toLowerCase().includes(specialization.toLowerCase()));
  }
  if (search) {
    const s = search.toLowerCase();
    list = list.filter(t =>
      (t.name && t.name.toLowerCase().includes(s)) ||
      (t.title && t.title.toLowerCase().includes(s)) ||
      (t.bio && t.bio.toLowerCase().includes(s)) ||
      (t.sports && t.sports.some(sp => sp.toLowerCase().includes(s)))
    );
  }
  return list;
};

const getFallbackTrainerById = (id) => {
  return fallbackTrainers.find(t => String(t._id) === String(id) || String(t.id) === String(id)) || null;
};

module.exports = {
  usersById,
  usersByEmail,
  saveUser,
  fallbackProducts,
  getFallbackProducts,
  getFallbackProductById,
  saveFallbackProduct,
  deleteFallbackProduct,
  fallbackEvents,
  getFallbackEvents,
  getFallbackEventById,
  fallbackFacilities,
  getFallbackFacilities,
  getFallbackFacilityById,
  fallbackTrainers,
  getFallbackTrainers,
  getFallbackTrainerById,
};
