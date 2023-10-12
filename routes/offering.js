const express = require("express");
const router = express.Router();
const offeringControllers = require("../controllers/offeringController");

router.route("/offering").post(offeringControllers.createOffering);

router.route("/offerings").get(offeringControllers.getOfferings);

router
  .route("/offering/:id")
  .get(offeringControllers.getOfferingById)
  .put(offeringControllers.updateOffering);

module.exports = router;
