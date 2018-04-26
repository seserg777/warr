const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const request = require('request');

dotenv.load({ path: '.env.example' });
mongoose.Promise = global.Promise;

//mongoose.set('debug', true);

mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, {
    useMongoClient: true,
    /* other options */
});
mongoose.connection.on('error', () => {
    console.error('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
});
const Games = require('./models/Game');
const SellersStats = require('./models/SellersStats');
const ReferralStats = require('./models/ReferralStats');
const RefundStats = require('./models/RefundStats');
const ProfitStats = require('./models/ProfitStats');
const User = require('./models/User');
const MainStats = require('./models/MainStats');
const Operations = require('./models/Operations');
const PublicChat = require('./models/PublicChat');
const Chat = require('./models/Chat');
const ChatRoom = require('./models/ChatRoom');
const Chip = require('./models/Chip');
const Lot = require('./models/Lot');
const Log = require('./models/Log');
const Order = require('./models/Order');
const Config = require('./models/Config');
const Vars = require('./models/Vars');
const ps = require('./models/PaymentSystem');

function updateCourses() {
    request('https://www.cbr-xml-daily.ru/daily_json.js', function (err, response, body) {
        "use strict";
        if (err)
            console.error(err);
        let courses = JSON.parse(body).Valute;
        let actual_course = {
            RUB: 1,
            USD: courses.USD.Value / courses.USD.Nominal,
            EUR: courses.EUR.Value / courses.EUR.Nominal,
            UAH: courses.UAH.Value / courses.UAH.Nominal
        };
        Config.findOneAndUpdate({param: 'Courses'}, {
            value: actual_course
        }, (err, rows) => {
            if (err)
                console.error(err);
        });

    });
}

setInterval(updateCourses,1000*60*60);