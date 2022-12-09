module.exports = {
  PORT: process.env.PORT || 3000,
  COOKIE_TIME: process.env.COOKIE_TIME || 3,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "782120524956434432",
  DISCORD_CLIENT_SECRET:
    process.env.DISCORD_CLIENT_SECRET || "BfhRr1UABOUmGH9TzbB97mzysQVXUxJ6",
  DISCORD_REDIRECT_URI:
    process.env.DISCORD_REDIRECT_URI ||
    "http://localhost:3000/api/v1/user/login/discord",
};
