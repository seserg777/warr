'use strict';
const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);
const Helper = require('../helpers/helper');
const chatHelper = require('../helpers/chat');
const User = require('./User');
const Chip = require('./Chip');
var smsc = require('node-smsc')({
    login: 'aimtuxp',
    password: '8f6ef52db33f1e3c3d0ff4747c84b49a',
    hashed: true,
});


const orderSchema = new mongoose.Schema({
    type: String,
    order_id: Number,
    lot: {type: mongoose.Schema.Types.Mixed},
    chip: {type: mongoose.Schema.Types.Mixed},
    _payeer: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    _seller: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    _game: {type: mongoose.Schema.Types.ObjectId, ref: 'Game'},
    _chip_page: {type: mongoose.Schema.Types.ObjectId, ref: 'ChipPage'},
    _lot_page: {type: mongoose.Schema.Types.ObjectId, ref: 'LotPage'},
    status: Number,
    sell_count: Number,
    sum: Number,
    release_sum: Number, // sum without comission
    sum_rub: Number,
    ref_back: {type: Number, default: 0},
    price: Number,
    player: String,
    description: String,
    paymentSystem: {type: mongoose.Schema.Types.ObjectId, ref: 'PaymentSystem'},
},
    {
        timestamps: true
    });


orderSchema.pre('save', function(next)  {
    let order = this.toObject();
    if(this.isModified("status") && this.status === Helper.statusEnum.ORDER_PAID) {


        User.findById(this._payeer).exec((err, user) => {
            chatHelper.SystemMessage(
                'Покупатель <a href="/users/' + user._id.toString() + '">' + user.username + '</a> оплатил <a href="/order/' + order._id.toString() + '">заказ #' + order.order_id + '</a>. ' + order.description + '<br>' + '<a href="/users/' + user._id.toString() + '">' + user.username + '</a>, не забудьте потом нажать кнопку «Подтвердить получение».',
                [order._seller._id || order._seller, order._payeer._id || order._payeer]
            );
        });

        User.findById(this._seller).exec((err, seller) => {
            if(seller.sms_notifications && seller.sms_notifications.after_purchase && seller.phone && seller.phone.number ) {
                smsc.send({
                    phones: seller.phone.number,
                    mes: `У вас на Play4Pay оплачен новый заказ №${order.order_id}!`,
                });
            }
        });

        if(order.type === 'chip') {
            Chip.findById(order.chip._id).exec((err, chip) => {
                chip.count -= order.sell_count;
                   chip.save();
            });

        }
    }

    if(this.isModified("status") && this.status === Helper.statusEnum.ORDER_REFUNDED) {
        if(order.type === 'chip') {
            Chip.findById(order.chip._id).exec((err, chip) => {
                if(chip) {
                    chip.count += order.sell_count;
                    chip.save();
                }
            });

        }

    }
    if(this.isModified("status")) {
        let payeer_id =  order._payeer._id || order._payeer;
        payeer_id = payeer_id.toString();
        let seller_id =  order._seller._id || order._seller;
        seller_id = seller_id.toString();
        global.io.in(payeer_id).emit('order-status', order._id);
        global.io.in(seller_id).emit('order-status', order._id);
    }
        next();

});
orderSchema.plugin(AutoIncrement, {inc_field: 'order_id'});

const Order = mongoose.model('Order',orderSchema);

module.exports = Order;
