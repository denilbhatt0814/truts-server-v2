const express = require("express");
const router = express.Router();
const offeringControllers = require("../controllers/offeringController");
const { Offering } = require("../models/offering");
const paginateRequest = require("../middlewares/paginate");
const cacheRoute = require("../middlewares/cacheRoute");
const { isLoggedIn } = require("../middlewares/user");

router.route("/offering").post(offeringControllers.createOffering);

router
  .route("/offerings")
  .get(
    cacheRoute,
    paginateRequest(Offering, {}, []),
    offeringControllers.getOfferings
  );

router
  .route("/offering/tags")
  .get(cacheRoute, offeringControllers.getOfferCountInATag);

router
  .route("/offering/claim")
  .post(isLoggedIn, offeringControllers.applyToClaimOffering);

router
  .route("/offering/:id")
  .get(cacheRoute, offeringControllers.getOfferingById)
  .put(offeringControllers.updateOffering);

router
  .route("/offering/:id/claim-count")
  .get(cacheRoute, offeringControllers.getOfferClaimCount);

module.exports = router;
