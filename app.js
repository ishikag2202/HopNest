if(process.env.NODE_ENV !== "production"){
    require("dotenv").config();
}

const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({accessToken: mapToken});

require("dotenv").config();
console.log(process.env.SECRET);

const express=require("express");
const app=express();
const mongoose=require("mongoose");
const Listing=require("./models/listing.js");
const path=require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const wrapAsync=require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const {listingSchema,reviewSchema} =  require("./schema.js");
const Review=require("./models/review.js");
const session=require("express-session");
const MongoStore = require('connect-mongo');
const flash=require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
const {isLoggedIn, isOwner} = require("./middleware.js");

const reviewsRouter=require("./routes/review.js");
const userRouter = require("./routes/user.js");

// const mongo_url = "mongodb://wanderuser:wander123@127.0.0.1:27017/wanderlust";
const dbUrl = process.env.ATLASDB_URL;


const multer = require('multer');
const {storage} = require("./cloudConfig.js");

const upload = multer({storage});
// const mongo_url="mongodb://127.0.0.1:27017/wanderlust";

async function main()
{
    await mongoose.connect(dbUrl);
}

app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"));
app.engine('ejs',ejsMate);
app.use(express.static(path.join(__dirname,'/public')));

const store = MongoStore.create({
    mongoUrl:dbUrl,
    crypto: {
        secret: process.env.SECRET,
    } ,
    touchAfter: 24*3600
});

store.on("error",()=>{
    console.log("ERROR in MONGO SESSION STORE",err);
});

const sessionOptions = {
    store,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie:{
        expires: Date.now()+(7*24*60*60*100), // in  milliscs
        maxAge: 7*24*60*60*100,
        httpOnly: true,
    },
};


app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


app.use((req,res,next)=>{
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    res.locals.MAP_TOKEN = process.env.MAP_TOKEN;
    next();
});

// const validateListing = (req, res, next) => {
//     const { error } = listingSchema.validate(req.body); // match full structure
//     if (error) {
//         const msg = error.details.map(el => el.message).join(",");
//         throw new ExpressError(400, msg);
//     }
//     next();
// };

const validateListing = (req, res, next) => {
    const { error } = listingSchema.validate(req.body);
    if (error) {
        console.log("Validation error:", error.details);
        const msg = error.details.map(el => el.message).join(",");
        throw new ExpressError(400, msg);
    }
    next();
};


// Routes
app.get("/listings", wrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("listings/index", { allListings });
}));

app.get("/listings/new",isLoggedIn, (req, res) => {
    res.render("listings/new");
});

// app.post("/listings", isLoggedIn,upload.single('image'),validateListing, wrapAsync(async (req, res) => {
//     console.log("Without validation:", req.body);
//     let url = req.file.path;
//     let filename = req.file.filename;
//     console.log(url, "..", filename);
//     const newListing = new Listing(req.body.listing);
//     newListing.owner = req.user._id;
//     await newListing.save();

//     req.flash("success","New Listing Created!");
//     res.redirect(`/listings/${newListing._id}`);
// }));


app.post("/listings", isLoggedIn, upload.single("image"), (req, res, next) => {
    // Inject image data into req.body.listing
    if (!req.body.listing) req.body.listing = {};
    
    if (req.file) {
        req.body.listing.image = {
            url: req.file.path,
            filename: req.file.filename
        };
    }

    next(); // continue to validation
}, validateListing, wrapAsync(async (req, res) => {
    let response = await geocodingClient.forwardGeocode({
        query: req.body.listing.location,
        limit: 1,
    })
    .send();

    const newListing = new Listing(req.body.listing);
    const { path: url, filename } = req.file;
    newListing.owner = req.user._id;
    newListing.image = {url,filename};

    newListing.geometry = response.body.features[0].geometry;

    let savedListing = await newListing.save();
    console.log(savedListing);


    req.flash("success", "New Listing Created!");
    res.redirect(`/listings/${newListing._id}`);
}));



// app.post("/listings",(req,res)=>{
//     res.send(req.file);
// });


app.get("/listings/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id)
    .populate({
        path: "reviews",
        populate: { path: "author", },
    })
    .populate("owner");
    if(!listing)
    {
        req.flash("error","Listing you requested for does not exist!");
        return res.redirect("/listings");
    }
    res.render("listings/show", { listing });
}));

app.get("/listings/:id/edit", isLoggedIn,isOwner, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    if(!listing)
    {
        req.flash("error","Listing you requested for does not exist!");
        res.redirect("/listings");
    }
    let originalImageUrl = listing.image.url;
    originalImageUrl = originalImageUrl.replace("/upload","/upload/h_300,w_250");
    res.render("listings/edit", { listing,originalImageUrl: listing.image.url  });
}));


app.put("/listings/:id", isLoggedIn, isOwner, upload.single("image"), (req, res, next) => {
    if (!req.body.listing) req.body.listing = {};

    // Only add image if a new one is uploaded
    if (req.file) {
        req.body.listing.image = {
            url: req.file.path,
            filename: req.file.filename
        };
    }

    next();
}, validateListing, wrapAsync(async (req, res) => {
    const { id } = req.params;

    // Update only what's provided in req.body.listing
    const listing = await Listing.findById(id);

    Object.assign(listing, req.body.listing); // merge updated fields

    await listing.save();

    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
}));


app.delete("/listings/:id", isLoggedIn, isOwner, wrapAsync(async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash("success","Listing Deleted!");
    res.redirect("/listings");
}));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.locals.layout = "layouts/boilerplate";

main().then(()=>{
    console.log("connected to DB!");
}).catch(err=>{
    console.log(err);
});

const { body, validationResult } = require("express-validator");

app.use("/listings/:id/reviews",reviewsRouter); //review route
app.use("/",userRouter); //userRouter

app.all("*",(req,res,next)=>{
    next(new ExpressError(404, "Page Not Found!"));
});

// app.use((err, req, res, next) => {
//     const statusCode = err?.statusCode || 500;
//     const message = err?.message || "Something went wrong!";
//     res.status(statusCode).render("error", { message, statusCode });
// });


app.use((err, req, res, next) => {
    console.log("Error:", err); // Log the error for debugging
    const statusCode = err?.statusCode || 500;
    const message = err?.message || "Something went wrong!";
    res.status(statusCode).render("error", { message, statusCode });
});

// app.use((err, req, res, next) => {
//     const statusCode = err.statusCode || 500;
//     res.status(statusCode).render("error", { err, statusCode });
// });


app.listen(8080,()=>{
    console.log("server is listening to port 8080");
});
