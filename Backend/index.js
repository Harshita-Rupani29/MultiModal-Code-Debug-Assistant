// index.js (previously app.js)
require('dotenv').config();
const express = require('express');
const http = require('http'); 
const app = express();
const HttpError = require('./models/http-error');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
require('./config/passport')(passport);

const pool = require('./config/db');
const { setupSocket } = require('./setUpSocket'); 

// Create HTTP server from Express app
const server = http.createServer(app);

setupSocket(server);
console.log('Socket.IO setup initiated.'); 

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
const userRoutes = require("./routes/user-route");
const debugRoutes = require("./routes/debug-routes");
app.use("/api/users", userRoutes);
app.use("/api/debug", debugRoutes);

// Test database connection on startup
async function testDbConnection() {
    try {
        await pool.query('SELECT 1');
        console.log('Database connection successfully established on startup!');
    } catch (err) {
        console.error('Failed to establish database connection on startup:', err.message);
        // Exit process if DB connection fails critical for application to run
        process.exit(1);
    }
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await testDbConnection(); 
});

app.use((req, res, next) => {
    const error = new HttpError("Could not find this route.", 404);
    throw error;
});

app.use((error, req, res, next) => {
    if (res.headerSent) {
        return next(error);
    }
    res.status(error.code || 500);
    res.json({ message: error.message || "An unknown error occurred!" });
});