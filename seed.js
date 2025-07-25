const mongoose = require("mongoose");
const Listing = require("./models/listing");
const sampleListings = require("./data");
const geocodeLocation = require("./utils/geocode");
const User = require("./models/user"); // Import User
require("dotenv").config();

async function seedDB() {
  await mongoose.connect(process.env.ATLASDB_URL);

  await Listing.deleteMany({});
  console.log("Existing listings removed.");

  const users = await User.find({});
  if (users.length === 0) {
    console.error("No users found in database for seeding owners. Please seed users first.");
    process.exit(1);
  }

  for (let listingData of sampleListings.data) {
    const coordinates = await geocodeLocation(listingData.location, listingData.country);

    const randomUser = users[Math.floor(Math.random() * users.length)];

    const newListing = new Listing({
      ...listingData,
      geometry: { type: "Point", coordinates: coordinates },
      owner: randomUser._id, // Ensure owner is correctly set
    });

    await newListing.save();
    console.log(`Added: ${listingData.title}`);
  }

  mongoose.connection.close();
}

seedDB();


    