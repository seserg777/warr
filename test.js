const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');


dotenv.load({ path: '.env.example' });

const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
mongoose.connection.on('error', () => {
    console.error('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
});

User.findOne({username: 'rexxi'}, function (err, user) {
    if(!user) console.log("!!!!!!!!!!!");
    user.incRefferals((info)=>{
        console.log('qq',info);
    })

})