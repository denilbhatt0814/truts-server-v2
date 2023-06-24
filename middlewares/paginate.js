const HTTPError = require("../utils/httpError");

// take in model and request
const paginateRequest = (Model, lookupOptions, additionalToPipeline) => {
  return async (req, res, next) => {
    try {
      let bigQuery = req.query;

      // FILTER:
      // first parse the request
      // say get out filter from the query and parse it
      //    -> then process it to adjust gte lte and arrays
      let filterObject = parseQueryFilter(bigQuery.filter);

      // SORTING:
      // parse sorting data
      // then check N keep sort. don't apply yet
      let sortObject = parseQuerySort(bigQuery.sort);

      // PAGINATION
      let currentPage = parseInt(bigQuery.page) || 1;
      let resultPerPage = parseInt(bigQuery.limit) || 20;
      const skipVal = resultPerPage * (currentPage - 1);

      // UNDER-WORK:
      const joinPipeline = buildAggregationPipeline(
        "JOIN",
        filterObject,
        sortObject,
        resultPerPage,
        skipVal,
        lookupOptions,
        additionalToPipeline
      );
      const countPipeline = buildAggregationPipeline(
        "COUNT",
        filterObject,
        sortObject,
        resultPerPage,
        skipVal,
        lookupOptions,
        additionalToPipeline
      );

      let result = Model.aggregate(joinPipeline);
      let countResult = Model.aggregate(countPipeline);

      const promiseResolve = await Promise.all([countResult, result]);
      totalCount = promiseResolve[0][0].totalCount;
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
    } catch (error) {
      console.log("paginateRequest: ", error);
      return new HTTPError(res, 500, error, "internal server error");
    }
  };
};
// const paginateRequest = (Model) => {
//   return async (req, res, next) => {
//     try {
//       let bigQuery = req.query;

//       // FILTER:
//       // first parse the request
//       // say get out filter from the query and parse it
//       //    -> then process it to adjust gte lte and arrays
//       let filterObject = {};
//       if (bigQuery.filter) {
//         let filterString = bigQuery.filter;
//         console.log({ filterString });
//         // for range queries
//         filterString = filterString.replace(
//           /\b(gte|lte|gt|lt|eq)\b/g,
//           (m) => `$${m}`
//         );
//         console.log({ filterStringMod: filterString });

//         filterObject = JSON.parse(filterString);

//         // to avoid any exploits
//         delete filterObject["verified"];
//         delete filterObject["visible"];

//         console.log({ filterObject });
//         // structure arrays for mongoQuery
//         Object.keys(filterObject).forEach((key) => {
//           const val = filterObject[key];
//           if (Array.isArray(val)) {
//             filterObject[key] = { $in: val };
//           }
//         });
//         console.log({ filterObjectIn: filterObject });
//       }
//       // final filter query
//       filterObject = {
//         $and: [
//           {
//             $or: [
//               { verified: true },
//               { visible: true },
//               { verified_status: true },
//             ],
//           },
//           {
//             ...filterObject,
//           },
//         ],
//       };

//       // SORTING:
//       // parse sorting data
//       // then check N keep sort. don't apply yet
//       let sortObject = { _id: -1 };
//       if (bigQuery.sort) {
//         const parsedSort = JSON.parse(bigQuery.sort);
//         Object.keys(parsedSort).forEach((key) => {
//           const sortOrder = parsedSort[key];
//           if (sortOrder === -1) {
//             parsedSort[key] = sortOrder;
//           } else {
//             parsedSort[key] = 1;
//           }
//         });
//         sortObject = { ...parsedSort };
//       }

//       console.log({ sortObject });
//       // PAGINATION
//       let currentPage = parseInt(bigQuery.page) || 1;
//       let resultPerPage = parseInt(bigQuery.limit) || 20;
//       const skipVal = resultPerPage * (currentPage - 1);

//       // here make PROMISE for the countDoc query
//       let totalCount = Model.countDocuments(filterObject);

//       let result = Model.find(filterObject)
//         .sort(sortObject)
//         .limit(resultPerPage)
//         .skip(skipVal);

//       const promiseResolve = await Promise.all([totalCount, result]);
//       totalCount = promiseResolve[0];
//       result = promiseResolve[1];

//       const totalPages = Math.ceil(totalCount / resultPerPage);

//       req.pagination = {
//         count: result.length,
//         result,
//         meta: {
//           totalCount,
//           totalPages,
//           // If startIndex > 0:
//           prevPage: skipVal > 0 ? currentPage - 1 : undefined,
//           // If endIndex < totalCount: (i.e more to serve)
//           nextPage:
//             currentPage * resultPerPage < totalCount
//               ? currentPage + 1
//               : undefined,
//         },
//       };
//       next();
//     } catch (error) {
//       console.log("paginateRequest: ", error);
//       return new HTTPError(res, 500, error, "internal server error");
//     }
//   };
// };

// finally calculate the pagination data [page: , totalPage, limit, totalDocs]

// now run the query for results in PROMISE.ALL with count query.
// return in res.pagination

// UTIL funcs.
function parseQueryFilter(queryFilter) {
  let filterObject = {};
  if (queryFilter) {
    let filterString = queryFilter;
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
        $or: [{ verified: true }, { visible: true }, { verified_status: true }],
      },
      {
        ...filterObject,
      },
    ],
  };
  return filterObject;
}

function parseQuerySort(querySort) {
  let sortObject = { _id: -1 };
  if (querySort) {
    const parsedSort = JSON.parse(querySort);
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
  return sortObject;
}

function buildAggregationPipeline(
  aggregationType,
  filterObject,
  sortObject,
  resultPerPage,
  skipVal,
  lookupOptions,
  additionalToPipeline
) {
  let pipeline = [];
  // CHECK: if not empty object
  if (lookupOptions && lookupOptions.constructor !== Object) {
    const lookupObjects = parseLookupOptions(lookupOptions);
    pipeline.push(...lookupObjects);
  }

  pipeline.push({ $match: filterObject });

  switch (aggregationType) {
    case "JOIN":
      pipeline.push(
        { $sort: sortObject },
        { $skip: skipVal },
        { $limit: resultPerPage }
      );
      break;
    case "COUNT":
      pipeline.push({ $count: "totalCount" });
      break;

    default:
      throw new Error("Invalid aggregation type. (JOIN | COUNT)");
  }

  // finally
  // CHECK: if not empty object
  if (additionalToPipeline && additionalToPipeline.constructor !== Object) {
    pipeline.push(...additionalToPipeline);
  }

  return pipeline;
}

function parseLookupOptions(lookupOptions) {
  let lookupObjects = [];
  console.log({ lookupOptions });

  lookupOptions.forEach((lookup) => {
    if (lookup.select) {
      lookupObjects.push({
        $lookup: {
          from: lookup.from,
          let: { document_id: `$${lookup.path}` },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$document_id"] } } },
            { $project: lookup.select },
          ],
          as: lookup.path,
        },
      });
    } else {
      lookupObjects.push({
        $lookup: {
          from: lookup.from,
          localField: lookup.path,
          foreignField: "_id",
          as: lookup.path,
        },
      });
    }

    lookupObjects.push({ $unwind: `$${lookup.path}` });
  });

  return lookupObjects;
}

module.exports = paginateRequest;
