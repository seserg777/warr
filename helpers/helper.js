'use strict';
const validator = require('validator');
const _ = require('lodash');

exports.OperationWallet = (wallet) =>{
    let payeer_ps='';
    switch(wallet) {
        case "qiwi":
            payeer_ps = 'QIWI';
            break;
        case "yandex":
            payeer_ps = 'Yandex.Money';
            break;
        case "webmoney":
            payeer_ps = 'Webmoney';
            break;
        case "play4play":
            payeer_ps = 'Play4Pay';
            break;
        default:
            payeer_ps = 'Balance';
            break
    }

    return payeer_ps;
};


exports.statusEnum = {
    ORDER_CREATED: 1,
    ORDER_CANCELED: 2,
    ORDER_PAID: 3,
    ORDER_CLOSED: 4,
    ORDER_WAITING_FOR_PAYMENT_SYSTEM: 5,
    ORDER_REFUNDED: 6,
    ORDER_WAITING_FOR_ADMIN_ACCEPT: 7,
};

exports.TextStatus = (status) => {
    switch(status) {
        case exports.statusEnum.ORDER_CREATED:
            return 'не оплачен';
            break;
        case exports.statusEnum.ORDER_CANCELED:
            return 'отменён';
            break;
        case exports.statusEnum.ORDER_PAID:
            return 'оплачен';
            break;
        case exports.statusEnum.ORDER_CLOSED:
            return 'закрыт';
            break;
        case exports.statusEnum.ORDER_WAITING_FOR_PAYMENT_SYSTEM:
            return 'оплачиватеся';
            break;
        case exports.statusEnum.ORDER_REFUNDED:
            return 'возврат';
            break;
        case exports.statusEnum.ORDER_WAITING_FOR_ADMIN_ACCEPT:
            return 'проверка оплаты';
            break;
        default:
            return '';
            break;
    }
};

exports.legitString = (text="", length=0, replaceUrls=false) => {

    if(length>0) {
        text = text.slice(0,length);
    }

    text = text.replace(/([^a-zA-Zа-я0-9\s\:\\\/\?\=\-\+\|\%\₽\$\%\#\~\`\'\"\;\<\>\№\\[\]\.\,\_\!\(\)]+)/gi, '');
    let words_array = text.split(' ');
    text='';
    for (let word of words_array) {

        text += _(word).truncate(10) + ' ';
    }
    text = text.trim();
   // text = _(text).truncate(13);//text.replace(/(\b(\w{15,})\b(\s|$))/g,'');
    //console.log(text);
    text = validator.escape(text);
    text = text.replace(/\&\#x2F\;/g,'/');

    if(replaceUrls) {
        text = text.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1'>$1</a>");
    }
    text = text.replace(/(?:\r\n|\r|\n)/g,"<br />");

    return text;
};


