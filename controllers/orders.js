'use strict';
const Order = require('../models/Order');
const moment = require('moment');
const Helper = require('../helpers/helper');


exports.getPurchases = (req,res,next) => {
    Order
        .find({_payeer: req.user._id, status: {$ne: Helper.statusEnum.ORDER_CREATED}})
        .populate('_chip _lot _payeer _seller _game _chip_page _lot_page paymentSystem').sort({createdAt:-1})
        .exec((err, orders) => {

            if(err) return next(err);

            res.render('orders/purchases', {
                orders: orders,
                Helper: Helper,
                moment: moment,
                title: "Мои покупки",
                menuCode: 104
            });
        });

};

exports.getSales = (req,res,next) => {
    Order
        .find({_seller: req.user._id, status: {$ne: Helper.statusEnum.ORDER_CREATED}})
        .populate('_chip _lot _payeer _seller _game _chip_page _lot_page paymentSystem').sort({createdAt:-1})
        .exec((err, orders) => {

            if(err) return next(err);

            res.render('orders/sales', {
                title: "Мои продажи",
                Helper: Helper,
                orders: orders,
                moment: moment,
                menuCode: 105
            });
        });
};