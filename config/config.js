module.exports = {
  /* BASIC CONFIGS */
  PORT: process.env.PORT || 3000,

  /* DB CONFIGS */
  MONGO_URI:
    process.env.MONGO_URI ||
    "mongodb+srv://denilbhatt:WHplonw4Cqn3zU0x@cluster0.x4u1j4r.mongodb.net/test?retryWrites=true&w=majority",
  REDIS_HOST:
    process.env.REDIS_HOST ||
    "localhost" ||
    "redis-12627.c80.us-east-1-2.ec2.cloud.redislabs.com",
  REDIS_PORT: process.env.REDIS_PORT || 6379 || 12627,
  REDIS_PASSWORD: undefined,
  //   process.env.REDIS_PASSWORD || "Keh4dCrtEDmUfjpKTh6bkhw2hKCuGB4a",

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
    `https://discord.com/api/oauth2/authorize?client_id=782120524956434432&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Flogin%2Fdiscord%2Fcallback&response_type=code&scope=identify%20email%20guilds`,

  /* TWITTER CONFIGS */
  TWITTER_CLIENT_ID:
    process.env.TWITTER_CLIENT_ID || "cGExTzFlbmw5dGxWc2E3RDRQYVo6MTpjaQ",
  TWITTER_CLIENT_SECRET:
    process.env.TWITTER_CLIENT_SECRET ||
    "WqtjIWNzHzZr71veexa-4vyv4JYvaNILqF3OXTt9yp6Qw-jc63",
  TWITTER_REDIRECT_URI:
    process.env.TWITTER_REDIRECT_URI ||
    "https://2321-157-32-248-105.in.ngrok.io/api/v1/connect/twitter/callback",
  TWITTER_OAUTH_SCOPE:
    process.env.TWITTER_OAUTH_SCOPE ||
    "users.read tweet.read like.read offline.access follows.read",

  /* AWS CONFIGS */
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  AWS_REGION: process.env.AWS_REGION || "",

  /* ALCHEMY CONFIGS */
  ALCHEMY_API_KEY:
    process.env.ALCHEMY_API_KEY || "gFX2bqqEuU9H1Ph9nZ_j_5g6ZfwV9xue",
  HELIUS_API_KEY:
    process.env.HELIUS_API_KEY || "d5117e1d-6932-4b04-bc4e-62128c792fc2",
  COVALENT_API_KEY:
    process.env.HELIUS_API_KEY || "cqt_rQCBb64p8qfG9MQQjGrphJY3Jw9R",
  UD_MISSION_ID: process.env.UD_MISSION_ID || "645a472eac01844d7b41279d",
};
