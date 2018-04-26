'use strict';
const mongoose = require('mongoose');
const dataTables = require('../modules/datatables/mongoose-datatables');

const LogSchema = new mongoose.Schema({
    user:{type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    description:{type: String},
    ip:{type: String},
    type:{type: String, default: 'info', enum: ["info", "error", "danger"]},

},{
    timestamps:true
});

LogSchema.post('save', function () {
    global.io.sockets.in('logs').emit('status', {updated: 1});
});
LogSchema.plugin(dataTables, {
    totalKey: 'recordsTotal',
    dataKey: 'data'
});
const Logs = mongoose.model('Logs',LogSchema);
module.exports = Logs;