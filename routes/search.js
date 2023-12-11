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

const searchTrutsEvents = async (req, res) => {
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
                  value: "hong",
                  boost: 2,
                },
              },
            },
            {
              query_string: {
                query: "hong",
                default_field: "name",
                boost: 2,
              },
            },
            {
              prefix: {
                location: {
                  value: "hong",
                  boost: 1,
                },
              },
            },
            {
              query_string: {
                query: "hong",
                default_field: "location",
                boost: 1,
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
          "logo",
          "banner",
          "location",
          "description",
          "tags",
          "category",
          "type",
          "visible",
          "verified",
          "trending",
          "start_date",
          "end_date",
        ],
      },
    };

    let axios_res = await axios.post(
      "https://search.truts.xyz/truts_events/_search",
      query4
    );

    return new HTTPResponse(res, true, 200, null, null, {
      result: axios_res.data,
    });
  } catch (error) {
    console.log("searchListing: ", error);
  }
};

router.get("/search/truts_events/:term", searchTrutsEvents);
router.get("/search/listings/:term", searchListing);
router.get("/search/:term", searchListing);
module.exports = router;
