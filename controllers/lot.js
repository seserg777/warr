'use strict';

const LotPage = require('../models/LotPage');
const Lot = require('../models/Lot');
const Chat = require('../models/Chat');
const PS = require('../models/PaymentSystem');
const Config = require('../models/Config');
const OrderBooking = require('../models/OrdersBooking');
const Helper = require('../helpers/helper');
const async = require('async');
const moment = require('moment');
const mongoose = require('mongoose');
const validator = require('validator');
const percent = require("percent-value");
const numeral = require('numeral');


exports.getTrade = (req, res, next) => {
    if(!req.user.isSeller) {
        req.flash('info', {msg: "Для того что бы продавать, вам необходимо прочитать и принять правила для продавцов."});
        return res.redirect('/rules');
    }
    LotPage.findOne({lot_id:req.params.lot}).populate('_game').exec((err, lp) => {
        if(err) return next(err);
        if(!lp) return res.redirect("/404");

        Lot.find({_owner: req.user._id, _lot_page: lp._id}).exec((err, lots) => {
            if(err) return next(err);
            let _servers = {};
            for(let server of lp.servers) {
                _servers[server._id] = server.name;
            }

            let _sides = {};
            if(lp.sides && lp.sides.length > 0)
                for(let side of lp.sides) {
                    _sides[side._id] = side.name;
                }

            let _races = {};
            if(lp.races && lp.races.length > 0)
                for(let race of lp.races) {
                    _races[race._id] = race.name;
                }

            let _classes = {};
            if(lp.classes && lp.classes.length > 0)
                for(let _class of lp.classes) {
                    _classes[_class._id] = _class.name;
                }


            if(lp.custom_fields && lp.custom_fields.length > 0)
            for(let _lotid in lots) {
                if(lots.hasOwnProperty(_lotid)) {
                    if (!lots[_lotid]._customs) lots[_lotid]._customs = {};
                    if (lots.hasOwnProperty(_lotid)) {
                        for (let _cid in lots[_lotid].customs) {
                            if (lots[_lotid].customs.hasOwnProperty(_cid)) {
                                lots[_lotid]._customs[lots[_lotid].customs[_cid].cf_id] = lots[_lotid].customs[_cid];
                            }
                        }

                    }
                }
            }


            res.render('pages/lot/trade', {
                title: 'Продать',
                servers: _servers,
                sides: _sides,
                races: _races,
                classes: _classes,
                lots: lots,
                lp: lp,
            });
        });

    });
};

exports.postDeleteOffer = (req, res, next) => {
    Lot.findOne({_id: req.body.lot_id}).populate('_lot_page').exec((err, lot) =>{
        if(err) return next(err);
        if(!lot) return res.redirect('/404');

        if(lot && lot._owner.toString() === req.user._id.toString() && mongoose.Types.ObjectId.isValid(req.body.lot_id)) {
            lot.remove();
          //  Lot.remove({_id: req.body._id}).exec((err)=>{
                if(err) return next(err);
                req.flash("info",{msg:"Предложение удалено"});
                res.redirect('/lots/'+lot._lot_page.lot_id+'/trade');
           // });
        } else {
            req.flash("errors",{msg:"Не вереный параметр"});
            return res.redirect('/lots/'+lot._lot_page.lot_id+'/trade');
        }
    });
};

