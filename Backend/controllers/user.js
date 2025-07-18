const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const User = require("../models/user"); 
const Token = require("../models/token"); 
const { loginValidator, signupValidator } = require("../validator/userValidator");

const generateToken = (userId, email) => {
    return jwt.sign(
        { userId: userId, email: email },
        process.env.JWT_KEY,
        { expiresIn: "6h" }
    );
};

const signup = async (req, res, next) => {
    console.log("Incoming data:", req.body);
    const {
        firstName,
        lastName,
        email,
        password,
        confirmPassword,
        mobileNumber,
    } = req.body;

    if (password !== confirmPassword) {
        return next(new HttpError("Password mismatch."));
    }

    const { error } = signupValidator(req.body);
    if (error) {
        console.log("Joi validation error:", error.details[0].message);
        return next(new HttpError(error.details[0].message, 422));
    }

    try {
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            const error = new HttpError(
                "Could not create user, email already exists.",
                409
            );
            return next(error);
        }

        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash(password, 12);
        } catch (err) {
            const error = new HttpError(
                "Could not hash password, please try again.",
                500
            );
            return next(error);
        }

        const newUser = await User.create({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            mobileNumber,
            verificationStatus: false,
            googleId: null,
            profilePicture: null
        });

        const tokenValue = crypto.randomBytes(32).toString("hex");
        await Token.create({
            userId: newUser.id,
            token: tokenValue,
        });

        res.status(201).json({
            id: newUser.id,
            message: "New User created successfully. Verification email sent (simulated).", 
        });
    } catch (err) {
        console.error("Signup error:", err);
        const error = new HttpError("Could not create user, please try again.", 500);
        return next(error);
    }
};

const verifingUser = async (req, res, next) => {
    const userId = req.params.id;
    const tokenValue = req.params.token;

    let user;
    try {
        user = await User.findById(userId);
    } catch (err) {
        const error = new HttpError("Error finding user.", 500);
        return next(error);
    }

    if (!user) {
        const error = new HttpError("Invalid link or user not found.", 400);
        return next(error);
    }

    let token;
    try {
        token = await Token.findOne({ userId: user.id, token: tokenValue }); 
    } catch (err) {
        const error = new HttpError("Error finding token.", 500);
        return next(error);
    }

    if (!token) {
        const error = new HttpError("Invalid link or token not found.", 400);
        return next(error);
    }

    try {
        await User.updateVerificationStatus(user.id, true); 
    } catch (err) {
        const error = new HttpError("Error updating user, verification failed.", 500);
        return next(error);
    }

    try {
        await Token.findOneAndDelete({ id: token.id }); 
    } catch (err) {
        console.log("Error deleting token:", err); 
    }

    res.json({ user: user, message: "User verified successfully." });
};

const login = async (req, res, next) => {
    console.log(req.body);
    const { error } = loginValidator(req.body);
    if (error) {
        return next(new HttpError(error.details[0].message, 422));
    }

    const { email, password } = req.body;

    let existingUser;
    try {
        existingUser = await User.findOne({ email: email }); 
    } catch (err) {
        const error = new HttpError("Login failed, please try again.", 500);
        return next(error);
    }

    if (!existingUser || !existingUser.password) { 
        const error = new HttpError("Invalid credentials!", 403);
        return next(error);
    }

    let isValidPassword = false;
    try {
        isValidPassword = await bcrypt.compare(password, existingUser.password);
    } catch (err) {
        const error = new HttpError("Login failed, please try again!", 500);
        return next(error);
    }

    if (!isValidPassword) {
        const error = new HttpError(
            "Invalid credentials, could not log you in.",
            401
        );
        return next(error);
    }

    const token = generateToken(existingUser.id, existingUser.email);

    res.status(200).json({ 
        userId: existingUser.id,
        email: existingUser.email,
        isVerified: existingUser.verification_status, 
        token: token,
    });
};

const handleOAuthCallback = (provider) => (req, res) => {
    
    if (!req.user) {
        return res.redirect('/login'); 
    }

    // Generate JWT for the OAuth user
    const token = generateToken(req.user.id, req.user.email);

    // Redirect or send JSON based on your frontend needs.
    // For a React SPA, you'll likely want to redirect with the token
    // so the frontend can store it and navigate.
    // Example: res.redirect(`http://localhost:3000/auth_success?token=${token}&userId=${req.user.id}&email=${req.user.email}`);
    res.json({
        userId: req.user.id,
        email: req.user.email,
        isVerified: req.user.verification_status,
        token: token,
        message: `Logged in with ${provider} successfully!`
    });
};


module.exports = {
    signup,
    login,
    verifingUser,
    handleGoogleCallback: handleOAuthCallback('Google'),
};