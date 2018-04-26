'use strict';
const mongoose = require('mongoose');


const lotSchema = new mongoose.Schema({
    _lot_page: {type: mongoose.Schema.Types.ObjectId, ref: 'LotPage'},
    _owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    _game: {type: mongoose.Schema.Types.ObjectId, ref: 'Game'},
    title: {type: String},
    active: Boolean,
    server: mongoose.Schema.Types.ObjectId,
    side: mongoose.Schema.Types.ObjectId,
    race: mongoose.Schema.Types.ObjectId,
    class: mongoose.Schema.Types.ObjectId,
    short_desc: String,
    description: String,
    price: Number,
    picture: {type: String},
    localization: [String],
    lastPushUp: { type: Date, default: Date.now },
    customs: [{cf_id:mongoose.Schema.Types.ObjectId, value: String}]
});



const Lot = mongoose.model('Lot',lotSchema);
module.exports = Lot;
