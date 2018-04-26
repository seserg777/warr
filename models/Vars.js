'use strict';
const mongoose = require('mongoose');

const VarsSchema = new mongoose.Schema({
    site_balance: {
        webmoney: {type:Number, default: 0},
        yandex: {type:Number, default: 0},
        qiwi: {type:Number, default: 0},
        play4play: {type:Number, default: 0}
    },
    statistic: {
        daily: {
            minPrice: {type:Number, default: 0},
            maxPrice: {type:Number, default: 0},
            sum:    {type:Number, default: 0},
            ordersCount:{type:Number, default: 0},
            profit:{type:Number, default: 0}
        },
        weakly: {
            minPrice: {type:Number, default: 0},
            maxPrice: {type:Number, default: 0},
            sum:    {type:Number, default: 0},
            ordersCount:{type:Number, default: 0},
            profit:{type:Number, default: 0}
        },
        monthly: {
            minPrice: {type:Number, default: 0},
            maxPrice: {type:Number, default: 0},
            sum:    {type:Number, default: 0},
            ordersCount:{type:Number, default: 0},
            profit:{type:Number, default: 0}
        },
        yearly: {
            minPrice: {type:Number, default: 0},
            maxPrice: {type:Number, default: 0},
            sum:    {type:Number, default: 0},
            ordersCount:{type:Number, default: 0},
            profit:{type:Number, default: 0}
        },
        custom: {
            custom_date: {type: String},
            minPrice: {type:Number, default: 0},
            maxPrice: {type:Number, default: 0},
            sum:    {type:Number, default: 0},
            ordersCount:{type:Number, default: 0},
            profit:{type:Number, default: 0}
        }
    }

});
VarsSchema.post('save', function () {
    global.io.sockets.in('balances').emit('status', {updated: 1});
});


const Vars = mongoose.model('Vars',VarsSchema);
module.exports = Vars;