exports.postPushUp = async (req, res, next) => {
    try {

        let lots = await Lot.find({_lot_page: req.params.lot });
        let hoursAgo = new Date(new Date().getTime() - 60 * 60 * 24 * 1000);

        for(let lot of lots) {
            if(hoursAgo < lot.lastPushUp) {
                let diff_ms = moment(lot.lastPushUp).diff(hoursAgo);
                let d = moment.duration(diff_ms);
                throw new Error('Вы можете поднять свои предложения только через '+ moment.duration(diff_ms).humanize())
            }
        }
        Lot.update({_lot_page: req.params.lot },{
            lastPushUp: new Date,
        }).exec();

        res.json({
            errors: 0,
            message: "Ваши предложения успешно подняты."
        })
    } catch (e) {
        //console.error(e);
        res.json({
            errors: 1,
            message: e.message
        })
    }

};
exports.postTrade = (req, res, next) => {
    if(!req.user.isSeller) {
        req.flash('info', {msg: "Для того что бы продавать, вам необходимо прочитать и принять правила для продавцов."});
        return res.redirect('/rules');
    }

    LotPage.findOne({lot_id: req.params.lot}).populate('_game').exec((err, lp) => {
        if(err) return next(err);
        if(!lp) return res.redirect('/404');

        if(req.body.offer) {
            let _lot = new Lot();
            let offer = req.body.offer;
            let lot_id2change = req.body.lot_id || null;
            for(let id in offer ) {
                if(offer.hasOwnProperty(id)) {
                    if (mongoose.Types.ObjectId.isValid(lot_id2change)) {
                        Lot.findOne({_id: lot_id2change}).exec((err, lot) => {


                            if(typeof offer[id].short_desc !== 'string' || typeof offer[id].description !== 'string') {
                                req.flash('info', {msg: "Ошибка в параметрах."});
                                return res.redirect('/lots/'+lp.lot_id+'/trade');
                            }

                            offer[id].price = offer[id].price ? numeral(offer[id].price).value() : 0;

                            if(offer[id].price < 0.1 || offer[id].price > 99999) {
                                req.flash('errors', {msg: "Цена указанна не верно!"});
                                return res.redirect('/lots/'+lp.lot_id+'/trade');
                            }


                            if(!mongoose.Types.ObjectId.isValid(offer[id].server) ||  lp.servers.id(offer[id].server) === null) {
                                req.flash('info', {msg: "Ошибка в параметрах."});
                                return res.redirect('/lots/'+lp.lot_id+'/trade');
                            }

                            if(offer[id].side && (!mongoose.Types.ObjectId.isValid(offer[id].side) ||  lp.sides.id(offer[id].side) === null)) {
                                req.flash('info', {msg: "Ошибка в параметрах."});
                                return res.redirect('/lots/'+lp.lot_id+'/trade');
                            }

                            if(offer[id].race && (!mongoose.Types.ObjectId.isValid(offer[id].race) ||  lp.races.id(offer[id].race) === null)) {
                                req.flash('info', {msg: "Ошибка в параметрах."});
                                return res.redirect('/lots/'+lp.lot_id+'/trade');
                            }

                            if(offer[id].class && (!mongoose.Types.ObjectId.isValid(offer[id].class) ||  lp.classes.id(offer[id].class) === null)) {
                                req.flash('info', {msg: "Ошибка в параметрах."});
                                return res.redirect('/lots/'+lp.lot_id+'/trade');
                            }

                            lot.server = offer[id].server;
                            lot.side = offer[id].side;
                            lot.race = offer[id].race;
                            lot.class = offer[id].class;
                            lot.short_desc = Helper.legitString(offer[id].short_desc, 200);
                            lot.description = Helper.legitString(offer[id].description, 4000);
                            lot.price = offer[id].price;

                            if (typeof offer[id].cf === "object") {
                                for (let cf in offer[id].cf)
                                    if(offer[id].cf.hasOwnProperty(cf)) {
                                        let _cf = lp.custom_fields.id(cf);
                                        if(_cf) {
                                            Lot.update({_id: lot._id, 'customs.cf_id':cf},
                                                {
                                                    'customs.$.value':offer[id].cf[cf]
                                                }, (err, __lot) => {
                                                   // console.log(_lot);
                                                    if (err) return next(err);
                                                });
                                        }
                                    }
                            }
                            //let cf = lp.custom_fields.id(_chip.server_id);
                            /*Lot.update({_id: _lot._id},{
                             'customs.$.cf_id':cf,
                             'customs.$.value':offer[id][cf]
                             });*/
                            lot.save();
                            req.flash('info', {msg: "Предложение успешно обновленно"});
                            res.redirect('/lots/'+lp.lot_id+'/trade');
                        });

                    } else {

                        if(typeof offer[id].short_desc !== 'string' || typeof offer[id].description !== 'string') {
                            req.flash('info', {msg: "Ошибка в параметрах."});
                            return res.redirect('/lots/'+lp.lot_id+'/trade');
                        }

                        offer[id].price = offer[id].price ? numeral(offer[id].price).value() : 0;

                        if(offer[id].price < 0.1 || offer[id].price > 99999) {
                            req.flash('errors', {msg: "Цена указанна не верно!"});
                            return res.redirect('/lots/'+lp.lot_id+'/trade');
                        }

                        if(!mongoose.Types.ObjectId.isValid(offer[id].server) ||  lp.servers.id(offer[id].server) === null) {
                            req.flash('info', {msg: "Ошибка в параметрах."});
                            return res.redirect('/lots/'+lp.lot_id+'/trade');
                        }

                        if(offer[id].side && (!mongoose.Types.ObjectId.isValid(offer[id].side) ||  lp.sides.id(offer[id].side) === null)) {
                            req.flash('info', {msg: "Ошибка в параметрах."});
                            return res.redirect('/lots/'+lp.lot_id+'/trade');
                        }

                        if(offer[id].race && (!mongoose.Types.ObjectId.isValid(offer[id].race) ||  lp.races.id(offer[id].race) === null)) {
                            req.flash('info', {msg: "Ошибка в параметрах."});
                            return res.redirect('/lots/'+lp.lot_id+'/trade');
                        }

                        if(offer[id].class && (!mongoose.Types.ObjectId.isValid(offer[id].class) ||  lp.classes.id(offer[id].class) === null)) {
                            req.flash('info', {msg: "Ошибка в параметрах."});
                            return res.redirect('/lots/'+lp.lot_id+'/trade');
                        }


                        _lot._lot_page = lp._id;
                        _lot._owner = req.user._id;
                        _lot.active = true;
                        _lot._game = lp._game._id;
                        _lot.server = offer[id].server;
                        _lot.side = offer[id].side;
                        _lot.race = offer[id].race;
                        _lot.class = offer[id].class;
                        _lot.short_desc = Helper.legitString(offer[id].short_desc, 200);
                        _lot.description = Helper.legitString(offer[id].description, 4000);
                        _lot.price = offer[id].price;

                        if (typeof offer[id].cf === "object") {
                            for (let cf in offer[id].cf)
                                if(offer[id].cf.hasOwnProperty(cf)) {
                                    let _cf = lp.custom_fields.id(cf);
                                    if(_cf) {
                                        _lot.customs.addToSet({cf_id:cf, value:offer[id].cf[cf]});
                                    }
                                }
                        }

                        _lot.save();
                        req.flash('info', {msg: "Предложение успешно добавлено!"});
                        res.redirect('/lots/'+lp.lot_id+'/trade');
                    }
                }
            }
        }
    });
};

