// routes/debug-routes.js
const express = require('express');
const router = express.Router();

const checkAuth = require('../middlewares/check-auth');
const upload = require('../middlewares/file-upload'); 

const {
    analyzeDebugRequest,
    getDebugSessions,
    getDebugSessionDetails
} = require('../controllers/debugController');

// All debug routes will be protected and require authentication
router.use(checkAuth);

router.post('/analyze', upload.single('screenshot'), analyzeDebugRequest);

// Routes for fetching debug history
router.get('/sessions', getDebugSessions);
router.get('/sessions/:sessionId', getDebugSessionDetails);

module.exports = router;