'use strict';

const MainStats = require('../models/MainStats');
const SellersStats = require('../models/SellersStats');
const ReferralStats = require('../models/ReferralStats');
const ProfitStats = require('../models/ProfitStats');
const RefundStats = require('../models/RefundStats');

const Order = require('../models/Order');
const OrderBooking = require('../models/OrdersBooking');
const Chip = require('../models/Chip');
const Lot = require('../models/Lot');
const config = require('../models/Config');
const ps = require('../models/PaymentSystem');
const mongoose = require('mongoose');
const moment = require('moment');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Operations = require('../models/Operations');
const chatHelper = require('../helpers/chat');
const Helper = require('../helpers/helper');
const percent = require('percent-value');
const validator = require('validator');


exports.postOrderPay = (req, res, next) => {
    if(!req.body.oid || !mongoose.Types.ObjectId.isValid(req.body.oid))
        return next('Не достаточно параметров.');
    Order.findOne({_id: req.body.oid}).populate('paymentSystem').exec((err, order) => {
        if (err) return next(err);
        if(!order) return next("Заказ не найден!");
        if(order._payeer.toString() != req.user._id.toString())
            return next('Не возможно оплатить чужой заказ.');
        const payment_system = require('..' + order.paymentSystem.pay_system_file);
        payment_system.pay(res, req, next, order, order.paymentSystem);
    });
};

