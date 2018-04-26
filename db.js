const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');


dotenv.load({ path: '.env.example' });

const Games = require('./models/Game');
const Vars = require('./models/Vars');
const ps = require('./models/PaymentSystem');
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
mongoose.connection.on('error', () => {
    console.error('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
});

let _var = new Vars();
_var.save();