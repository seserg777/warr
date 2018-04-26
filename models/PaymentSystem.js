'use strict';
const mongoose = require('mongoose');

const paySysSchema = new mongoose.Schema({
    title: {type: String, unique:true},
    pay_system_file: {type:String},
    commision: Number,
    wallet: {type: String, default: 'qiwi', enum: ["webmoney", "qiwi", "yandex", "play4play"]},
    currency: String,
    currency_title: String,
    ref_back: Number,
    pay_system_config: {type:String},
    pay_system_setting_controller: String,
    pay_system_setting_view: String,
    ordering: {type: Number, default:0},
    active: Boolean
});




const PaymentSystem = mongoose.model('PaymentSystem',paySysSchema);

module.exports = PaymentSystem;
