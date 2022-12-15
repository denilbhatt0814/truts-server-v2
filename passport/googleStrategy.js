const passport = require("passport");
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URI,
} = require("../config/config");

var GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URI,
    },
    (accessToken, refreshToken, profile, next) => {
      /**
       * NOTE: This is a JUGAAD
       * the profile object is kept in place of Express.User in next()
       * usually it is user object (from DB) over there
       * but I had to modify the flow to accomodate all
       * Login | Sign-up | Connect Google in one route
       */
      next(null, profile);
    }
  )
);
