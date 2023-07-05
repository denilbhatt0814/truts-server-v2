const { default: axios } = require("axios");
const { HTTPResponse } = require("../utils/httpResponse");
const router = require("express").Router();

const searchListing = async (req, res) => {
  try {
    const { term } = req.params;

    console.log(term);

    let query4 = {
      query: {
        bool: {
          should: [
            {
              prefix: {
                name: {
                  value: term,
                },
              },
            },
            {
              query_string: {
                query: term,
                default_field: "name",
              },
            },
          ],
          filter: {
            term: {
              visible: true,
            },
          },
        },
      },
      _source: {
        includes: [
          "name",
          "categories",
          "photo",
          "reviews",
          "slug",
          "chains",
          "description",
          "oneliner",
        ],
      },
    };

    let axios_res = await axios.post(
      "https://search.truts.xyz/listings/_search",
      query4
    );

    return new HTTPResponse(res, true, 200, null, null, {
      result: axios_res.data,
    });
  } catch (error) {
    console.log("searchListing: ", error);
  }
};

router.get("/search/:term", searchListing);
module.exports = router;
