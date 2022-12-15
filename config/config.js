module.exports = {
  /* BASIC CONFIGS */
  PORT: process.env.PORT || 3000,

  /* DB CONFIGS */
  MONGO_URI:
    process.env.MONGO_URI ||
    "mongodb+srv://denilbhatt:itsMeDenil08@cluster0.x4u1j4r.mongodb.net/test?retryWrites=true&w=majority",

  /* AUTH CONFIGS */
  JWT_SECRET: process.env.JWT_SECRET || "thisismyjwtsecret",
  JWT_EXPIRY: "3d",
  COOKIE_TIME: process.env.COOKIE_TIME || 3,
  WALLET_NONCE_LENGTH: process.env.WALLET_NONCE_LENGTH || 12,
  /* GOOGLE OUTH CONFIGS */
  GOOGLE_CLIENT_ID:
    process.env.GOOGLE_CLIENT_ID ||
    "800331731915-6bit3f6t6uuknh8svo5n4hvtaa54sll5.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET:
    process.env.GOOGLE_CLIENT_SECRET || "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",
  GOOGLE_CALLBACK_URI:
    process.env.GOOGLE_CALLBACK_URI ||
    "http://localhost:3000/api/v1/login/google/callback",

  /* DISCORD CONFIGS */
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "782120524956434432",
  DISCORD_CLIENT_SECRET:
    process.env.DISCORD_CLIENT_SECRET || "BfhRr1UABOUmGH9TzbB97mzysQVXUxJ6",
  DISCORD_REDIRECT_URI:
    process.env.DISCORD_REDIRECT_URI ||
    "http://localhost:3000/api/v1/login/discord/callback",
  DISCORD_OAUTH_URL:
    process.env.DISCORD_OAUTH_URL ||
    `https://discord.com/oauth2/authorize?client_id=782120524956434432&redirect_uri=http://localhost:3000/api/v1/login/discord/callback&response_type=code&scope=identify%20email`,

  /* AWS CONFIGS */
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_REGION: process.env.AWS_REGION || "",
};
