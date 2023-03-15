const { default: axios } = require("axios");
const {
  TWITTER_CLIENT_ID,
  TWITTER_REDIRECT_URI,
  TWITTER_CLIENT_SECRET,
  TWITTER_OAUTH_SCOPE,
} = require("../config/config");

exports.authorizeTwitterURI = (state, scope = TWITTER_OAUTH_SCOPE) => {
  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", TWITTER_CLIENT_ID);
  url.searchParams.append("redirect_uri", TWITTER_REDIRECT_URI);
  url.searchParams.append("scope", scope);
  // We implement the PCKE extension for additional security.
  // Here, we're passing a randomly generate state parameter, along
  // with a code challenge. In this example, the code challenge is
  // a plain string, but s256 is also supported.
  url.searchParams.append("state", state);
  url.searchParams.append("code_challenge", "challenge");
  url.searchParams.append("code_challenge_method", "plain");
  return url;
};

exports.exchangeTwitterToken = async (
  code,
  callback = TWITTER_REDIRECT_URI
) => {
  try {
    const url = "https://api.twitter.com/2/oauth2/token";
    const data = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: callback,
      code: code,
      code_verifier: "challenge",
    });

    const config = {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Encoding": "gzip,deflate,compress",
        Authorization:
          "Basic " + btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`),
      },
    };

    const axios_resp = await axios.post(url, data, config);

    return axios_resp.data;
  } catch (error) {
    throw error;
  }
};

// TODO: needs work
exports.refreshTwitterToken = async (
  refresh_token,
  callback = TWITTER_REDIRECT_URI
) => {
  const url = "https://api.twitter.com/2/oauth2/token";
  const data = new URLSearchParams({
    client_id: TWITTER_CLIENT_ID,
    client_secret: TWITTER_CLIENT_SECRET,
    grant_type: "refresh_token",
    // redirect uri
    refresh_token: refresh_token,
  });
  // params.append("grant_type", "refresh_token");
  // params.append("client_id", TWITTER_CLIENT_ID);
  // params.append("redirect_uri", callback);
  // params.append("refresh_token", refresh_token);

  // const response = await fetch(url, { method: "POST", body: params });
  // const json = await response.json();
  const config = {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept-Encoding": "gzip,deflate,compress",
      Authorization:
        "Basic " + btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`),
    },
  };

  const axios_resp = await axios.post(url, data, config);
  return axios_resp.data;
};

// TODO: needs work
exports.revokeTwitterToken = async (token) => {
  const url = "https://api.twitter.com/2/oauth2/revoke";
  const params = new URLSearchParams();
  params.append("client_id", TWITTER_CLIENT_ID);
  params.append("token", token);
  params.append("token_type_hint", "access_token");

  const response = await fetch(url, { method: "POST", body: params });
  const json = await response.json();
  console.log(json);
  return json;
};

exports.getTwitterUserDetails = async (access_token) => {
  try {
    const url = "https://api.twitter.com/2/users/me";

    const config = {
      headers: {
        "Content-Type": "application/json",
        // "Accept-Encoding": "gzip,deflate,compress",
        Authorization: `Bearer ${access_token}`,
      },
    };
    const axios_resp_profile = await axios.get(url, config);
    const twitterUserId = axios_resp_profile.data.data.id;
    const followingList = await this.getTwitterUserFollowing(
      twitterUserId,
      access_token
    );
    // TODO: CAN CLUB 2 QUERIES W/ PROMISE.ALL OR USE THE SAME FUNC I.E BELOW
    // But that would need twitterUserID thus need to have 2 flows
    // use Promise.all if have twitterUserId else go in sequence
    return {
      ...axios_resp_profile.data.data,
      following: followingList,
    };
  } catch (error) {
    console.log("TwitterError: unable to fetch latest deatils of user");
    throw error;
  }
};

