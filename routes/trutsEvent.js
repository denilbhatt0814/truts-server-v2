const trutsEventController = require("../controllers/trutsEventController");
const { isLoggedIn } = require("../middlewares/user");
const paginateRequest = require("../middlewares/paginate");
const { TrutsEvent } = require("../models/trutsEvent");
const router = require("express").Router();

router
  .route("/truts-event")
  .get(paginateRequest(TrutsEvent, {}, []), trutsEventController.getTrutsEvents)
  .post(trutsEventController.createTrutsEvent);

router
  .route("/truts-event/tally-form")
  .post(trutsEventController.tallyFormSubmission);

// get tags
router.route("/truts-event/tags").get(trutsEventController.getEventCountInATag);
router
  .route("/truts-event/category")
  .get(trutsEventController.getEventCountInACategory);

// get locations
router
  .route("/truts-event/locations")
  .get(trutsEventController.getEventCountInLocation);

router
  .route("/truts-event/cities")
  .get(trutsEventController.getEventCountInCity);

router
  .route("/truts-event/countries")
  .get(trutsEventController.getEventCountInCountry);

// get truts event by id
router.route("/truts-event/:id").get(trutsEventController.getTrutsEventById);

// get side events for a main event
router
  .route("/truts-event/:id/side-events")
  .get(trutsEventController.getSideEventsForTrutsEvent);

module.exports = router;
