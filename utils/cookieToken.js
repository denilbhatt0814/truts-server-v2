const { COOKIE_TIME } = require("../config/config");

const cookieToken = (user, res) => {
  const token = user.getJWTToken();

  const options = {
    expires: new Date(Date.now() + COOKIE_TIME * 24 * 60 * 60 * 1000),
    domain: "truts.xyz",
    httpOnly: true,
  };

  res.status(200).cookie("token", token, options).json({
    success: true,
    message: "Login | Sign-up | Connect Social : Successful",
    error: null,
    data: {
      token,
      user,
    },
  });
};

module.exports = cookieToken;
