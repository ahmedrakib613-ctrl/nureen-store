const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json({ limit: '15mb' }));
app.use(cors());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nureen_db';
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully'))
    .catch(err => console.log('DB Error:', err));

// Database Schemas
const SettingSchema = new mongoose.Schema({}, { strict: false });
const ProductSchema = new mongoose.Schema({}, { strict: false });
const OrderSchema = new mongoose.Schema({}, { strict: false });
const CategorySchema = new mongoose.Schema({ name: String });

const Setting = mongoose.model('Setting', SettingSchema);
const Product = mongoose.model('Product', ProductSchema);
const Order = mongoose.model('Order', OrderSchema);
const Category = mongoose.model('Category', CategorySchema);

// --- ADMIN AUTH ROUTE (Reads Render Environment ADMIN_PASSWORD) ---
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    const envPass = process.env.ADMIN_PASSWORD || 'nureen2026#z';
    if (password && String(password).trim() === String(envPass).trim()) {
        return res.json({ success: true });
    }
    return res.status(401).json({ success: false, message: 'Incorrect password' });
});

// --- API ENDPOINTS ---

app.get('/api/data', async (req, res) => {
    try {
        let settings = await Setting.findOne().lean();
        if (!settings) {
            const created = await Setting.create({
                heroTitle: 'Crafted Ceramics for Timeless Homes',
                heroSubtitle: 'Explore handcrafted tableware, porcelain dinner sets, glass dish collections...',
                shopTitle: 'Our Collection',
                shopDesc: 'Browse premium tableware and home decor pieces by category.',
                fbLink: '',
                instaLink: '',
                logo: '',
                heroImage: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1600&q=80'
            });
            settings = created.toObject();
        }

        let categories = await Category.find().lean();
        if (categories.length === 0) {
            const defaultCats = ['Plates', 'Mugs', 'Bowls', 'Decor Items'];
            for (let c of defaultCats) {
                await Category.create({ name: c });
            }
            categories = await Category.find().lean();
        }

        let products = await Product.find().lean();
        if (products.length === 0) {
            products = await Product.insertMany([
                { name: 'Royal Emerald Gold Rimmed Dinner Plate Set', category: 'Plates', price: 850, unitQty: 6, unitLabel: 'pcs', featured: true, image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=600&q=80' },
                { name: 'Handcrafted Ceramic Coffee Mug', category: 'Mugs', price: 350, unitQty: 1, unitLabel: 'pc', featured: true, image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80' }
            ]);
        }

        const orders = await Order.find().sort({ _id: -1 }).lean();

        res.json({
            settings,
            categories: categories.map(c => c.name),
            products,
            orders
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        await Setting.findOneAndUpdate({}, { $set: req.body }, { upsert: true, new: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    try {
        const body = req.body || {};
        const { id, _id, ...rest } = body;
        if (id) {
            await Product.findOneAndUpdate({ id }, { $set: { id, ...rest } }, { upsert: true, new: true });
        } else {
            await Product.create({ id: 'p_' + Date.now(), ...rest });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        const paramId = req.params.id;
        if (mongoose.Types.ObjectId.isValid(paramId)) {
            await Product.findByIdAndDelete(paramId);
        }
        await Product.deleteOne({ id: paramId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', async (req, res) => {
    try {
        const { name } = req.body;
        const exists = await Category.findOne({ name });
        if (!exists) {
            await Category.create({ name });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/categories/:name', async (req, res) => {
    try {
        await Category.deleteOne({ name: req.params.name });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = await Order.create(req.body);
        res.json({ success: true, order: newOrder });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        await Order.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));