// страница предожений
exports.getLot = (req,res,next) => {
    if(!validator.isInt( req.params.lot))  return next();
    LotPage.findOne({lot_id:req.params.lot}).populate('_game').sort({lastPushUp: -1}).exec((err, lp) => {
        if(err) return next(err);
        let query = {
            _lot_page:lp._id,
            active: true,
        };

        if(req.query.server && mongoose.Types.ObjectId.isValid(req.query.server)) {
            query['server'] = req.query.server;
        }

        if(req.query.side && mongoose.Types.ObjectId.isValid(req.query.side)) {
            query['side'] = req.query.side;
        }

        if(req.query.race && mongoose.Types.ObjectId.isValid(req.query.race)) {
            query['race'] = req.query.race;
        }

        if(req.query.class && mongoose.Types.ObjectId.isValid(req.query.class)) {
            query['class'] = req.query.side;
        }


        if(req.query.cf) {

            for(let cfid in req.query['cf']) {
                if(req.query['cf'].hasOwnProperty(cfid) && mongoose.Types.ObjectId.isValid(cfid)) {
                    if(!query.hasOwnProperty('$and')) query.$and = [];
                    query.$and.push({
                        customs: {
                            $elemMatch: {
                                cf_id: mongoose.Types.ObjectId(cfid),
                                value: req.query.cf[cfid]
                            }
                        }
                    });
                }
            }
        }
        PS.findOne({active:true}).sort({commision: 1}).exec((err, ps)=> {
            let lowest_commission = ps.commision | 0;

            Lot.find(query).populate('_owner').exec((err, lots) => {
                if (err) return next(err);

                let _servers = {};
                for (let server of lp.servers) {
                    _servers[server._id] = server.name;
                }

                let _sides = {};
                if (lp.sides && lp.sides.length > 0)
                    for (let side of lp.sides) {
                        _sides[side._id] = side.name;
                    }

                let _races = {};
                if (lp.races && lp.races.length > 0)
                    for (let race of lp.races) {
                        _races[race._id] = race.name;
                    }

                let _classes = {};
                if (lp.classes && lp.classes.length > 0)
                    for (let _class of lp.classes) {
                        _classes[_class._id] = _class.name;
                    }

                if (lp.custom_fields && lp.custom_fields.length > 0)
                    for (let _lotid in lots) {
                        if (lots.hasOwnProperty(_lotid)) {
                            if (!lots[_lotid]._customs) lots[_lotid]._customs = {};
                            if (lots.hasOwnProperty(_lotid)) {
                                for (let _cid in lots[_lotid].customs) {
                                    if (lots[_lotid].customs.hasOwnProperty(_cid)) {
                                        lots[_lotid]._customs[lots[_lotid].customs[_cid].cf_id] = lots[_lotid].customs[_cid];
                                    }
                                }

                            }
                        }
                    }

                for (let skey in lots) {
                    if (lots.hasOwnProperty(skey)) {
                        lots[skey]._owner._createdAt = moment(lots[skey]._owner.createdAt).fromNow(true);
                        lots[skey].show = true;
                        let commission = percent(parseFloat(process.env.COMMISSION) + lp.commission + lowest_commission).from(lots[skey].price);
                        //console.log("Комисия сайта: ", process.env.COMMISSION, " + Комиссия игры: "+ lp._game.commission + " + Космиссия платежки: "+ lowest_commission +" = "+commission+ " От "+lots[skey].price);
                        //console.log(typeof commission);

                        lots[skey].price2 = (lots[skey].price + commission).toFixed(2);

                        lots[skey]._owner.isOnline2 = ((moment().unix() - moment(lots[skey]._owner.lastActive).unix()) / 60) < 15;
                        if (req.query.onlineOnly && req.query.onlineOnly === '1') {
                            if (lots[skey]._owner.isOnline2 === false)
                                lots[skey].show = false;
                        }
                    }
                }

                let lp_title = lp.ptype == "accs" ? "Аккаунты" : (lp.ptype == "services" ? "Услуги" : "Предметы" );
                let title = (lp.page_title && lp.page_title != "") ? (lp.page_title) : (lp.title + ' ' + lp._game.title + (lp._game.localization.length > 0 ? ' (' + lp._game.localization.join(', ') + ')' : ''));

                res.render(req.xhr ? 'pages/lot_xhr' : 'pages/lot', {
                    lp: lp,
                    ref_bonus:parseFloat(process.env.REFERAL_BONUS_PERCENT_FROM_COMMISSION),
                    servers: _servers,
                    sides: _sides,
                    races: _races,
                    classes: _classes,
                    lots: lots,
                    title: title
                });

            });
        });

    });
};