exports.postCreateOrder = (req, res, next) => {
    if( (req.body.chip_id && (
            !mongoose.Types.ObjectId.isValid(req.body.chip_id )
            || !req.body.sum
            || !req.body.payment_method
            || !mongoose.Types.ObjectId.isValid(req.body.payment_method)
            || !req.body.charname
            || !req.body.type
        )) || (req.body.lot_id && (
            !mongoose.Types.ObjectId.isValid(req.body.lot_id )
            || !req.body.type
            || !req.body.payment_method
            || !mongoose.Types.ObjectId.isValid(req.body.payment_method)
    ))) return next(new Error("Недостаточно параметров"));
    if(req.body.type === 'chip') {
        req.body.sum = req.body.sum.replace(',','').replace(' ','');
        Chip.findOne({_id: req.body.chip_id}).populate('_game _chip_page _owner').exec((err, _chip) => {
            if(!_chip) return next(new Error("Не найдено предложение."));
            ps.findOne({_id: req.body.payment_method}).exec((err, _ps) => {
                if(!_ps) return next(new Error("Нет такой платежной системы."));
                if(!_ps.active) return next(new Error("Нет такой платежной системы."));
                config.findOne({param: 'Courses'}).exec((err, courses) => {
                    if (err) return next(err);

                    if (!courses.value[_ps.currency])
                        return next(new Error("Не найдена валюта установленная в платёжной системе."));
                    // _chip.price - всегда в рублях, поэтому делим
                    let price_in_vault = _chip.price / parseFloat(courses.value[_ps.currency]);

                    let commission = percent(parseFloat(process.env.COMMISSION) + _chip._chip_page.commission + parseFloat(_ps.commision)).from(price_in_vault);
                    let price_per_one = price_in_vault+commission;


                    let min_order_vault = _chip.min_order / courses.value[_ps.currency];
                    let max_order_vault = (_chip.count * price_per_one)/ courses.value[_ps.currency];

                    if(max_order_vault >= min_order_vault) {
                        //console.log( {msg: `Неверная сумма! Минимиальная - ${min_order_vault.toFixed(2)} ${_ps.currency_title},  максимальная - ${max_order_vault.toFixed(3)} ${_ps.currency_title}.`});
                        if (!validator.isFloat(req.body.sum, {
                                min: parseFloat(min_order_vault.toFixed(2)),
                                max: parseFloat(max_order_vault.toFixed(2))
                            })) {
                            req.flash('errors', {msg: `Неверная сумма! Минимиальная - ${min_order_vault.toFixed(2)} ${_ps.currency_title},  максимальная - ${max_order_vault.toFixed(2)} ${_ps.currency_title}.`});
                            return res.redirect('/chips/offer/' + req.body.chip_id + '?pay=' + req.body.ipay + '&nick=' + req.body.charname);
                        }

                    } else {
                        if (!validator.isFloat(req.body.sum, {
                                max: parseFloat(max_order_vault.toFixed(2))
                            })) {
                            req.flash('errors', {msg: `Неверная сумма! Максимальная - ${max_order_vault.toFixed(2)} ${_ps.currency_title}.`});
                            return res.redirect('/chips/offer/' + req.body.chip_id + '?pay=' + req.body.ipay + '&nick=' + req.body.charname);
                        }
                    }
                    req.body.sum = parseFloat(req.body.sum); // Сумма которая вышла на сайте с учетом комиссии


                    let end_count = parseFloat((req.body.sum/price_per_one).toFixed(2));

                    if(_chip.count+1 <= end_count) {
                        req.flash('errors', {msg: "Не возможно купить больше чем есть у продавца!"});
                        res.redirect('');
                    }

                    let order = new Order();
                    order.chip = _chip;
                    order._chip_page = _chip._chip_page._id;
                    order._game = _chip._game._id;
                    order._payeer = req.user._id;
                    order._seller = _chip._owner._id;
                    order.status = Helper.statusEnum.ORDER_CREATED;
                    order.type = 'chip';
                    order.sell_count = end_count;
                    order.sum = parseFloat(req.body.sum);
                    order.sum_rub = order.sum * courses.value[_ps.currency];
                    order.release_sum = end_count * _chip.price;

                    order.player = req.body.charname.trim();
                    order.price = price_in_vault;
                    order.paymentSystem = _ps._id;
                    order.description = _chip._game.title+", "
                        +_chip._chip_page.title+", "
                        +_chip._chip_page.servers.id(_chip.server_id).name + ", "
                        +order.sell_count +_chip._chip_page.currency_sell_sufix + ", "
                        +order.player;
                    //console.log(order);
                    order.save((err) => {
                        if (err) return next(err);

                        if(!req.user.balances[_ps.wallet])
                            req.user.balances[_ps.wallet] = 0;

                        // order.sum может быть в любой из валют, поэтому умножаем
                        let sum_diff = ( order.sum * parseFloat(courses.value[_ps.currency]) ) - req.user.balances[_ps.wallet];
                        // если разница больше 0 отправляем платить разницу
                        if(sum_diff > 0) {
                            order.sum = sum_diff;
                            const payment_system = require('..' + _ps.pay_system_file);
                            payment_system.pay(res, req, next, order, _ps);

                            new OrderBooking({
                                type: 'chip',
                                lot: order.chip._id,
                                reservation: order.sell_count,
                                order: order._id,
                                user: req.user._id
                            }).save();


                        // если разница меньше 0 или равна 0 платим с баланса.
                        } else if(sum_diff <= 0) {
                            User.findOne({_id: req.user.id}, (err, user) => {
                                if(err) return next(err);
                                user.balances[_ps.wallet] -= order.sum * parseFloat(courses.value[_ps.currency]);

                                order.status = (order.sum_rub > 2999) ?
                                    Helper.statusEnum.ORDER_WAITING_FOR_ADMIN_ACCEPT :
                                    Helper.statusEnum.ORDER_PAID;



                                let MainStat = new MainStats({
                                    sum: order.sum_rub,
                                    operation: 'incoming',
                                    order: order._id,
                                    user: order._payeer._id || order._payeer,
                                    ps: order.paymentSystem._id || order.paymentSystem,
                                    game: order._game._id || order._game,
                                    type: order.type,
                                    server: order[order.type].server_id,
                                    side: order[order.type].side_id,
                                    need_confirmation: (order.sum_rub > 2999),
                                    searchable: {
                                        username: req.user.username,
                                        date: moment(order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: order.description
                                    }
                                }

                                );

                                if(order.type === 'chip')
                                    MainStat.chip_page = order['_chip_page']._id || order['_chip_page'];
                                else
                                    MainStat.lot_page = order['_lot_page']._id || order['_lot_page'];

                                MainStat.save();

                                user.save((err) => {
                                    if (err) return next(err);
                                    order.save((err) => {
                                        if (err) return next(err);
                                        req.flash('info', {msg: 'Вы успешно оплатили заказ #'+order.order_id + ' с личного счета на Play4Pay.'});
                                        res.redirect('/order/'+order._id);
                                    });

                                    User.update({_id: _chip._owner._id}, {
                                        $inc: {
                                            'counters.payorders' : 1
                                        }
                                    }).exec();

                                    User.update({_id: req.user._id},
                                        {
                                            $push: {
                                                operations: {
                                                    type: 'out',
                                                    subject: 'Оплата заказа #'+order.order_id,
                                                    status: 'success',
                                                    sum: order.sum * parseFloat(courses.value[_ps.currency]),
                                                    ps: Helper.OperationWallet(_ps.wallet)
                                                }
                                            },
                                            $inc: {
                                                'counters.myorders' : 1
                                            }
                                        }).exec();
                                });





                            });
                        }

                    });
                });
            });


        });
    } else {
        Lot.findOne({_id:req.body.lot_id}).populate('_game _lot_page _owner').exec((err, _lot )=> {
            if(!_lot) return next(new Error("Не найдено предложение."));
            ps.findOne({_id: req.body.payment_method}).exec((err, _ps) => {
                if(!_ps) return next(new Error("Нет такой платежной системы."));
                if(!_ps.active) return next(new Error("Нет такой платежной системы."));

                config.findOne({param: 'Courses'}).exec((err, courses) => {
                    //console.log(_lot);
                    if (!courses.value[_ps.currency])
                        return next(new Error("Не найдена валюта установленная в платёжной системе."));
                    let comission = percent(parseFloat(process.env.COMMISSION) + _lot._lot_page.commission + parseFloat(_ps.commision)).from(_lot.price);
                    if (err) return next(err);
                    let order = new Order();
                    order.lot = _lot;
                    order._game = _lot._game._id;
                    order._payeer = req.user._id;
                    order._seller = _lot._owner._id;
                    order._lot_page = _lot._lot_page._id;
                    order.sum = (_lot.price + comission) / parseFloat(courses.value[_ps.currency]);
                    order.sum = parseFloat(order.sum.toFixed(2));
                    order.sum_rub = (_lot.price + comission);

                    order.release_sum = _lot.price;
                    order.paymentSystem = _ps._id;
                    order.type = 'lot';
                    order.status = Helper.statusEnum.ORDER_CREATED;
                    order.description = _lot._game.title+", "
                        +_lot._lot_page.title+", "
                        +_lot._lot_page.servers.id(_lot.server).name + ", "
                        +_lot.short_desc;

                    //console.log(order);
                    order.save((err) => {
                        if (err) return next(err);
                        if(!req.user.balances[_ps.wallet])
                            req.user.balances[_ps.wallet] = 0;
                        let sum_diff = order.sum - req.user.balances[_ps.wallet];
                        // если разница больше 0 отправляем платить разницу
                        if(sum_diff > 0) {
                            order.sum = sum_diff;
                            const payment_system = require('..' + _ps.pay_system_file);
                            payment_system.pay(res, req, next, order, _ps);

                            new OrderBooking({
                                type: 'lot',
                                lot: order.lot._id,
                                order: order._id,
                                user: req.user._id
                            }).save();
                            // если разница меньше 0 или равна 0 платим с баланса.
                        } else if(sum_diff <= 0) {
                            User.findOne({_id: req.user.id}, (err, user) => {
                                if(err) return next(err);
                                user.balances[_ps.wallet] -= order.sum;
                                user.counters.myorders += 1;
                                order.status = (order.sum_rub > 2999) ?
                                    Helper.statusEnum.ORDER_WAITING_FOR_ADMIN_ACCEPT :
                                    Helper.statusEnum.ORDER_PAID;

                                user.save((err) => {
                                    if (err) return next(err);
                                    order.save((err) => {
                                        if (err) return next(err);
                                        req.flash('info', {msg: 'Вы успешно оплатили заказ #'+order.order_id + ' с личного счета на Play4Pay.'});
                                        res.redirect('/order/'+order._id);
                                    });
                                });

                                let MainStat = new MainStats({
                                    sum: order.sum_rub,
                                    operation: 'incoming',
                                    order: order._id,
                                    user: order._payeer._id || order._payeer,
                                    ps: order.paymentSystem._id || order.paymentSystem,
                                    game: order._game._id || order._game,
                                    type: order.type,
                                    server: order[order.type].server_id,
                                    side: order[order.type].side_id,
                                    need_confirmation: (order.sum_rub > 2999),
                                    searchable: {
                                        username: req.user.username,
                                        date: moment(order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: order.description
                                    }
                                });

                                if(order.type === 'chip')
                                    MainStat.chip_page = order['_chip_page']._id || order['_chip_page'];
                                else
                                    MainStat.lot_page = order['_lot_page']._id || order['_lot_page'];

                                MainStat.save();


                                User.update({_id: _lot._owner._id}, {
                                    $inc: {
                                        'counters.payorders' : 1
                                    }
                                }).exec();

                                User.update({_id: req.user._id},
                                    {
                                        $push: {
                                            operations: {
                                                type: 'out',
                                                subject: 'Оплата заказа #'+order.order_id,
                                                status: 'success',
                                                sum: order.sum,
                                                ps: Helper.OperationWallet(_ps.wallet)
                                            }
                                        },
                                        $inc: {
                                            'counters.myorders' : 1
                                        }
                                    }).exec();




                            });
                        }
                    });

                });
            });
        });
    }

};


exports.postCloseOrder = (req, res, next) => {
    if(!req.body.oid || !mongoose.Types.ObjectId.isValid(req.body.oid)) {
        req.flash('errors', {msg: "Ошибка"});
        return res.redirect('/');
    }
    Order.findOne({_id: req.body.oid}).populate("_seller _payeer paymentSystem").exec((err, _order) => {
        if(err) return next(err);
        if(!_order) {
            req.flash('errors', {msg: "Ошибка! Закза не найден."});
            return res.redirect('/');
        }
        if(req.user._id.toString() === _order._seller._id.toString() || (req.query.hasOwnProperty('refund') && req.user.isAdmin)) { // Возврат денег.
            if(_order.status !== Helper.statusEnum.ORDER_PAID && _order.status !== Helper.statusEnum.ORDER_CLOSED) {
                req.flash('errors', {msg: 'Вы не можете возвращать деньги не оплаченных заказов.'});
                return res.redirect('/order/'+_order._id);
            }

            if(_order.status === Helper.statusEnum.ORDER_PAID ) { // если заказ ещё не подтверждён покупателем
                _order.status = Helper.statusEnum.ORDER_CLOSED;
                _order.save((err) => {
                    if (err) return next(err);
                    User.findOne({_id: _order._payeer._id}).exec((err, payeer) => {
                        config.findOne({param:'Courses'}).exec((err, courses) => {
                            payeer.balances[_order.paymentSystem.wallet] += _order.sum * courses.value[_order.paymentSystem.currency];
                            payeer.save((err) => {
                                if (err) return next(err);
                                // добавляем сообщение в чат о получении
                                _order.status = Helper.statusEnum.ORDER_REFUNDED;
                                _order.save();
                                User.update({_id: _order._seller._id}, {

                                    $inc: {
                                        'counters.payorders' : -1
                                    }
                                }).exec();


                                let payeer_ps='';
                                switch(_order.paymentSystem.wallet) {
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


                                User.update({_id: _order._payeer._id}, {
                                    $push: {
                                        operations: {  type: 'in',
                                            subject: 'Вовзрат денег с заказа #'+_order.order_id,
                                            status: 'refunded',
                                            sum: _order.sum,
                                            ps: payeer_ps
                                        }
                                    },
                                    $inc: {
                                        'counters.myorders' : -1
                                    }
                                }).exec();

                                let MainStat = new MainStats({
                                    sum: _order.sum_rub,
                                    operation: 'refund',
                                    order: _order._id,
                                    user: _order._payeer._id || _order._payeer,
                                    ps: _order.paymentSystem._id || _order.paymentSystem,
                                    game: _order._game._id || _order._game,
                                    type: _order.type,
                                    server: _order[_order.type].server_id,
                                    side: _order[_order.type].side_id,
                                    need_confirmation: false,
                                    searchable: {
                                        username: _order._payeer.username,
                                        date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: _order.description
                                    }
                                });

                                if(_order.type === 'chip')
                                    MainStat.chip_page = _order['_chip_page']._id || _order['_chip_page'];
                                else
                                    MainStat.lot_page = _order['_lot_page']._id || _order['_lot_page'];

                                MainStat.save();

                                let RefundStat = new RefundStats({
                                    sum: _order.sum_rub,
                                    operation: 'output',
                                    order: _order._id,
                                    user: _order._seller._id || _order._seller,
                                    purse: _order.paymentSystem.wallet,
                                    need_confirmation: false,
                                    searchable: {
                                        username: _order._seller.username,
                                        date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: _order.description
                                    }
                                });
                                RefundStat.save();
                                if(_order.ref_back > 0 && _order._payeer.invitedBy) {
                                    User.findById(_order._payeer.invitedBy).exec((err, inviter) => {
                                        if(inviter.referral.enabled) {
                                            let RefStat = new ReferralStats({
                                                sum: _order.ref_back,
                                                operation: 'output',
                                                order: _order._id,
                                                user: _order._payeer.invitedBy,
                                                purse: _order.paymentSystem.wallet,
                                                need_confirmation: false,
                                                searchable: {
                                                    date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                                    description: _order.description
                                                }
                                            });
                                            RefStat.save();
                                            inviter.operations.push({
                                                type: 'out',
                                                subject: 'Партнеру ' +_order._payeer.username + ' вернули деньги.',
                                                status: 'success',
                                                sum: _order.ref_back,
                                                ps: 'Balance'
                                            });
                                            inviter.referral.deals_sum -= _order.ref_back;
                                            inviter.referral.deals -= 1;
                                            inviter.referral.balance -= _order.ref_back;
                                            inviter.save();
                                        }
                                    });

                                }
                                /*
                                let ProfitStat = new ProfitStats({
                                    sum: _order.sum_rub - _order.release_sum - _order.ref_back,
                                    operation: 'output',
                                    order: _order._id,
                                    user: _order._payeer._id,
                                    wallet: Helper.OperationWallet(_order.paymentSystem.wallet),
                                    purse: 'сайт',
                                    need_confirmation: false,
                                    searchable: {
                                        username: _order._payeer.username,
                                        date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: _order.description
                                    }
                                });
                                ProfitStat.save();


                                let SellerStat = new SellersStats({
                                    sum: _order.release_sum,
                                    operation: 'output',
                                    order: _order._id,
                                    user: _order._seller._id,
                                    wallet: Helper.OperationWallet(_order.paymentSystem.wallet),
                                    purse: 'сайт',
                                    need_confirmation: false,
                                    searchable: {
                                        username: _order._seller.username,
                                        date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: _order.description
                                    }
                                });
                                SellerStat.save();
                                 */
                                if(_order.type === 'chip')
                                    MainStat.chip_page = _order['_chip_page']._id || _order['_chip_page'];
                                else
                                    MainStat.lot_page = _order['_lot_page']._id || _order['_lot_page'];

                                MainStat.save();

                                chatHelper.SystemMessage(
                                    'Продавец <a href="/users/' + _order._seller._id.toString() + '">' + _order._seller.username + '</a> вернул деньги <a href="/order/' + _order._id.toString() + '">заказа #' + _order.order_id + '</a>' + ' на личный счет покупателю ' + '<a href="/users/' + _order._payeer._id.toString() + '">&nbsp;' + _order._payeer.username + '</a>',
                                    [_order._seller._id, _order._payeer._id]
                                );
                                return res.redirect('/order/' + _order._id);
                            });
                        });
                    });
                });
            } else if (_order.status === Helper.statusEnum.ORDER_CLOSED) {
                if( // если на любом из балансов меньше чем нужно для возврата, высылаем ошибку
                    _order._seller.balances['qiwi'] < _order.release_sum &&
                    _order._seller.balances['yandex'] < _order.release_sum &&
                    _order._seller.balances['webmoney'] < _order.release_sum

                ) {
                    req.flash('errors', {msg: 'Недостаточно средств.'});
                    return res.redirect('/order/'+_order._id);
                } else {
                    User.findOne({_id: _order._payeer._id}).exec((err, payeer) => {
                        config.findOne({param:'Courses'}).exec((err, courses) => {

                            payeer.balances[_order.paymentSystem.wallet] += _order.sum * courses.value[_order.paymentSystem.currency];

                            User.findOne({_id: _order._seller._id}).exec((err, seller)=> {

                                if( _order._seller.balances['qiwi'] >= _order.release_sum )
                                    seller.balances['qiwi'] -= _order.release_sum;
                                else if( _order._seller.balances['yandex'] >= _order.release_sum )
                                    seller.balances['yandex'] -= _order.release_sum;
                                else if( _order._seller.balances['webmoney'] >= _order.release_sum )
                                    seller.balances['webmoney'] -= _order.release_sum;

                                _order.status = Helper.statusEnum.ORDER_REFUNDED;
                                _order.save();

                                let payeer_ps='';
                                switch(_order.paymentSystem.wallet) {
                                    case "qiwi":
                                        payeer_ps = 'QIWI';
                                        break;
                                    case "yandex":
                                        payeer_ps = 'Yandex.Money';
                                        break;
                                    case "webmoney":
                                        payeer_ps = 'Webmoney';
                                        break;
                                    default:
                                        payeer_ps = 'Balance';
                                        break
                                }

                                User.update({_id: _order._payeer._id}, {
                                    $push: {
                                        operations: {  type: 'in',
                                            subject: 'Вовзрат денег с заказа #'+_order.order_id,
                                            status: 'refunded',
                                            sum: _order.sum,
                                            ps: payeer_ps
                                        }
                                    }
                                }).exec();

                                User.update({_id: _order._seller._id}, {
                                    $push: {
                                        operations: {  type: 'out',
                                            subject: 'Вовзрат денег с заказа #'+_order.order_id,
                                            status: 'refunded',
                                            sum: _order.release_sum,
                                            ps: payeer_ps
                                        }
                                    }
                                }).exec();

                                let MainStat = new MainStats({
                                    sum: _order.sum_rub,
                                    operation: 'refund',
                                    order: _order._id,
                                    user: _order._payeer._id || _order._payeer,
                                    ps: _order.paymentSystem._id || _order.paymentSystem,
                                    game: _order._game._id || _order._game,
                                    type: _order.type,
                                    server: _order[_order.type].server_id,
                                    side: _order[_order.type].side_id,
                                    need_confirmation: false,
                                    searchable: {
                                        username: _order._payeer.username,
                                        date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: _order.description
                                    }
                                });

                                if(_order.type === 'chip')
                                    MainStat.chip_page = _order['_chip_page']._id || _order['_chip_page'];
                                else
                                    MainStat.lot_page = _order['_lot_page']._id || _order['_lot_page'];

                                MainStat.save();

                                let RefundStat = new RefundStats({
                                    sum: _order.sum_rub,
                                    operation: 'output',
                                    order: _order._id,
                                    user: _order._seller._id || _order._seller,
                                    purse: _order.paymentSystem.wallet,
                                    need_confirmation: false,
                                    searchable: {
                                        username: _order._seller.username,
                                        date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: _order.description
                                    }
                                });
                                RefundStat.save();

                                if(_order.ref_back > 0 && _order._payeer.invitedBy) {
                                    User.findById(_order._payeer.invitedBy).exec((err, inviter) => {
                                        if(inviter.referral.enabled) {
                                            let RefStat = new ReferralStats({
                                                sum: _order.ref_back,
                                                operation: 'output',
                                                order: _order._id,
                                                user: _order._payeer.invitedBy,
                                                purse: _order.paymentSystem.wallet,
                                                need_confirmation: false,
                                                searchable: {
                                                    date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                                    description: _order.description
                                                }
                                            });
                                            RefStat.save();
                                            inviter.operations.push({
                                                type: 'out',
                                                subject: 'Партнеру ' +_order._payeer.username + ' вернули деньги.',
                                                status: 'success',
                                                sum: _order.ref_back,
                                                ps: 'Balance'
                                            });

                                            inviter.referral.balance -= _order.ref_back;
                                            inviter.referral.deals_sum -= _order.ref_back;
                                            inviter.referral.deals -= 1;

                                            inviter.save();
                                        }
                                    });

                                }

                                 let ProfitStat = new ProfitStats({
                                 sum: _order.sum_rub - _order.release_sum - _order.ref_back,
                                 operation: 'output',
                                 order: _order._id,
                                 user: _order._payeer._id,
                                 wallet: Helper.OperationWallet(_order.paymentSystem.wallet),
                                 purse: 'сайт',
                                 need_confirmation: false,
                                 searchable: {
                                 username: _order._payeer.username,
                                 date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                 description: _order.description
                                 }
                                 });
                                 ProfitStat.save();


                                let SellerStat = new SellersStats({
                                    sum:  _order.release_sum,
                                    operation: 'output',
                                    order: _order._id,
                                    user: _order._seller._id,
                                    wallet: Helper.OperationWallet(_order.paymentSystem.wallet),
                                    purse: 'сайт',
                                    need_confirmation: false,
                                    searchable: {
                                        username: _order._seller.username,
                                        date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                        description: _order.description
                                    }
                                });
                                SellerStat.save();

                                if(_order.type === 'chip')
                                    MainStat.chip_page = _order['_chip_page']._id || _order['_chip_page'];
                                else
                                    MainStat.lot_page = _order['_lot_page']._id || _order['_lot_page'];

                                MainStat.save();

                                payeer.save();
                                seller.save((err) => {
                                    chatHelper.SystemMessage(
                                        'Продавец <a href="/users/' + _order._seller._id.toString() + '">' + _order._seller.username + '</a> вернул деньги <a href="/order/' + _order._id.toString() + '">заказа #' + _order.order_id + '</a>' + ' на личный счет покупателю ' + '<a href="/users/' +  _order._payeer._id.toString() + '">&nbsp;' + _order._payeer.username + '</a>',
                                        [_order._seller._id, _order._payeer._id]
                                    );
                                    return res.redirect('/order/'+_order._id);
                                });
                            });
                        });



                    });
                }



            }


        }
        else if(req.user._id.toString() === _order._payeer._id.toString() || (req.query.hasOwnProperty('confirm') && req.user.isAdmin)) {
            // ПЕРЕДАЧА ДЕНЕГ ПРОДАВЦУ

            if(_order.status !== Helper.statusEnum.ORDER_PAID) {
                req.flash('errors', {msg: 'Вы не можете подтвердить получение не оплаченного заказа.'});
                return res.redirect('/order/'+_order._id);
            }

            User.findOne({_id: _order._seller._id}).exec((err, seller)=> {
                if (err) next(err);
                Order.findById(_order._id).populate('_chip_page _lot_page').exec((err,order) =>{

                if (err) next(err);
                let page = order['_' + order.type + '_page'];


                _order.status = Helper.statusEnum.ORDER_CLOSED;

                let bonus = percent(parseFloat(process.env.REFERAL_BONUS_PERCENT_FROM_COMMISSION)+page.ref_commission).from(_order.sum_rub - _order.release_sum);
                // РЕФКА
                if (_order._payeer.invitedBy && mongoose.Types.ObjectId.isValid(_order._payeer.invitedBy)) {
                    _order.ref_back = bonus;

                    User.findOne({_id: _order._payeer.invitedBy}, (err, inviter) => {
                        if (inviter.referral.enabled) {
                            // 10% от комиссии

                            inviter.referral.balance += bonus;
                            inviter.referral.deals_sum += _order.sum_rub;

                            inviter.referral.deals += 1;
                            inviter.referral.bonus_sum += bonus;
                            let user_operation = mongoose.Types.ObjectId();
                            inviter.operations.push({
                                _id: user_operation,
                                type: 'in',
                                subject: 'Получение прибыли от партнёра.' ,
                                status: 'success',
                                sum: bonus,
                                ps: 'Balance'
                            });

                            let Operation = new Operations({
                                type: 'balance',
                                user: inviter._id,
                                user_operation: user_operation,
                                sum: bonus,
                                in_out: 'in',
                                comment: 'Получение прибыли от партнёра по заказу #' + _order.order_id,
                                wallet: 'Balance'
                            });
                            Operation.save();

                            let RefStat = new ReferralStats({
                                sum: bonus,
                                operation: 'input',
                                order: _order._id,
                                user: inviter._id,
                                need_confirmation: false,
                                purse: _order.paymentSystem.wallet,
                                searchable: {
                                    username: inviter.username,
                                    date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                    description: 'Прибыль от ' + _order._payeer.username
                                }
                            });
                            RefStat.save();


                            inviter.save();
                        }
                    });
                }

                _order.save((err) => {
                    if (err) return next(err);
                    config.findOne({param: 'Courses'}).exec((err, courses) => {

                        let ps = "";
                        if (seller.accepting[_order.paymentSystem.wallet]) // Если продавец принимает ту платежку с которой оплатили
                        {
                            ps = _order.paymentSystem.wallet;
                            seller.balances[_order.paymentSystem.wallet] += _order.release_sum * courses.value[_order.paymentSystem.currency];
                        }
                        else if (seller.accepting['qiwi']) {
                            ps = "qiwi";
                            seller.balances['qiwi'] += _order.release_sum * courses.value[_order.paymentSystem.currency];
                        }
                        else if (seller.accepting['webmoney']) {
                            ps = 'webmoney';
                            seller.balances['webmoney'] += _order.release_sum * courses.value[_order.paymentSystem.currency];
                        }
                        else if (seller.accepting['yandex']) {
                            ps = 'yandex';
                            seller.balances['yandex'] += _order.release_sum * courses.value[_order.paymentSystem.currency];
                        }
                        else // Если продавец не выставил что принимать
                        {
                            ps = _order.paymentSystem.wallet;
                            seller.balances[_order.paymentSystem.wallet] += _order.release_sum * courses.value[_order.paymentSystem.currency];
                        }

                        if (!seller.saleSum)
                            seller.saleSum = _order.release_sum;
                        else
                            seller.saleSum += _order.release_sum;
                        let _ps = Helper.OperationWallet(ps);
                        let payeer_ps = Helper.OperationWallet(_order.paymentSystem.wallet);


                        User.update({_id: _order._payeer._id},
                            {
                                $inc: {
                                    'counters.myorders': -1,
                                    'deals_count': 1
                                }
                            }).exec();

                        User.update({_id: seller._id},
                            {
                                $push: {
                                    operations: {
                                        type: 'in',
                                        subject: 'Оплата заказа #' + _order.order_id,
                                        status: 'success',
                                        sum: _order.release_sum,
                                        ps: payeer_ps
                                    }
                                },
                                $inc: {
                                    'counters.payorders': -1,
                                    'deals_count': 1
                                }
                            }).exec();

                        let SellersStat = new SellersStats({
                            sum: _order.release_sum,
                            operation: 'input',
                            order: _order._id,
                            user: _order._seller._id || _order._seller,
                            need_confirmation: false,
                            wallet: _ps,
                            purse: 'сайт',
                            searchable: {
                                username: _order._seller.username,
                                date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                description: _order.description
                            }
                        });
                        SellersStat.save();

                        let ps_sum = percent(_order.sum_rub).from(_order.paymentSystem.commision);

                        let ProfitStat = new ProfitStats({
                            // Стоимость заказа - сумма отдававемая продавцу  - сумма которую забрала платежка - реф отчисления
                            sum: _order.sum_rub - _order.release_sum - ps_sum - _order.ref_back,
                            operation: 'input',
                            order: _order._id,
                            user: _order._seller._id || _order._seller,
                            need_confirmation: false,
                            wallet: payeer_ps,
                            purse: 'сайт',
                            searchable: {
                                username: _order._seller.username,
                                date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                description: _order.description
                            }
                        });
                        ProfitStat.save();


                        let MainStat = new MainStats({
                            sum: _order.sum_rub,
                            operation: 'outcoming',
                            order: _order._id,
                            user: _order._payeer._id || _order._payeer,
                            ps: _order.paymentSystem._id || _order.paymentSystem,
                            game: _order._game._id || _order._game,
                            type: _order.type,
                            server: _order[_order.type].server_id,
                            side: _order[_order.type].side_id,
                            need_confirmation: false,
                            searchable: {
                                username: _order._payeer.username,
                                date: moment(_order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                                description: _order.description
                            }
                        });

                        if (_order.type === 'chip')
                            MainStat.chip_page = _order['_chip_page']._id || _order['_chip_page'];
                        else
                            MainStat.lot_page = _order['_lot_page']._id || _order['_lot_page'];

                        MainStat.save();


                        seller.save((err) => {
                            if (err) return next(err);
                            // добавляем сообщение в чат о получении
                            chatHelper.SystemMessage(
                                'Покупатель <a href="/users/' + _order._payeer._id.toString() + '">' + _order._payeer.username + '</a> подтвердил выполнение <a href="/order/' + _order._id.toString() + '">заказа #' + _order.order_id + '</a>' + ' и отправил деньги продавцу' + '<a href="/users/' + seller._id.toString() + '">&nbsp;' + _order._seller.username + '</a>',
                                [_order._seller._id, _order._payeer._id]
                            );
                            setTimeout(function () {
                                chatHelper.SystemMessage(
                                    "Мы были бы очень признательны, если бы вы могли оставить отзыв о качестве предоставленных услуг на каком-нибудь из сайтов?<br />" +
                                    "От отзывов покупателей зависит судьба нашего проекта.<br />" +
                                    "Прошу пойти нам на встречу и помочь.<br />" +
                                    "Мы были бы вам очень признательны. <br />" +
                                    "Сможете сделать это сейчас? Спасибо за Ваше время.<br /><br />" +
                                    "<a href='https://vk.com/play4play_ru'>Наша группу ВК</a><br />" +
                                    "<a href='http://advisor.wmtransfer.com/SiteDetails.aspx?url=play4play.ru'>WebMonbey Advisor</a>"
                                    , [_order._seller._id, _order._payeer._id]
                                );
                            }, 1000);


                        });
                    });
                });
                res.redirect('/order/' + _order._id);
            });
            });

        } else {
            req.flash('errors', {msg: 'Вы не являетесь участником сделки.'});
            return res.redirect('/');
        }


    });
};

exports.getOrder = (req, res, next) => {

    Order.findOne({_id:req.params.oid}).populate('_payeer _seller _game _chip_page _lot_page paymentSystem').exec((err, _order) => {
        if(err) return next(err);
        if(!_order) return res.redirect('/');
        if(_order.type=='chip') {
            if (_order.chip.server_id)
                _order._server = _order._chip_page.servers.id(_order.chip.server_id);
            if (_order.chip.side_id)
                _order._side = _order._chip_page.sides.id(_order.chip.side_id);


        } else {
            if(_order.lot.server)
                _order._server = _order._lot_page.servers.id(_order.lot.server);
            if(_order.lot.side)
                _order._side = _order._lot_page.sides.id(_order.lot.side);
            if(_order.lot.race)
                _order._race = _order._lot_page.races.id(_order.lot.race);
            if(_order.lot.class)
                _order._class = _order._lot_page.classes.id(_order.lot.class);

            if(_order._lot_page.custom_fields) {
                let customs = _order.lot.customs;
                for(let cf_id in customs) {
                    if(customs[cf_id].hasOwnProperty('cf_id') ) {
                        let tmp = _order._lot_page.custom_fields.id(_order.lot.customs[cf_id].cf_id);
                        if(tmp) {
                            _order.lot.customs[cf_id].title = tmp.name;
                        }
                    }
                }
            }
        }

        let openDates = {};
        openDates.Date = moment(_order.createdAt).format('DD MMMM');
        openDates.Time = moment(_order.createdAt).format('HH:mm');
        openDates.DateFromNow = moment(_order.createdAt).fromNow();

        let closeDates = {};
        closeDates.Date = moment(_order.updatedAt).format('DD MMMM');
        closeDates.Time = moment(_order.updatedAt).format('HH:mm');
        closeDates.DateFromNow = moment(_order.updatedAt).fromNow();
        _order._seller.isOnline2 =((moment().unix()- moment(_order._seller.lastActive).unix())/60) < 15;
        let _chat;
        //find chat
        Chat
            .findOne({subscribers: {$all: [_order._payeer._id.toString(), _order._seller._id.toString()]}})
            .populate('messages.sender')
            .exec((err, chat) => {

                if(err) return next(err);
                _chat = chat;
                if(chat == null)
                    _chat = {messages:[]};
                _chat["chatter"] = {id:"", name:""};

                if(req.user._id.toString() == _order._payeer._id.toString()) {
                    _chat.chatter.id = _order._seller._id.toString();
                    _chat.chatter.name = _order._seller.username;
                } else {
                    _chat.chatter.id = _order._payeer._id.toString();
                    _chat.chatter.name = _order._payeer.username;
                }
                let comment = _order._seller.comments.id(_order._id);


                res.render('pages/orders/order',{
                    title: 'Заказ',
                    order: _order,
                    chat: _chat,
                    user: req.user,
                    moment: moment,
                    comment: comment,
                    openDates: openDates,
                    closeDates: closeDates
                });

            });


    });
};
/**
 *
 * @param req
 * @param res
 * @param next
 * @param recived Полученно денег
 * @param recived_from Кошелек покупателя с которого оплатил
 * @param purse Имя кошелька с которого оплатили
 * @param order сам заказ
 * @returns {Promise.<void>}
 */
exports.afterPay = async (req, res, next, recived, recived_from, purse, order) => {
    try {

        if(!order._payeer.balances[purse])
            order._payeer.balances[purse] = 0;

        let user_balance = order._payeer.balances[purse];

        if (order.sum !== recived) {
            if (user_balance + recived >= order.sum) {
                user_balance = user_balance - ( order.sum - recived );

                if (user_balance < 0) {
                    throw new Error('User balance cant be lower than 0!');
                }
            } else {
                throw new Error('Order sum not correct!');
            }
        }

        order.status = (order.sum_rub > 2999) ?
            Helper.statusEnum.ORDER_WAITING_FOR_ADMIN_ACCEPT :
            Helper.statusEnum.ORDER_PAID;

        await order.save();

        let user_operation = mongoose.Types.ObjectId();
        let _ps = await ps.findById(order.paymentSystem._id || order.paymentSystem);
        let real_recived = recived - percent(recived).from(_ps.commission);
        let Operation = new Operations({
            type: purse,
            user: order._payeer._id,
            user_operation: user_operation,
            sum: real_recived,
            in_out: 'in',
            comment: 'Оплата заказа #'+order.order_id,
            wallet: recived_from
        });

        Operation.save();


        let MainStat = new MainStats({
            sum: recived,
            operation: 'incoming',
            order: order._id,
            user: order._payeer._id || order._payeer,
            ps: order.paymentSystem._id || order.paymentSystem,
            game: order._game._id || order._game,
            type: order.type,
            server: order[order.type].server_id,
            side: order[order.type].side_id,
            need_confirmation: (order.sum > 2999),
            searchable: {
                username: order._payeer.username,
                date: moment(order.updatedAt).format('HH:mm:ss DD.MM.YYYY'),
                description: order.description
            }
        });

        if(order.type === 'chip')
            MainStat.chip_page = order['_chip_page']._id || order['_chip_page'];
        else
            MainStat.lot_page = order['_lot_page']._id || order['_lot_page'];

        MainStat.save();

        let balance_field = {};
        balance_field['balances.'+purse] = user_balance;

        await User.update({_id: order._payeer._id},
            {
                $set: balance_field,
                $push: {
                    operations: {
                        $each: [
                            {
                                _id: user_operation,
                                type: 'in',
                                subject: 'Пополнение баланса на сайте',
                                status: 'success',
                                sum: recived,
                                ps: Helper.OperationWallet(purse)
                            },
                            {
                                type: 'out',
                                subject: 'Оплата заказа #' + order.order_id,
                                status: 'success',
                                sum: order.sum,
                                ps: Helper.OperationWallet(purse)
                            }
                        ]
                    }
                },
                $inc: {
                    'counters.myorders': 1
                }
            });


        User.update({_id: order._seller._id},
            {
                $inc: {
                    'counters.payorders': 1
                }
            });



    } catch (e) {
        console.error(e);
        res.status(500).send(e.message);
    }
};

exports.postSendComment = async (req, res, next) => {
    try
    {
        if(!req.params.oid || !mongoose.Types.ObjectId.isValid(req.params.oid))
            throw new Error('Не верный параметр');
        let order = await Order.findOne({_id: req.params.oid}).populate('_game');

        if(!order) throw new Error('Заказ не найден');

        let sender_type = 'none';
        if(req.user._id.toString() === order._seller.toString())
            sender_type = 'seller';

        if(req.user._id.toString() === order._payeer.toString())
            sender_type = 'payeer';

        if(sender_type === 'none')
            throw new Error('Вы не можете комментировать чужие заказы.');

        if(sender_type === 'seller') {
            // Ищем комментарий покупателя, что-бы ответить на него.
            let comment = User.findOne({_id: req.user._id, 'comments.order': order._id});
            if(!comment)
                throw new Error('Вы пытаетесь ответить на не существующий комментарий.');


            await User.update(
                {
                    _id: req.user._id,
                    'comments.order': order._id
                },
                {
                    $set:{
                        'comments.$.reply':validator.escape(req.body.message)
                    }
                });
            chatHelper.SystemMessage(
                'Продавец <a href="/users/' + req.user._id.toString() + '">' + req.user.username + '</a> оставил ответ к вашему коментарию для <a href="/order/' + order._id.toString() + '">заказа #' + order.order_id + '</a>.',
                [order._seller, order._payeer]
            );
            //comment.comments[0].reply = validator.escape(req.body.message);
            //await comment.save();
            return res.json({errors: 0, message: 'Ответ на отзыв успешно добавлен'});

        }

        if(sender_type === 'payeer') {
            let comment = await User.findOne({_id: order._seller});

            if(comment && comment.comments && comment.comments.id(order._id)) { // Коментарий существует, значит это обновление
                chatHelper.SystemMessage(
                    'Покупатель <a href="/users/' + req.user._id.toString() + '">' + req.user.username + '</a> изменил отзыв к <a href="/order/' + order._id.toString() + '">заказу #' + order.order_id + '</a>.',
                    [order._seller, order._payeer]
                );
                await User.update(
                    {
                        _id: comment._id,
                        'comments.order': order._id
                    },
                    {
                        $set:{
                            'comments.$.message':validator.escape(req.body.message),
                            'comments.$.reply':""
                        }
                    });

                return res.json({errors: 0, message: 'Ваш отзыв успешно изменён!'});
            } else { // создаём новый комментарий
                let seller = await User.findOne({_id: order._seller});
                if(!seller)
                    throw new Error('Произошла какая-то дикая хуйня, срочно сообщите администратору.');

                let  localizations = order._game.localization.length > 0 ? "(" + order._game.localization.join(', ') +")" : "";
                comment = {
                    _id: order._id,
                    from: req.user._id,
                    order: order._id,
                    subject: order._game.title  + ' ' + localizations + ' ' + Math.round(order.sum) + ' ₽',
                    message: validator.escape(req.body.message),
                    reply: '',
                };
                seller.comments.push(comment);
                await seller.save();
                chatHelper.SystemMessage(
                    'Покупатель <a href="/users/' + req.user._id.toString() + '">' + req.user.username + '</a> оставил отзыв к <a href="/order/' + order._id.toString() + '">заказу #' + order.order_id + '</a>.',
                    [order._seller, order._payeer]
                );
                return res.json({errors: 0, message: 'Ваш отзыв успешно добавлен!'});
            }
        }

    } catch (e) {
        return res.json({errors: 1, 'message': e.message});
    }


};
