const trutsEventController = require("../controllers/trutsEventController");
const { isLoggedIn } = require("../middlewares/user");
const paginateRequest = require("../middlewares/paginate");
const { TrutsEvent } = require("../models/trutsEvent");
const router = require("express").Router();

router
  .route("/truts-event")
  .get(paginateRequest(TrutsEvent, {}, []), trutsEventController.getTrutsEvents)
  .post(trutsEventController.createTrutsEvent);

// get tags
router.route("/truts-event/tags").get(trutsEventController.getEventCountInATag);
router
  .route("/truts-event/category")
  .get(trutsEventController.getEventCountInACategory);

// get truts event by id
router.route("/truts-event/:id").get(trutsEventController.getTrutsEventById);

module.exports = router;
