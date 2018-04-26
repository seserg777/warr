'use strict';
const mongoose = require('mongoose');
const dataTables = require('../modules/datatables/mongoose-datatables');
const AutoIncrement = require('mongoose-sequence')(mongoose);


const RefundStatsSchema = new mongoose.Schema({
        sum: {type: Number, default: 0},
        refund_stat_id: Number,
        operation: {type: String, default: 'input', enum: ["input", "output"]},
        order: {type: mongoose.Schema.Types.ObjectId, ref: 'Order'},
        user:  {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        need_confirmation: {type:Boolean, default:false},
        confirmed_by: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        user_operation:{type: mongoose.Schema.Types.ObjectId},
        purse: String,
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

RefundStatsSchema.post('save', function () {
    global.io.sockets.in('refund-stats').emit('status', {updated: 1});
});

RefundStatsSchema.plugin(AutoIncrement, {inc_field: 'refund_stat_id'});
RefundStatsSchema.plugin(dataTables, {
    totalKey: 'recordsTotal',
    dataKey: 'data'
});
const RefundStats = mongoose.model('RefundStats', RefundStatsSchema);
module.exports = RefundStats;