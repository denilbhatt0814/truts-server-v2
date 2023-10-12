const express = require("express");
const router = express.Router();
const offeringControllers = require("../controllers/offeringController");
const { Offering } = require("../models/offering");
const paginateRequest = require("../middlewares/paginate");
const cacheRoute = require("../middlewares/cacheRoute");

router.route("/offering").post(offeringControllers.createOffering);

router
  .route("/offerings")
  .get(
    cacheRoute,
    paginateRequest(Offering, {}, []),
    offeringControllers.getOfferings
  );

router
  .route("/offering/:id")
  .get(offeringControllers.getOfferingById)
  .put(offeringControllers.updateOffering);

module.exports = router;
