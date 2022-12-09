const { default: axios } = require("axios");
const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI,
} = require("../config/config");

exports.getAccessTokenResponse = async (code) => {
  try {
    let data = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: DISCORD_REDIRECT_URI,
    });

    let config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Encoding": "gzip,deflate,compress",
      },
    };

    let axios_resp = await axios.post(
      "https://discord.com/api/v10/oauth2/token",
      data,
      config
    );

    return axios_resp.data;
  } catch (error) {
    throw error;
  }
};

exports.getUserDetails = async (accessToken) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Accept-Encoding": "gzip,deflate,compress",
      },
    };
    let axios_resp = await axios.get(
      "https://discord.com/api/users/@me",
      config
    );
    return axios_resp.data;
  } catch (error) {
    throw error;
  }
};

exports.refreshToken = async (refresh_token) => {
  try {
    let data = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    });

    let config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Encoding": "gzip,deflate,compress",
      },
    };

    let axios_resp = await axios.post(
      "https://discord.com/api/v10/oauth2/token",
      data,
      config
    );

    return axios_resp.data;
  } catch (error) {
    throw error;
  }
};
