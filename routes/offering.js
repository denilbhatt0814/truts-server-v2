const express = require("express");
const router = express.Router();
const offeringControllers = require("./controllers/offeringControllers");

router.post("/offering", offeringControllers.createOffering);
router.get("/offering/:id", offeringControllers.getOfferingById);
router.get("/offerings", offeringControllers.getOfferings);
router.put("/offering/:id", offeringControllers.updateOffering);

module.exports = router;