exports.getLotOffer = (req, res, next) => {
    async.waterfall([(done) => {

        Lot.findOne({_id:req.params.chip_id}).populate('_game _lot_page _owner').exec((err, offer) => {

            //console.log(offer);
            if (err) return next(err);
            if(!offer) {
                req.flash('info', {msg: "Этой страницы больше не существует!"});
                return res.redirect('/');
            }
            done(null,offer);
        });

    }, (offer,done) => {

        PS.find({active:true}).sort({ordering:1}).exec((err,methods)=> {
            done(null,methods, offer);
        });

    }, (methods, offer, done) => {

        Config.findOne({param:'Courses'}).exec((err, courses) => {

            done(null, methods, offer, courses.value);
        });
    }, (methods, offer, courses, done) => {

        for (let method in methods) {
            if (methods.hasOwnProperty(method)) {
                if (!courses[methods[method].currency])
                    return next("Не найдена валюта установленная в платёжной системе. Валюта:" + methods[method].currency + " В масиве: " + JSON.stringify(courses));
                let commission = percent(parseFloat(process.env.COMMISSION) + offer._lot_page.commission + parseFloat(methods[method].commision)).from(offer.price);

                methods[method].price = (offer.price + commission  ) / parseFloat(courses[methods[method].currency]);

                methods[method].title2 = methods[method].title + " — "+methods[method].price.toFixed(2)+" " + methods[method].currency_title;

            }

        }
        if (offer.server)
            offer._server = offer._lot_page.servers.id(offer.server);
        if (offer.side)
            offer._side = offer._lot_page.sides.id(offer.side);
        if (offer.race)
            offer._race = offer._lot_page.races.id(offer.race);
        if (offer.class)
            offer._class = offer._lot_page.classes.id(offer.class);

        if (offer._lot_page.custom_fields) {
            let customs = offer.customs.map(o => o.toObject());
            for (let cf_id in customs) {
                if (customs[cf_id].hasOwnProperty('cf_id')) {
                    let tmp = offer._lot_page.custom_fields.id(offer.customs[cf_id].cf_id);
                    if (tmp) {
                        offer.customs[cf_id].title = tmp.name;
                    }
                }
            }
        }
        done(null, methods, offer);

    }, (methods, offer, done) => {

        let _chat;
        //find chat
        Chat
            .findOne({subscribers: {$all: [req.user._id.toString(), offer._owner._id.toString()]}})
            .populate('messages.sender')
            .exec((err, chat) => {

                if(err) return next(err);
                _chat = chat;
                if(chat == null)
                    _chat = {messages:[]};
                _chat["chatter"] = {id:"", name:""};
                _chat.chatter.id = offer._owner._id.toString();
                _chat.chatter.name = offer._owner.username;
                done(null, methods, offer, _chat);

            });

    }], (err, methods, offer, chat) => {

        if(err) return next(err);
        let reviews = {};
        if(offer._owner.comments)
        for(let com_id in offer._owner.comments.toObject()) {
            reviews[com_id] =  offer._owner.comments[com_id];
            reviews[com_id].time =  moment(reviews[com_id].date).fromNow();
        }

        res.render('pages/lot/offer', {
            offer: offer,
            reviews: reviews,
            methods: methods,
            chat: chat,
            moment: moment,
            title:'Оформление заказа'});
    });

};

