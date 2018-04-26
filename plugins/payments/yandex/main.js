'use strict';
const crypto = require('crypto');
//const Buffer = require('buffer');

exports.pay = async (res, req, next, order, ps) => {
    let wallet = '410014522351214';

    let form = [
        {
            name: 'receiver',
            value: wallet
        },
        {
            name: 'sum',
            value: order.sum
        },
        {
            name: 'label',
            value: order.order_id
        },
        {
            name: 'formcomment',
            value:  order.description || ''
        },
        {
            name: 'short-dest',
            value:  order.description || ''
        },
        {
            name: 'quickpay-form',
            value: 'shop'
        },
        {
            name: 'targets',
            value: 'Оплата заказа #'+order.order_id,
        },
        {
            name: 'need-fio',
            value: 'false'
        },
        {
            name: 'need-email',
            value: 'false'
        },
        {
            name: 'need-phone',
            value: 'false'
        },
        {
            name: 'need-address',
            value: 'false'
        },
        {
            name: 'paymentType',
            value: 'PC'
        },
        {
            name: 'successURL',
            value: 'https://'+req.headers.host+'/order/'+order._id
        }
    ];
    let html_form = '';
    for(let param of form) {
        html_form += '<input type="hidden" name="'+param.name+'" value="'+param.value+'">';
    }
    res.send(
        `
        <html> 
        <head> 
        <title>Pay</title> 
        </head> 
        <body onload="document.pay.submit()"> 
        <form id="pay" name="pay" method="POST" action="https://money.yandex.ru/quickpay/confirm.xml"> 
        <p>Перенаправление на сайте Yandex для совершения платежа...</p> 
        <p>
          ${html_form}
        </p> 
        <p>
         <input type="submit" value="submit">
         </p> 
        </form> 
        </body> 
        </html>
`
    );
};