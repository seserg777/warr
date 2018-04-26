'use strict';
const mongoose = require('mongoose');
const dataTables = require('../modules/datatables/mongoose-datatables');
const AutoIncrement = require('mongoose-sequence')(mongoose);


const mainStatsSchema = new mongoose.Schema({
        sum: {type: Number, default: 0},
        main_stat_id: Number,
        operation: {type: String, default: 'incoming', enum: ["incoming", "outcoming", "refund"]},
        order: {type: mongoose.Schema.Types.ObjectId, ref: 'Order'},
        user:  {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        ps:  {type: mongoose.Schema.Types.ObjectId, ref: 'PaymentSystem'},
        game: {type: mongoose.Schema.Types.ObjectId, ref: 'Game'},
        type: {type: String, default: 'chip', enum: ["chip", "lot"]},
        lot_page: {type: mongoose.Schema.Types.ObjectId, ref: 'LotPage'},
        chip_page: {type: mongoose.Schema.Types.ObjectId, ref: 'ChipPage'},
        server: mongoose.Schema.Types.ObjectId,
        side: mongoose.Schema.Types.ObjectId,
        need_confirmation: {type:Boolean, default:false},
        confirmed_by: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
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

mainStatsSchema.post('save', function () {
    global.io.sockets.in('main-stats').emit('status', {updated: 1});
});

mainStatsSchema.plugin(AutoIncrement, {inc_field: 'main_stat_id'});
mainStatsSchema.plugin(dataTables, {
    totalKey: 'recordsTotal',
    dataKey: 'data'
});
const MainStats = mongoose.model('MainStats',mainStatsSchema);
module.exports = MainStats;