const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const https = require('https');
require('dotenv').config();

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nureen2026#z';
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();

let isDbConnected = false;

if (!MONGO_URI) {
    console.error('CRITICAL: MONGO_URI environment variable is missing!');
} else {
    mongoose.connect(MONGO_URI)
        .then(() => {
            isDbConnected = true;
            console.log('Connected to MongoDB Atlas successfully');
        })
        .catch(err => {
            isDbConnected = false;
            console.error('MongoDB connection error:', err.message);
        });
}

mongoose.connection.on('disconnected', () => {
    isDbConnected = false;
});

mongoose.connection.on('connected', () => {
    isDbConnected = true;
});

function sendTelegramRequest(payloadObj, callback) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        if (callback) callback(new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing'));
        return;
    }

    const postData = JSON.stringify(payloadObj);

    const req = https.request({
        hostname: 'api.telegram.org',
        path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
            if (res.statusCode >= 400) {
                console.error('Telegram API error:', res.statusCode, body);
                if (callback) callback(new Error(body));
            } else {
                if (callback) callback(null, body);
            }
        });
    });

    req.on('error', (err) => {
        console.error('Telegram alert network error:', err.message);
        if (callback) callback(err);
    });

    req.write(postData);
    req.end();
}

function sendTelegramOrderAlert(order) {
    const itemsList = Array.isArray(order.items) ? order.items : [];
    const itemsText = itemsList.length
        ? itemsList.map((item, idx) => {
            const qty = Number(item.qty || 1);
            const unitPrice = Number(item.offerPrice ?? item.price ?? 0);
            const lineTotal = unitPrice * qty;
            const qtyLabel = item.displayQty || `${qty} pc`;
            return `${idx + 1}. ${item.name || 'Item'} (${qtyLabel}) - ৳${lineTotal}`;
        }).join('\n')
        : 'N/A';

    const sourceLabel = order.source === 'landing_page' ? 'Landing Page Order' : 'Website Cart Order';

    const message = [
        '🛍️ নতুন অর্ডার এসেছে! (Nureen)',
        `📌 সোর্স: ${sourceLabel}`,
        `🆔 অর্ডার ID: ${order.id || 'N/A'}`,
        `👤 নাম: ${order.name || 'N/A'}`,
        `📞 ফোন: ${order.phone || 'N/A'}`,
        `📍 ঠিকানা: ${order.address || 'N/A'}`,
        '',
        '📦 প্রোডাক্ট তালিকা:',
        itemsText,
        '',
        `💰 সর্বমোট বিল: ৳${order.total || 0}`,
        `🕒 সময়: ${order.date || new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}`
    ].join('\n');

    sendTelegramRequest({
        chat_id: TELEGRAM_CHAT_ID,
        text: message
    });
}

const ProductSchema = new mongoose.Schema({
    id: String,
    name: String,
    category: String,
    price: Number,
    offerPrice: Number,
    unitQty: { type: Number, default: 1 },
    unitLabel: { type: String, default: 'pc' },
    details: { type: String, default: '' },
    featured: { type: Boolean, default: false },
    image: String
}, { strict: false });

const CategorySchema = new mongoose.Schema({
    name: String
}, { strict: false });

const OrderSchema = new mongoose.Schema({
    id: String,
    source: String,
    date: String,
    name: String,
    phone: String,
    address: String,
    items: Array,
    total: Number
}, { strict: false });

const SettingSchema = new mongoose.Schema({
    heroTitle: String,
    heroSubtitle: String,
    shopTitle: String,
    shopDesc: String,
    fbLink: String,
    instaLink: String,
    logo: String,
    logoWidth: Number,
    logoHeight: Number,
    phoneNumber: String,
    whatsappNumber: String,
    heroImage: String,
    landingPages: { type: Array, default: [] }
}, { strict: false });

const Product = mongoose.model('Product', ProductSchema);
const Category = mongoose.model('Category', CategorySchema);
const Order = mongoose.model('Order', OrderSchema);
const Setting = mongoose.model('Setting', SettingSchema);

app.get('/api/health', (req, res) => {
    res.json({
        ok: true,
        dbConnected: isDbConnected,
        telegramConfigured: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)
    });
});

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (password && password === ADMIN_PASSWORD) {
        return res.json({ success: true });
    }
    return res.status(401).json({ success: false, error: 'Incorrect password' });
});

app.get('/api/data', async (req, res) => {
    try {
        let settings = await Setting.findOne().lean();
        if (!settings) {
            settings = await Setting.create({
                heroTitle: 'Crafted Ceramics for Timeless Homes',
                heroSubtitle: 'Explore handcrafted tableware, porcelain dinner sets, glass dish collections, and exquisite home decor items designed for modern living in Bangladesh.',
                shopTitle: 'Our Collection',
                shopDesc: 'Browse premium tableware and home decor pieces by category.',
                fbLink: '',
                instaLink: '',
                logo: '',
                logoWidth: 175,
                logoHeight: 50,
                phoneNumber: '01700000000',
                whatsappNumber: '8801700000000',
                heroImage: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=1600&q=80',
                landingPages: []
            });
        }

        let categories = await Category.find().lean();
        if (categories.length === 0) {
            await Category.insertMany([
                { name: 'Plates' },
                { name: 'Mugs' },
                { name: 'Bowls' },
                { name: 'Decor Items' }
            ]);
            categories = await Category.find().lean();
        }

        const products = await Product.find().lean();
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
        const orderPayload = {
            id: req.body?.id || ('ord_' + Date.now()),
            source: req.body?.source || 'website_cart',
            date: req.body?.date || new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' }),
            name: req.body?.name || '',
            phone: req.body?.phone || '',
            address: req.body?.address || '',
            items: Array.isArray(req.body?.items) ? req.body.items : [],
            total: Number(req.body?.total || 0)
        };

        const newOrder = await Order.create(orderPayload);
        sendTelegramOrderAlert(orderPayload);
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

app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));