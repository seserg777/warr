'use strict';
const mongoose = require('mongoose');
const Game = require('./Game');
var AutoIncrement = require('mongoose-sequence')(mongoose);


const LotPageSchema = new mongoose.Schema({
    title: {type: String},
    lot_id: Number,
    ptype: String, // [accs, services, items]
    gameId:  mongoose.Schema.Types.ObjectId,
    servers: [{name:String}],
    sides: [{name:String}],
    classes: [{name:String}],
    races: [{name:String}],
    custom_fields:[{list:[], name: String, ftype: String}],
    description: String,
    seo_meta: String,
    seo_tags: String,
    page_title: String,
    picture: {type: String},
    localization: [String],
    sort: Number,
    commission: {type: Number, default:0.0},
    ref_commission: {type: Number, default:0.0},
    _game: { type: mongoose.Schema.Types.ObjectId, ref: 'Game' },
    _children: mongoose.Schema.Types.ObjectId
});

LotPageSchema.plugin(AutoIncrement, {inc_field: 'lot_id'});
const LotPage = mongoose.model('LotPage',LotPageSchema);

module.exports = LotPage;
