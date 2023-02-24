require("../config/db").connectWithDb();
const Dao = require("../models/dao");
const oReview = require("../models/review");
const fs = require("fs");

let newReviews = [];
let oldReviews = [];
oReview.find({}).then((reviews) => {
  console.log(`Found ${oldReviews.length} reviews`);
  oldReviews = reviews;
  const oldRLen = oldReviews.length;
  const promises = oldReviews.map(
    (oldReview, idx) =>
      new Promise(async (resolve) => {
        console.log(`working on: ${oldReview._id} [${idx + 1}/${oldRLen}]`);
        if ("authorized" in oldReview && oldReview.authorized == false) {
          resolve();
        }
        let review = {};
        review._id = { $oid: oldReview._id };
        review.rating = Number.parseInt(oldReview.rating);
        review.comment = oldReview.review_desc;
        review.meta = {
          resonate_vibes_rate: oldReview.resonate_vibes_rate,
          onboarding_exp: oldReview.onboarding_exp,
          opinions_matter: oldReview.opinions_matter,
          great_org_structure: oldReview.great_org_structure,
          friend_recommend: oldReview.friend_recommend,
          great_incentives: oldReview.great_incentives,
        };
        review.vote = {
          up: oldReview.thumbs_up,
          down: oldReview.thumbs_down,
        };
        review.user = null;
        let listing = await Dao.findOne({
          dao_name: oldReview.dao_name,
        }).select({ _id: 1 });

        review.listing = { $oid: listing._id };
        review.oldData = {
          user_discord_id: oldReview.user_discord_id,
          public_address: oldReview.public_address,
          guild_id: oldReview.guild_id,
        };
        newReviews.push(review);
        resolve();
      })
  );

  Promise.all(promises)
    .then(() => {
      fs.writeFileSync("newReview.json", JSON.stringify(newReviews));
      console.log("COMPLETE!!");
      process.exit(0);
    })
    .catch((error) => console.log(error));
});
