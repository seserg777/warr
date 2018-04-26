'use strict';
const UnitPay = require('unitpay');
const qs     = require('qs');

const u = new UnitPay({
    secretKey: process.env.UNITPAY_SECRET_KEY,
    publicKey: process.env.UNITPAY_PUBLIC_KEY
});




exports.pay = async (res, req, next, order) => {
    //let payLink = u.form(order.sum, order.order_id, order.description);
    let params = {
        paymentType: 'card',
        account: order.order_id,
        currency: 'RUB',
        desc: order.description,
        sum: order.sum,
        ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        projectId: process.env.UNITPAY_PROJECTID,
        resultUrl: 'https://'+req.headers.host+'/order/'+order._id,
        locale: 'ru'
    };
   // console.log("IP FOR UNITPAY: ", params.ip);
    try {
        let response = await u.api('initPayment', params);
        return res.redirect(response.result.redirectUrl+'&resultUrl=https://'+req.headers.host+'/order/'+order._id);
    } catch (e) {
        req.flash('errors', {msg: e.message});
        return res.redirect('/');
    }
};