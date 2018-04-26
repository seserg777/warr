'use strict';
const mongoose = require('mongoose');
const dataTables = require('../modules/datatables/mongoose-datatables');
const AutoIncrement = require('mongoose-sequence')(mongoose);


const ReferralStatsSchema = new mongoose.Schema({
        sum: {type: Number, default: 0},
        ref_stat_id: Number,
        operation: {type: String, default: 'input', enum: ["input", "output"]},
        order: {type: mongoose.Schema.Types.ObjectId, ref: 'Order'},
        user:  {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        need_confirmation: {type:Boolean, default:false},
        confirmed_by: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        user_operation:{type: mongoose.Schema.Types.ObjectId},
        purse: {type: String, default: 'webmoney', enum: ["webmoney", "qiwi", "yandex", "play4play"]},
        confirmation_date: { type: Date, default: 0 },
        searchable: {
            username: String,
            date: String,
            description: String,
            confirmed: String,
            order_id: String,
        }
    },
    {
        timestamps: true
    });

ReferralStatsSchema.post('save', function () {
    global.io.sockets.in('ref-stats').emit('status', {updated: 1});
});

ReferralStatsSchema.plugin(AutoIncrement, {inc_field: 'ref_stat_id'});
ReferralStatsSchema.plugin(dataTables, {
    totalKey: 'recordsTotal',
    dataKey: 'data'
});
const ReferralStats = mongoose.model('ReferralStats', ReferralStatsSchema);
module.exports = ReferralStats;