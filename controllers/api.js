'use strict';
const validator = require('validator');
const chatHelper = require('../helpers/chat');
const OrderController = require('../controllers/order');
const Order = require('../models/Order');
const Operations = require('../models/Operations');
const User = require('../models/User');
const unitpay = require('unitpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Helper = require('../helpers/helper');


exports.postYandex = async (req, res, next) => {
    try {

        if(!('amount' in req.body))
            throw new Error('Payment amount not found');

        if(!('label' in req.body))
            throw new Error('Order number found');

        if(!('sha1_hash' in req.body))
            throw new Error('Hash number found');

        let params = [
            req.body.notification_type || "",
            req.body.operation_id || "",
            req.body.amount || "",
            req.body.currency || "",
            req.body.datetime || "",
            req.body.sender || "",
            req.body.codepro || "",
            "/onnq2Cox93YMa7kc2LKm+Hh",
            req.body.label || ""
        ];
        let pramstring = params.join('&');
        let sha1_hash = crypto.createHash('sha1').update(pramstring).digest('hex');

        if(sha1_hash !== req.body.sha1_hash)
            throw new Error('Hash not match.');


        let order = await Order.findOne({order_id: req.body.label}).populate('_payeer _seller');

        if(!order || !order.sum)
            throw new Error('Order not found!');

        let yandex_sum = parseFloat(req.body.withdraw_amount);

        if(order.status !== Helper.statusEnum.ORDER_CREATED) {
            throw new Error('Order already paid or closed!');
        }

        await OrderController.afterPay(req, res, next, yandex_sum, req.body.sender, 'yandex', order);

        res.status(200).send('SUCCESS');

    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    }
};


exports.getWebmoney = async (req, res, next) => {
    //console.log(req.body);
    try {
        let purse = req.params.wallet;

        if(!('LMI_PAYEE_PURSE' in req.body))
            throw new Error('Payee purse not found');

        if(req.body.LMI_PAYEE_PURSE[0] !== purse[2].toUpperCase())
            throw new Error('OMFG... WTF u are doing? reported....');

        if(!('LMI_PAYMENT_AMOUNT' in req.body))
            throw new Error('Payment amount not found');

        if(!('LMI_PAYMENT_NO' in req.body))
            throw new Error('Order number found');
        let order = await Order.findOne({order_id: req.body.LMI_PAYMENT_NO}).populate('_payeer _seller');
        if(!order || !order.sum)
            throw new Error('Order not found!');

        let webmoney_sum = parseFloat(req.body.LMI_PAYMENT_AMOUNT);

        if(order.status !== Helper.statusEnum.ORDER_CREATED) {
            throw new Error('Order already paid or closed!');
        }

        if('LMI_PREREQUEST' in req.body && req.body.LMI_PREREQUEST === '1') {
                res.send('YES');
        } else if('LMI_HASH2' in req.body){

            let params = [
                req.body.LMI_PAYEE_PURSE ,
                req.body.LMI_PAYMENT_AMOUNT ,
                req.body.LMI_PAYMENT_NO ,
                req.body.LMI_MODE ,
                req.body.LMI_SYS_INVS_NO ,
                req.body.LMI_SYS_TRANS_NO ,
                req.body.LMI_SYS_TRANS_DATE ,
                "5ho7595356ko009", // LMI_SECRET_KEY
                req.body.LMI_PAYER_PURSE ,
                req.body.LMI_PAYER_WM ,
            ];

            let hash = crypto.createHash('sha256').update(params.join(';')).digest('hex').toUpperCase();
            if(hash === req.body.LMI_HASH2) {
                await OrderController.afterPay(req, res, next, webmoney_sum, req.body.LMI_PAYER_PURSE, 'webmoney', order);
                res.send('YES');
            } else {

                throw new Error("Not valid hash string");
            }

        } else {

            throw new Error('Error on creating payment.')
        }


    } catch(e) {
        console.error(e);
        res.status(500);
        res.send(e.message);
    }
};

exports.getUnitpay = async (req, res, next) => {

    try {
        console.log(req.query);
        if (!req.query.method || !validator.isIn(req.query.method.toLowerCase(), ['check', 'pay'])) {
            throw new Error("Bad request.");
        }

        let params = req.query.params;
        let order_id = validator.toInt(params.account);

        if (!order_id || order_id < 0) {
            throw new Error("Failed to find order id");
        }

        let order = await Order.findOne({order_id: order_id}).populate('_payeer _seller');

        if(!order || !order._id) {
            throw new Error("Order not found.");
        }

        if(order.status !== Helper.statusEnum.ORDER_CREATED) {
            throw new Error('Order already payid or closed! Order status: '+order.status);
        }

        if (req.query.method.toLowerCase() === "check") {

            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({"result": {"message": "Запрос успешно обработан"}}));

        } else {

            if(!params.payerSum || !validator.isFloat(params.payerSum)) {
                throw new Error("Sum not valid");
            }

            let unitpay_sum = parseFloat(params.payerSum);


            let config = {};

            if(params.projectId === process.env.UNITPAY_PROJECTID) {
                config = {
                    secretKey: process.env.UNITPAY_SECRET_KEY,
                    publicKey: process.env.UNITPAY_PUBLIC_KEY
                };
            } else {
                config = {
                    secretKey: process.env.UNITPAY_SECRET_KEY_SMS,
                    publicKey: process.env.UNITPAY_PUBLIC_KEY_SMS
                };
            }

            const u = new unitpay(config);

            let sign = u.getSignature(params, req.query.method);

            if(sign !== params.signature) {
                throw new Error("Signature not match.")
            }

            await OrderController.afterPay(req, res, next, unitpay_sum, ' - UnitPay - ', 'qiwi', order);

            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({"result": {"message": "Запрос успешно обработан"}}));

        }

    } catch(err) {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({"error": {"message": err.message}}));
    }
};