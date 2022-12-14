const passport = require("passport");
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URI,
} = require("../config/config");
const User = require("../models/user");

var GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URI,
    },
    (accessToken, refreshToken, profile, next) => {
      User.findOne({ email: profile._json.email }).then((user) => {
        if (user) {
          // user already exists
          next(null, user);
        } else {
          User.create({
            name: profile.displayName,
            googleId: profile.id,
            email: profile._json.email,
          })
            .then((user) => {
              // new user
              next(null, user);
            })
            .catch((err) => {
              console.log(err);
              next(err, null);
            });
        }
      });
    }
  )
);
