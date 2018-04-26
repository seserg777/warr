'use strict';
const mongoose = require('mongoose');
const ChipPage = require('./ChipPage');

const ServerSchema = new mongoose.Schema({
    name: String,
    page: { type: mongoose.Schema.Types.ObjectId, ref: 'ChipPage' },
});


const Server = mongoose.model('Server',ServerSchema);
module.exports = Server;