exports.getTwitterUserFollowing = async (twitterUserId, access_token) => {
  try {
    let url = `https://api.twitter.com/2/users/${twitterUserId}/following?max_results=1000`;
    // console.log({ access_token });
    const config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
    };

    let axios_resp = await axios.get(url, config);
    let followingList = axios_resp.data.data;
    let nextToken = axios_resp.data.meta.next_token;

    while (nextToken) {
      url = `https://api.twitter.com/2/users/${twitterUserId}/following?max_results=1000&pagination_token=${nextToken}`;
      axios_resp = await axios.get(url, config);
      followingList.push(...axios_resp.data.data);
      nextToken = axios_resp.data.meta.next_token;
    }

    console.log(followingList);
    return followingList;
  } catch (error) {
    console.log("TwitterError: unable to fetch following list of user");
    throw error;
  }
};

exports.checkUserHasRetweeted = async (
  twitterUserId,
  tweetID,
  access_token
) => {
  try {
    // NOTE: the API has limit of retrieving 100 users who have retweeted
    // at a time, if we don't find our user there, we'll have to query next pages
    // until we find if our user has retweeted. If not find till end then return false
    let url = `https://api.twitter.com/2/tweets/${tweetID}/retweeted_by?max_results=100`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
    };

    let axios_resp = await axios.get(url, config);
    let hasRetweeted = false;
    let retweetedByList = axios_resp.data.data;
    console.log(axios_resp.data);
    if (!retweetedByList) {
      return hasRetweeted;
    }
    let twitterUser = retweetedByList.find(
      (twitterAccount) => twitterAccount.id == twitterUserId
    );
    console.log({ twitterUser });
    if (twitterUser) {
      hasRetweeted = true;
    } else if (!twitterUser && !axios_resp.data.meta.next_token) {
      hasRetweeted = false;
    } else {
      let nextToken = axios_resp.data.meta.next_token;
      while (!twitterUser && nextToken) {
        url = `https://api.twitter.com/2/tweets/${tweetID}/retweeted_by?max_results=100&pagination_token=${nextToken}`;
        axios_resp = await axios.get(url, config);
        console.log(axios_resp.data);
        retweetedByList = axios_resp.data.data;
        if (!retweetedByList) {
          return hasRetweeted;
        }
        twitterUser = retweetedByList.find(
          (twitterAccount) => twitterAccount.id == twitterUserId
        );
        console.log({ twitterUser });
        hasRetweeted = twitterUser ? true : false;
        nextToken = axios_resp.data.meta.next_token;
      }
    }
    return hasRetweeted;
  } catch (error) {
    console.log(
      `TwitterError: unable to fetch retweeted by for tweet[${tweetID}]`
    );
    return false;
  }
};

exports.checkUserHasLiked = async (twitterUserId, tweetID, access_token) => {
  try {
    let url = `https://api.twitter.com/2/tweets/${tweetID}/liking_users?max_results=100`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
    };

    let axios_resp = await axios.get(url, config);
    let likingUsers = axios_resp.data.data;

    if (!likingUsers) {
      return false;
    }
    let hasLiked = likingUsers.find(
      (likingUser) => likingUser.id == twitterUserId
    );

    let nextToken = axios_resp.data.meta.next_token;
    while (nextToken && !hasLiked) {
      url = `https://api.twitter.com/2/tweets/${tweetID}/liking_users?max_results=100&pagination_token=${nextToken}`;

      axios_resp = await axios.get(url, config);
      likingUsers = axios_resp.data.data;

      if (!likingUsers) {
        return false;
      }
      hasLiked = likingUsers.find(
        (likingUser) => likingUser.id == twitterUserId
      );

      nextToken = axios_resp.data.meta.next_token;
    }

    return !!hasLiked; // !! -> convert object's existance to boolean
  } catch (error) {
    console.log(`TwitterError: unable to fetch liked by for tweet[${tweetID}]`);
    return false;
  }
};
