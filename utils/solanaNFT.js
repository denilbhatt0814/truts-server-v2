const axios = require("axios");
const { HELIUS_API_KEY, ALCHEMY_API_KEY } = require("../config/config");
require("dotenv").config();

const getMintlist = async (_firstCreator) => {
  let firstVerifiedCreator = _firstCreator;

  try {
    let arrayOfMintlist = [];
    let pagination = null;
    let checkPage = true;
    const url = `https://api.helius.xyz/v1/mintlist?api-key=${HELIUS_API_KEY}`;

    while (checkPage) {
      const { data } = await axios.post(url, {
        query: {
          // ABC collection
          firstVerifiedCreators: [firstVerifiedCreator],
        },
        options: {
          limit: 10000,
          paginationToken: pagination,
        },
      });
      console.log("Mintlist pagination: ", data.paginationToken);

      console.log("Mintlist length: ", data.result.length);
      for (var i = 0; i < data.result.length; i++) {
        arrayOfMintlist.push(data.result[i].mint.toLowerCase());
      }

      if (data.paginationToken) {
        pagination = data.paginationToken;
      } else {
        checkPage = false;
      }
      // console.log("Mintlist data: ", data);
    }

    return arrayOfMintlist;
  } catch {
    console.error;
  }
};

const solanaTokenCheck = async (_userAddress, _programId) => {
  try {
    const options = {
      method: "POST",
      url: `https://solana-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      data: {
        id: 1,
        jsonrpc: "2.0",
        method: "getTokenAccountsByOwner",
        params: [
          _userAddress, //_userAddress
          {
            programId: _programId, //_mintAddress
          },
          {
            encoding: "jsonParsed",
          },
        ],
      },
    };

    let arrayObj = [];
    let response = await axios.request(options);
    let result = response.data.result;
    console.log("value", result.value[2].account.data.parsed.info.mint);
    for (let i = 0; i < result.value.length; i++) {
      arrayObj.push(
        result.value[i].account.data.parsed.info.mint.toLowerCase()
      );
    }

    return arrayObj;
  } catch {
    console.error;
  }
};

const checkIsOwner = async (_userAddress, _firstVerifiedCreator) => {
  try {
    console.log("Startime", new Date().getTime());

    let programId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"; //MetaPlex Program ID

    let values = await Promise.all([
      getMintlist(_firstVerifiedCreator),
      solanaTokenCheck(_userAddress, programId),
    ]);

    console.log("promise values ", values[0].length, values[1].length);

    let mintListObj = values[0];
    let arrayOfTokens = values[1];

    // console.log("length", mintListObj.length)
    // console.log("array of length", arrayOfTokens.length)

    let isOwner = false;

    for (var i = 0; i < mintListObj.length; i++) {
      if (i < arrayOfTokens.length) {
        if (mintListObj.includes(arrayOfTokens[i])) {
          isOwner = true;
          break;
        }
      } else {
        break;
      }
    }
    console.log("isOwner ", isOwner);

    console.log("Endtime", new Date().getTime());
    return isOwner;
  } catch (error) {
    console.log("checkIsOwner: ", error);
  }
};

module.exports = checkIsOwner;
