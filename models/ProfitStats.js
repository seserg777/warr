'use strict';
const mongoose = require('mongoose');
const dataTables = require('../modules/datatables/mongoose-datatables');
const AutoIncrement = require('mongoose-sequence')(mongoose);


const ProfitStatsSchema = new mongoose.Schema({
        sum: {type: Number, default: 0},
        profit_stat_id: Number,
        operation: {type: String, default: 'input', enum: ["input", "output"]},
        order: {type: mongoose.Schema.Types.ObjectId, ref: 'Order'},
        user:  {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        need_confirmation: {type:Boolean, default:false},
        confirmed_by: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        user_operation:{type: mongoose.Schema.Types.ObjectId},
        wallet: String,
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

ProfitStatsSchema.post('save', function () {
    global.io.sockets.in('profit-stats').emit('status', {updated: 1});
});

ProfitStatsSchema.plugin(AutoIncrement, {inc_field: 'profit_stat_id'});
ProfitStatsSchema.plugin(dataTables, {
    totalKey: 'recordsTotal',
    dataKey: 'data'
});
const ProfitStats = mongoose.model('ProfitStats', ProfitStatsSchema);
module.exports = ProfitStats;