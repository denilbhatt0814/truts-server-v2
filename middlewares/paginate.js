// take in model and request
const paginateRequest = (Model) => {
  return async (req, res, next) => {
    let bigQuery = req.query;

    // FILTER:
    // first parse the request
    // say get out filter from the query and parse it
    //    -> then process it to adjust gte lte and arrays
    let filterObject = {};
    if (bigQuery.filter) {
      let filterString = bigQuery.filter;
      console.log({ filterString });
      // for range queries
      filterString = filterString.replace(
        /\b(gte|lte|gt|lt|eq)\b/g,
        (m) => `$${m}`
      );
      console.log({ filterStringMod: filterString });

      filterObject = JSON.parse(filterString);

      // to avoid any exploits
      delete filterObject["verified"];
      delete filterObject["visible"];

      console.log({ filterObject });
      // structure arrays for mongoQuery
      Object.keys(filterObject).forEach((key) => {
        const val = filterObject[key];
        if (Array.isArray(val)) {
          filterObject[key] = { $in: val };
        }
      });
      console.log({ filterObjectIn: filterObject });
    }
    // final filter query
    filterObject = {
      $and: [
        {
          $or: [
            { verified: true },
            { visible: true },
            { verified_status: true },
          ],
        },
        {
          ...filterObject,
        },
      ],
    };

    // SORTING:
    // parse sorting data
    // then check N keep sort. don't apply yet
    let sortObject = { _id: -1 };
    if (bigQuery.sort) {
      const parsedSort = JSON.parse(bigQuery.sort);
      Object.keys(parsedSort).forEach((key) => {
        const sortOrder = parsedSort[key];
        if (sortOrder === -1) {
          parsedSort[key] = sortOrder;
        } else {
          parsedSort[key] = 1;
        }
      });
      sortObject = { ...parsedSort };
    }

    console.log({ sortObject });
    // PAGINATION
    let currentPage = parseInt(bigQuery.page) || 1;
    let resultPerPage = parseInt(bigQuery.limit) || 20;
    const skipVal = resultPerPage * (currentPage - 1);

    // here make PROMISE for the countDoc query
    let totalCount = Model.countDocuments(filterObject);

    let result = Model.find(filterObject)
      .sort(sortObject)
      .limit(resultPerPage)
      .skip(skipVal);

    const promiseResolve = await Promise.all([totalCount, result]);
    totalCount = promiseResolve[0];
    result = promiseResolve[1];

    const totalPages = Math.ceil(totalCount / resultPerPage);

    req.pagination = {
      count: result.length,
      result,
      meta: {
        totalCount,
        totalPages,
        // If startIndex > 0:
        prevPage: skipVal > 0 ? currentPage - 1 : undefined,
        // If endIndex < totalCount: (i.e more to serve)
        nextPage:
          currentPage * resultPerPage < totalCount
            ? currentPage + 1
            : undefined,
      },
    };
    next();
  };
};

// finally calculate the pagination data [page: , totalPage, limit, totalDocs]

// now run the query for results in PROMISE.ALL with count query.
// return in res.pagination

module.exports = paginateRequest;