exports.postCreateLotOffer = (req, res, next) => {
    if(!req.body.lot_id
        || !mongoose.Types.ObjectId.isValid(req.body.lot_id )
        || !req.body.paymentMethod
        || !mongoose.Types.ObjectId.isValid(req.body.paymentMethod))
        return next("Что-то пошло не так.");
    Lot.findOne({_id:req.body.lot_id}).populate('_game _lot_page _owner').exec((err, _lot )=> {
        PS.findOne({_id: req.body.paymentMethod}).exec((err, _ps) => {
            Config.findOne({param: 'Courses'}).exec( async (err, courses) => {
                if (!courses.value[_ps.currency])
                    return next("Не найдена валюта установленная в платёжной системе.");


                let Bookings = await OrderBooking.find({lot: req.body.lot_id, time: { $gte: Date.now() - 1000*60 }});

                if(Bookings.length > 0) {
                    req.flash('errors', {msg: `Этот лот в данный момент не доступен.`});
                    return res.redirect('/lots/offer/' + req.body.lot_id);
                }



                let commission = percent(parseFloat(process.env.COMMISSION) + _lot._lot_page.commission + parseFloat(_ps.commision)).from(_lot.price);
                if (err) return next(err);
                let order = {};
                order.lot_id = req.body.lot_id;
                order.coins_amount = 0;
                order.sum = (_lot.price + commission) / parseFloat(courses.value[_ps.currency]);
                order.sum = parseFloat(order.sum.toFixed(2));
                order.payment_method = req.body.paymentMethod;
                order.type = 'lot';
                order.charname = '';
                order.ps_method_title = _ps.title;

                if(_lot.server)
                    _lot._server = _lot._lot_page.servers.id(_lot.server);
                if(_lot.side)
                    _lot._side = _lot._lot_page.sides.id(_lot.side);
                if(_lot.race)
                    _lot._race = _lot._lot_page.races.id(_lot.race);
                if(_lot.class)
                    _lot._class = _lot._lot_page.classes.id(_lot.class);

                if(_lot._lot_page.custom_fields) {
                    let customs = _lot.customs.map(o => o.toObject());
                    for(let cf_id in customs) {
                        if(customs[cf_id].hasOwnProperty('cf_id') ) {
                            let tmp = _lot._lot_page.custom_fields.id(_lot.customs[cf_id].cf_id);
                            if(tmp) {
                                _lot.customs[cf_id].title = tmp.name;
                            }
                        }
                    }
                }

                res.render('pages/lot/create_order', {
                    offer: _lot,
                    order: order,
                    title: 'Подтверждение заказа'
                });

            });
        });
    });
};