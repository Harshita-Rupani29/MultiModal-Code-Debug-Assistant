const express = require("express");
const router = express.Router();
const passport = require("passport");

const checkAuth = require("../middlewares/check-auth");
const HttpError = require("../models/http-error"); 
const User = require("../models/user");


const {
    signup,
    login,
    verifingUser,
    handleGoogleCallback,
} = require("../controllers/user");

// Public routes
router.post("/signup", signup);
router.get("/verify/:id/:token", verifingUser);
router.post("/login", login);

// OAuth Routes
// Google Auth
router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);
router.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: false }),
    handleGoogleCallback
);


router.use(checkAuth);

router.get('/me', async (req, res, next) => {
    try {
        const user = await User.findById(req.userData.userId);
        if (!user) {
            return next(new HttpError('User not found.', 404));
        }
        res.json({ user: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            mobileNumber: user.mobile_number,
            verificationStatus: user.verification_status,
        } });
    } catch (err) {
        console.error(err);
        return next(new HttpError('Failed to fetch user profile.', 500));
    }
});


module.exports = router;