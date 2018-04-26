'use strict';
const mongoose = require('mongoose');
const Game = require('./Game');
var AutoIncrement = require('mongoose-sequence')(mongoose);

const ChipPageSchema = new mongoose.Schema({
    title: {type: String},
    chip_id: Number,
    currency: String, // например адена
    currency_sell_count: {type:Number, default: 1}, // Количество продоваемой адены например КК
    currency_sell_sufix: String, // Количество продоваемой адены например КК
    currency_plural: String, // Аден
    description: String,
    seo_meta: String,
    seo_tags: String,
    page_title: String,
    servers: [{name:String}],
    sides: [{name:String}],
    sort: Number,
    commission: {type: Number, default:0.0},
    ref_commission: {type: Number, default:0.0},
    _game: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
    _children: mongoose.Schema.Types.ObjectId
});


ChipPageSchema.plugin(AutoIncrement, {inc_field: 'chip_id'});
const ChipPage = mongoose.model('ChipPage',ChipPageSchema);


module.exports = ChipPage;