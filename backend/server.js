// dependencies
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import productsRoutes from './routes/productsRoutes.js'
import orderRoutes from './routes/orderRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import { requireAuth } from './middleware/requireAuth.js';
import adminRoutes from './routes/adminRoutes.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import meRoutes from './routes/meRoutes.js';
import cookieUpgrades from './routes/cookieUpgrades.js';




const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'https://brooklyn-bakery.pages.dev',
    /^https:\/\/[a-z0-9-]+\.brooklyn-bakery\.pages\.dev$/,
    ...(process.env.NODE_ENV !== 'production' ? [
    ] : []),
];

app.use(cors({ origin: allowedOrigins }));

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}))

app.use(express.json()) // handling json data


app.use('/cookieUpgrades',  cookieUpgrades);
app.use('/products', productsRoutes);
app.use('/orders', requireAuth, orderRoutes);
app.use('/me', requireAuth, meRoutes);
app.use('/cart', requireAuth, cartRoutes);
app.use('/admin', requireAuth, requireAdmin, adminRoutes);

// 404 fallback for unmatched routes
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Global error handler. Controllers forward unexpected errors via next(err);
// known errors carry an .http status from lib/httpError.js.
app.use((err, req, res, _next) => {
    if (err.http) return res.status(err.http).json({ error: err.message });
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});