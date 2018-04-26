'use strict';
const mongoose = require('mongoose');

const OBookingSchema = new mongoose.Schema({
    type: {type:String, default: 'chip', enum: ["lot", "chip"]},
    lot: {type: mongoose.Schema.Types.ObjectId},
    reservation: {type:Number, default: 0},
    order: {type: mongoose.Schema.Types.ObjectId, ref: 'Order'},
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    time: {type:Date, default: Date.now}
});




const OrdersBooking = mongoose.model('OrdersBooking',OBookingSchema);

module.exports = OrdersBooking;
/**
 * Created by Smoozy on 13.07.2017.
 */
