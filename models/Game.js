'use strict';
const mongoose = require('mongoose');
//const urlify = require('urlify').create({addEToUmlauts:true,szToSs:true,spaces:"-",toLower:true,trim:true});

const gameSchema = new mongoose.Schema({
    title: {type: String},
   // alias: {type:String},
    picture: {type: String},
    localization: [String],
    commission: {type: Number, default:0.0},
    sort: Number,
    childrens: [{childType: String, childName: String, childPageId: mongoose.Schema.Types.ObjectId, id: Number}]
});

gameSchema.pre('save', function (next) {
 //   const game = this;
   // if (!game.isModified('title')) { return next(); }
   // game.alias = urlify(game.title);
    next();
});


const Game = mongoose.model('Game',gameSchema);

module.exports = Game;