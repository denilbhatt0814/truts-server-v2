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
    let axios_resp_profile = await axios.get(
      "https://discord.com/api/users/@me",
      config
    );

    let guilds;
    try {
      let axios_resp_guilds = await axios.get(
        "https://discord.com/api/users/@me/guilds",
        config
      );
      guilds = axios_resp_guilds.data.map(function (guild) {
        return {
          id: guild.id,
          name: guild.name,
          owner: guild.owner,
          permissions: guild.permissions,
        };
      });
      console.log(guilds);
    } catch (error) {
      console.error(
        "DiscordError: unable to get guilds of user\nSuggestion: may be guilds wasn't included in scope"
      );
    }

    return { ...axios_resp_profile.data, guilds };
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

exports.getUserGuilds = async (accessToken) => {
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Accept-Encoding": "gzip,deflate,compress",
      },
    };

    let guilds;
    let axios_resp_guilds = await axios.get(
      "https://discord.com/api/users/@me/guilds",
      config
    );
    guilds = axios_resp_guilds.data.map(function (guild) {
      return {
        id: guild.id,
        name: guild.name,
        owner: guild.owner,
        permissions: guild.permissions,
      };
    });
    console.log(guilds);

    return guilds;
  } catch (error) {
    console.error(
      "DiscordError: unable to get guilds of user\nSuggestion: may be guilds wasn't included in scope"
    );
    throw error;
  }
};
