'use strict';
const crypto = require('crypto');
//const Buffer = require('buffer');

exports.pay = async (res, req, next, order, ps) => {
    let wallet = 'R540070274058';

    if(ps && ps.currency) {

        switch(ps.currency) {
            case 'RUB':
                wallet = 'R540070274058';
                break;
            case 'USD':
                wallet = 'Z655583008873';
                break;
            case 'EUR':
                wallet = 'E736478234276';
                break;
            case 'UAH':
                wallet = 'U627245880184';
                break;
        }
    }
    let form = [
        {
            name: 'LMI_PAYEE_PURSE',
            value: wallet
        },
        {
            name: 'LMI_PAYMENT_AMOUNT',
            value: order.sum
        },
        {
            name: 'LMI_PAYMENT_NO',
            value: order.order_id
        },
        {
            name: 'LMI_PAYMENT_DESC_BASE64',
            value:  Buffer.from(order.description || '', 'utf8').toString('base64')
        },
        {
            name: 'LMI_SIM_MODE',
            value: '0'
        },
        {
            name: 'LMI_SUCCESS_URL',
            value: 'https://'+req.headers.host+'/order/'+order._id,
        },
        {
            name: 'LMI_SUCCESS_METHOD',
            value: '2' // LINK
        },
        {
            name: 'LMI_FAIL_URL',
            value: 'https://'+req.headers.host+'/order/'+order._id+'?error=1'
        },
        {
            name: 'LMI_FAIL_METHOD',
            value: '2' // LINK
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
        <form id="pay" name="pay" method="POST" action="https://merchant.webmoney.ru/lmi/payment.asp"> 
        <p>Перенаправление на сайте Webmoney для совершения платежа...</p> 
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