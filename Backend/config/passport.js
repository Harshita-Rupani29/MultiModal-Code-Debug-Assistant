const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const User = require('../models/user'); 

module.exports = function(passport) {

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });

    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/users/auth/google/callback' 
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ google_id: profile.id });

            if (user) {
                return done(null, user); 
            } else {
                user = await User.findOne({ email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null });
                if (user) {
                    
                    await User.updateGoogleId(user.id, profile.id); 
                    user.google_id = profile.id;
                    return done(null, user);
                }

                const newUser = await User.create({
                    firstName: profile.name.givenName || '',
                    lastName: profile.name.familyName || '',
                    email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
                    password: null,
                    mobileNumber: '', 
                    verificationStatus: true,
                    googleId: profile.id,
                });
                return done(null, newUser);
            }
        } catch (err) {
            console.error("Google OAuth error:", err);
            return done(err, null);
        }
    }));

};