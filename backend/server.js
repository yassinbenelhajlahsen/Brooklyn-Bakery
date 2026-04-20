// dependencies
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import 'dotenv/config';

import homePageRoutes from './routes/homePageRoutes.js'

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

app.use(session({
    secret: process.env.SESSION_SECRET, // crypotgraphic reasons:                                                                   https://expressjs.com/en/resources/middleware/session.html#:~:text=0%2E3%2E0-,secret
    resave: false, // saves user input regardless of whether there was any or not:                                                  https://expressjs.com/en/resources/middleware/session.html#:~:text=resave,-Forces
    saveUninitialized: false, //                                                                                                    https://expressjs.com/en/resources/middleware/session.html#:~:text=saveUninitialized,-Forces
    cookie: { //                                                                                                                    https://expressjs.com/en/resources/middleware/session.html#:~:text=req%2Esession%2Ecookie,-Each
        secure: false, // we do not have an https conntection                                                                       https://expressjs.com/en/resources/middleware/session.html#:~:text=cookie%2Esecure
        sameSite: 'lax' // permitting it for "safe" top-level navigations (like GET links) that change the URL in the address bar.  https://expressjs.com/en/resources/middleware/session.html#:~:text=cookie%2EsameSite
    }
}))

app.use('/products', homePageRoutes);

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});