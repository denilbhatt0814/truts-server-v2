const { COOKIE_TIME } = require("../config/config");

const cookieToken = (user, res) => {
  const token = user.getJWTToken();

  const options = {
    // 3 days
    expiresIn: new Date(Date.now()) + COOKIE_TIME * 24 * 60 * 60 * 1000,
    httpOnly: true,
  };

  user.password = undefined;

  res.status(200).cookie("token", token, options).json({
    success: true,
    token,
    user,
  });
};

module.exports = cookieToken;
