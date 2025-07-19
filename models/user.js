const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose= require("passport-local-mongoose");

const userSchema =  new Schema({
    email:{
        type:String,
        required:true
    }
});

//pbkdf2 hashing algorithm is being used here!

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User',userSchema);