// dependencies
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import homePageRoutes from './routes/homePageRoutes.js'
import orderRoutes from './routes/orderRoutes.js';
import { requireAuth } from './middleware/requireAuth.js';

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

app.use('/products', homePageRoutes);
app.use('/orders', requireAuth, orderRoutes);

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});