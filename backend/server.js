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

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware:
app.use(cors({
    origin: [
        'http://127.0.0.1:5173',
        'http://localhost:5173'
    ], // this is the root of our frontend
    credentials: true
}))

app.use(express.json()) // handling json data

app.use('/products', productsRoutes);
app.use('/orders', requireAuth, orderRoutes);
app.use('/cart', requireAuth, cartRoutes);
app.use('/admin', requireAuth, requireAdmin, adminRoutes);

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});