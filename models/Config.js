'use strict';
const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
    param: String,
    value: Object
});


const Config = mongoose.model('Config',ConfigSchema);
module.exports = Config;