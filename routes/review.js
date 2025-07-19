const express = require("express");
const router = express.Router({ mergeParams: true }); 
const wrapAsync=require("../utils/wrapAsync.js");
const ExpressError = require("../utils/ExpressError.js");
const {listingSchema,reviewSchema} =  require("../schema.js");
const Review=require("../models/review.js");
const Listing = require("../models/listing");
const {isLoggedIn, isReviewAuthor} = require("../middleware.js");
const reviewController = require("../controllers/review.js");



const validateReview = (req,res,next) =>{
    let {error}=reviewSchema.validate(req.body);
        if(error)
        {
            let errMsg= error.details.map((el)=>el.message).join(",");
            throw new ExpressError(404,errMsg);
        }
        else
        {
            next();
        }
}; 

//Post Review Route
router.post("/",isLoggedIn,validateReview,wrapAsync(reviewController.createReview));

//Delete Review Route
router.delete("/:reviewId",isLoggedIn, isReviewAuthor, wrapAsync(reviewController.destroyReview));

module.exports =router;