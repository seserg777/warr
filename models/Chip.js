'use strict';
const mongoose = require('mongoose');
const Game = require('./Game');
const ChipPage = require('./ChipPage');
const User = require('./User');

const ChipSchema = new mongoose.Schema({
    _chip_page: {type: mongoose.Schema.Types.ObjectId, ref: 'ChipPage'},
    _game: {type: mongoose.Schema.Types.ObjectId, ref: 'Game'},
    _owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    min_order: Number, // Минимальная сумма заказа
    toggle_on: Boolean,
    server_id: mongoose.Schema.Types.ObjectId,
    side_id: mongoose.Schema.Types.ObjectId,
    price: Number,
    count: Number,

});


const Chip = mongoose.model('Chip',ChipSchema);
module.exports = Chip;