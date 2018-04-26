'use strict';

const ChipPage = require('../models/ChipPage');
const Chip = require('../models/Chip');
const PS = require('../models/PaymentSystem');
const Config = require('../models/Config');
const Chat = require('../models/Chat');
const OrderBooking = require('../models/OrdersBooking');
const async = require('async');
const numeral = require('numeral');
const moment = require('moment');
const mongoose = require('mongoose');
const validator = require('validator');
const percent = require("percent-value");
const _ = require("underscore");
// страница предожений
exports.getChip = (req,res,next) => {
    if(!validator.isInt( req.params.chip))  return next();
    ChipPage.findOne({chip_id:parseInt(req.params.chip)}).populate('_game _chip_page').exec((err, cp) => {
        if(err) return next(err);

        if(!cp || !cp._id) return next();
        let query = {
            _chip_page:cp._id,
            toggle_on: true,
            count: {$gte:1},
            price: {$gte:0.01},

        };

        if(req.query.server && mongoose.Types.ObjectId.isValid(req.query.server)) {
            query['server_id'] = req.query.server;
        }

        if(req.query.side && mongoose.Types.ObjectId.isValid(req.query.side)) {
            query['side_id'] = req.query.side;
        }

        PS.findOne({active:true}).sort({commision: 1}).exec((err, ps)=> {
            let lowest_commission = ps.commision | 0;

            Chip.find(query).populate('_owner').sort({price:1, count:-1}).exec((err, chips) =>
            {
                if(err) return next(err);

                let _servers = {};
                for(let server of cp.servers) {
                    _servers[server._id] = server.name;
                }


                let _sides = {};
                if(cp.sides && cp.sides.length > 0)
                    for(let side of cp.sides) {
                        _sides[side._id] = side.name;
                    }

                for(let skey in chips) {
                    if(chips.hasOwnProperty(skey)) {
                        chips[skey]._owner._createdAt = moment(chips[skey]._owner.createdAt).fromNow(true);
                        chips[skey].show=true;
                        let commission = percent(parseFloat(process.env.COMMISSION) + cp.commission + lowest_commission).from(chips[skey].price);
                        //console.log("Комисия сайта: ", process.env.COMMISSION, " + Комиссия игры: "+ cp._game.commission + " + Космиссия платежки: "+ lowest_commission +" = "+commission+ " От "+chips[skey].price);
                        chips[skey].price = (chips[skey].price + commission).toFixed(2);
                       // chips[skey].count = numeral(chips[skey].count).format();
                        chips[skey]._owner.isOnline2 = ((moment().unix()- moment(chips[skey]._owner.lastActive).unix())/60) < 15;
                        if(req.query.onlineOnly && req.query.onlineOnly==='true') {
                            if( chips[skey]._owner.isOnline2 === false)
                                chips[skey].show= false;
                        }
                    }
                }

                res.render(req.xhr ? 'pages/chip_xhr': 'pages/chip', {
                    cp: cp,
                    ref_bonus: parseFloat(process.env.REFERAL_BONUS_PERCENT_FROM_COMMISSION),
                    numeral: numeral,
                    servers: _servers,
                    sides: _sides,
                    chips: chips,
                    title: (cp.page_title && cp.page_title != "") ? (cp.page_title) : (cp.currency +  ' '+ cp._game.title + ' ('+cp._game.localization.join(', ')+')')});

            });
        });

    });
};
// страница добавления предложения
exports.getTrade = (req, res, next) => {
    if(!req.user.isSeller) {
        req.flash('info', {msg: "Для того что бы продавать, вам необходимо прочитать и принять правила для продавцов."});
        return res.redirect('/rules');
    }
    ChipPage.findOne({chip_id:req.params.chip},{}, {lean: true}).populate('_game').exec((err, cp) => {
        if(err) return next(err);
        let _chips= [];
        let min_order = 100;
        async.each(cp.servers, (server,servDone) => {
            if(cp.sides.length > 0) {
                async.each(cp.sides, (side,sideDone) => {
                    Chip.findOne({_chip_page: cp._id, _owner:req.user._id, server_id: server._id, side_id: side._id}, (err, chip)=>{
                        if (err) return next(err);
                        if(chip && chip.min_order && chip.min_order != min_order && chip.min_order > 0)
                            min_order = chip.min_order;
                        _chips.push({

                            toggle_on: chip ? chip.toggle_on : false,
                            price: chip ? chip.price : '',
                            count: chip ? chip.count : '',
                            side_name: side.name,
                            server_name: server.name,
                            chip_id: chip ? chip._id : 0,
                            server_id: server._id,
                            side_id: side._id
                        });
                        sideDone();
                    });
                }, (err) => {
                    servDone();
                });
            } else {
                Chip.findOne({_chip_page: cp._id, _owner: req.user._id, server_id: server._id}, (err, chip)=>{
                    if (err) return next(err);
                    if(chip && chip.min_order && chip.min_order != min_order && chip.min_order > 0)
                        min_order = chip.min_order;
                    _chips.push({

                        toggle_on: chip ? chip.toggle_on : false,
                        price: chip ? chip.price : '',
                        count: chip ? chip.count : '',
                        server_name: server.name,
                        chip_id: chip ? chip._id : 0,
                        server_id: server._id,
                    });
                    servDone();
                });
            }
        }, (err) => {

            res.render('pages/chip/trade', {
                cp: cp,
                min_order: min_order,
                chips: _.sortBy(_chips,  (o)=>  { return o.server_name +  o.side_name || ''}),
                title: cp.currency +  ' '+ cp._game.title + ' ('+cp._game.localization.join(', ')+')'});

        });

    });
};

exports.getPrices  = async (req, res, next) => {
   try {
       let methods = await PS.find({active:true}).sort({ordering:1});
       let courses = await Config.findOne({param:'Courses'});
       courses = courses.value;
       let price = parseFloat(req.query.price);
       let cp = await ChipPage.findOne({_id:req.params.chip}).populate('_game ');

       let sell_count = 1;
       if('currency_sell_count' in cp && cp.currency_sell_count > 0 ) {
           sell_count = cp.currency_sell_count;
       }
       for (let method in methods) {
           if(methods.hasOwnProperty(method)) {
               if (!courses[methods[method].currency])
                   throw new Error("Не найдена валюта установленная в платёжной системе. Валюта:" + methods[method].currency + " В масиве: " + JSON.stringify(courses));
               let commission = percent(parseFloat(process.env.COMMISSION) + cp.commission + parseFloat(methods[method].commision)).from(price);
               let commission_per_one = percent(parseFloat(process.env.COMMISSION) + cp.commission + parseFloat(methods[method].commision)).from(price/sell_count);

               methods[method].price = parseFloat(((price+commission) / parseFloat(courses[methods[method].currency])).toFixed(5));

               methods[method].price_per_one = parseFloat(((price/sell_count+commission_per_one) / parseFloat(courses[methods[method].currency])).toFixed(5));

           }

       }
       res.render('pages/chip/prices',{
           methods: methods
       });
   } catch(e) {
       console.error(e);
        res.status(500).send('');
   }
};

exports.postTrade = (req, res, next) => {
    if(!req.user.isSeller) {
        req.flash('info', {msg: "Для того что бы продавать, вам необходимо прочитать и принять правила для продавцов."});
        return res.redirect('/rules');
    }
    ChipPage.findOne({chip_id:req.params.chip}).populate('_game').exec((err, cp) => {
        if(err) return next(err);
        if('min_oreder' in req.body)
            req.body.min_order =  numeral(req.body.min_order).value();
        if(req.body.min_order.trim() === "" ||  !validator.isInt(req.body.min_order)) {
            req.flash('errors', {msg: `Недопустимое значение минимального заказа: "${req.body.min_order}"`});
            req.body.min_order = 100;

        }

        if(cp.sides.length > 0) {
            Chip.remove({_owner:req.user._id, _chip_page:cp._id},function(err) { // удаляем старые записи НУ
                if (err) return next(err);
                async.eachOf(req.body.chip, (server, server_id, doneServ)=> {
                    async.eachOf(server, (side, side_id, doneSide)=> {
                        if('price' in side)
                            side.price =  numeral(side.price).value();
                        if(side.toggle_on && (!side.price|| (side.price < 0.01 && side.price > 100000) )) {
                            if(!side.price) {
                                req.flash('errors', {msg: `Цена не может быть пустым полем!`});
                            } else {
                                req.flash('errors', {msg: `Недопустимое значение в параметре цена: "${side.count}"`});
                            }
                            return doneSide();

                        }
                        if('count' in side)
                            side.count =  numeral(side.count).value();
                        if(side.toggle_on && (!side.count || (side.count < 1 && side.count > 2147000000))) {
                            if(!side.count) {
                                req.flash('errors', {msg: `Параметр наличие не может быть пустым!`});
                            } else {
                                req.flash('errors', {msg: `Недопустимое значение в параметре наличие: "${side.count}"`});
                            }
                            return doneSide();

                        }
                        //console.log(side);
                        let _chip = new Chip({
                            _owner: req.user._id,
                            _chip_page: cp.id,
                            _game: cp._game,
                            min_order: req.body.min_order,
                            toggle_on: side.toggle_on,
                            server_id: server_id,
                            side_id: side_id,
                            price: side.price,
                            count: side.count,
                        });
                        if(_chip.toggle_on)
                            _chip.save((err)=>{
                                if(err) return next(err);
                                doneSide();
                            });
                        else doneSide();
                    }, (err) => {
                        doneServ();
                    });
                }, (err) => {
                    req.flash('info', {msg: "Сохранено!"});
                    res.redirect('/chips/'+cp.chip_id+'/trade');
                });
            });
        } else {
            Chip.remove({_owner:req.user._id, _chip_page:cp._id},function(err) { // удаляем старые записи НУ
                if(err) return next(err);
                async.eachOf(req.body.chip, (chip, sid, done)=> {
                    if(chip.toggle_on && (chip.price.trim() === "" || !validator.isFloat(chip.price, {min:0.01, max:100000}))) {
                            chip.price =  numeral(chip.price).value();
                        if(!chip.price) {
                            req.flash('errors', {msg: `Цена не может быть пустым полем!`});
                            return done();
                        } else if((chip.price < 0.01 && chip.price > 100000)) {
                            req.flash('errors', {msg: `Недопустимое значение в параметре цена: "${chip.price}"`});
                            return done();
                        }


                    }

                    if(chip.toggle_on && (chip.count.trim() === "" || !validator.isFloat(chip.count, {min:1, max:2147000000}))) {
                            chip.count =  numeral(chip.count).value();
                        if(!chip.count) {
                            req.flash('errors', {msg: `Параметр наличие не может быть пустым!`});
                            return done();

                        } else if((chip.count < 1 && chip.count > 2147000000)) {
                            req.flash('errors', {msg: `Недопустимое значение в параметре наличие: "${chip.count}"`});
                            return done();

                        }

                    }

                    let _chip = new Chip({
                        _owner: req.user._id,
                        _chip_page: cp.id,
                        _game: cp._game,
                        min_order: req.body.min_order,
                        toggle_on: chip.toggle_on,
                        server_id: sid,
                        price: chip.price,
                        count: chip.count,
                    });
                    if(_chip.toggle_on)
                        _chip.save((err)=>{
                            if(err) return next(err);
                            done();
                        });
                    else done();
                }, (err) => {
                    req.flash('info', {msg: "Сохранено!"});
                    res.redirect('/chips/'+cp.chip_id+'/trade');
                });
            });
        }
    });
};

exports.getChipOffer = (req, res, next) => {

    async.waterfall([(done) => {
        Chip.findOne({_id:req.params.chip_id}).populate('_game _chip_page _owner').exec((err, offer) => {
            let sell_count = 1;
            // console.log(offer);
            if (err) return next(err);

            if(!offer) {
                req.flash('info', {msg: "Этой страницы больше не существует!"});
                return res.redirect('/');
            }
            if('currency_sell_count' in offer._chip_page && offer._chip_page.currency_sell_count > 0 ) {
                sell_count = offer._chip_page.currency_sell_count;
            }
            done(null,offer, sell_count);
        });
    }, (offer, sell_count, done) => {
        PS.find({active:true}).sort({ordering:1}).exec((err,methods)=> {

            done(null,methods, offer, sell_count);
        });
    }, (methods, offer, sell_count, done) => {
        Config.findOne({param:'Courses'}).exec((err, courses) => {

            done(null, methods, offer, courses.value, sell_count);
        });
    }, (methods, offer, courses, sell_count, done) => {
        for (let method in methods) {
            if(methods.hasOwnProperty(method)) {
                if (!courses[methods[method].currency])
                    return next(new Error("Не найдена валюта установленная в платёжной системе. Валюта:" + methods[method].currency + " В масиве: " + JSON.stringify(courses)));
                let commission = percent(parseFloat(process.env.COMMISSION) + offer._chip_page.commission + parseFloat(methods[method].commision)).from(offer.price);
                let commission_per_one = percent(parseFloat(process.env.COMMISSION) + offer._chip_page.commission + parseFloat(methods[method].commision)).from(offer.price/sell_count);
                //console.log((parseFloat(process.env.COMMISSION) + offer._game.commission + parseFloat(methods[method].commision))+"% от "+offer.price+ " = "+ commission);

                methods[method].price = parseFloat(((offer.price+commission) / parseFloat(courses[methods[method].currency])).toFixed(5));

                methods[method].price_per_one = parseFloat(((offer.price/sell_count+commission_per_one) / parseFloat(courses[methods[method].currency])).toFixed(5));


                methods[method].title2 = methods[method].title+ " — "+methods[method].price.toFixed(3)+" " + methods[method].currency_title + " за "+offer._chip_page.currency_sell_count+" "+offer._chip_page.currency_sell_sufix+" "+offer._chip_page.currency_plural;

                // console.log(methods[method]);
            }

        }
        offer._owner.isOnline2 = ((moment().unix()- moment(offer._owner.lastActive).unix())/60) < 15;
        if(offer.server_id)
            offer._server = offer._chip_page.servers.id(offer.server_id);
        if(offer.side_id)
            offer._side = offer._chip_page.sides.id(offer.side_id);


        let _chat;
        //find chat
        Chat
            .findOne({subscribers: {$all: [offer._owner._id.toString(), req.user._id.toString()]}})
            .populate('messages.sender')
            .exec((err, chat) => {

                if (err) return next(err);
                _chat = chat;
                if (chat == null)
                    _chat = {messages: []};
                _chat["chatter"] = {id: "", name: ""};

                _chat.chatter.id = offer._owner._id.toString();
                _chat.chatter.name = offer._owner.username;

                let ipay = 0;
                if(req.query.pay && validator.isFloat(req.query.pay, {min:0, max: 99999}))
                    ipay = req.query.pay;
                let nick="";
                if(req.query.nick) {
                    nick = req.query.nick;
                }
                let reviews = {};
                if(offer._owner.comments)
                    for(let com_id in offer._owner.comments.toObject()) {
                        reviews[com_id] =  offer._owner.comments[com_id];
                        reviews[com_id].time =  moment(reviews[com_id].date).fromNow();
                    }

                res.render('pages/chip/offer', {
                    offer: offer,
                    methods: methods,
                    numeral: numeral,
                    reviews: reviews,
                    ipay: ipay,
                    nick: nick,
                    chat: _chat,
                    moment: moment,
                    title:'Оформление заказа'});
            });

    }]);


};

exports.postCreateChipOffer = (req, res, next) => {
    if(!req.body.chip_id
        || !mongoose.Types.ObjectId.isValid(req.body.chip_id )
        || !req.body.paymentMethod
        || !mongoose.Types.ObjectId.isValid(req.body.paymentMethod)
        )
        return next(new Error("Недостаточно параметров"));
    if(!req.body.charname || typeof req.body.charname !== 'string' || req.body.charname.trim() === "") {
        req.flash('errors', {msg: "Укажитие пожалуйста имя персонажа!"});
        return res.redirect('/chips/offer/'+req.body.chip_id+'?pay='+req.body.ipay);
    }

    if('ipay' in req.body)
        req.body.ipay = req.body.ipay.replace(',','').replace(' ','');

    if(!req.body.ipay || !validator.isFloat(req.body.ipay)) {
        req.flash('errors', {msg: "Не указана сумма на которую вы хотите купить!"});
        return res.redirect('/chips/offer/'+req.body.chip_id+'?nick='+req.body.charname);
    }
    Chip.findOne({_id:req.body.chip_id}).populate('_game _chip_page _owner').exec((err, _chip )=> {
        if(!_chip) {
            req.flash('errors', {msg: 'Произошла ошибка.'});
            return res.redirect('/');
        }
        if(_chip._owner._id.toString() === req.user._id.toString()) {
            req.flash('errors', {msg: 'Вы не можете купить у самого себя.'});
            return res.redirect('/chips/offer/'+req.body.chip_id+'?nick='+req.body.charname+"&pay="+req.body.ipay);
        }

        PS.findOne({_id: req.body.paymentMethod}).exec((err, _ps) => {
            if(!_ps) {
                req.flash('errors', {msg: 'Произошла ошибка.'});
                return res.redirect('/');
            }

            if(!_ps.active) {
                req.flash('errors', {msg: 'Произошла ошибка.'});
                return res.redirect('/');
            }

            Config.findOne({param:'Courses'}).exec(async (err, courses) => {
                if(!courses.value[_ps.currency])
                    return next(new Error("Не найдена валюта установленная в платёжной системе."));

                if(err) return next(err);
                _chip.price = _chip.price / parseFloat(courses.value[_ps.currency]);


                let commission = percent(parseFloat(process.env.COMMISSION) + _chip._chip_page.commission + parseFloat(_ps.commision)).from(_chip.price);
                let price_per_one = _chip.price+commission;
                let min_order_vault = _chip.min_order / courses.value[_ps.currency];
                let max_order_vault = (_chip.count * price_per_one) / courses.value[_ps.currency];
                if(max_order_vault >= min_order_vault) {
                    //console.log( {msg: `Неверная сумма! Минимиальная - ${min_order_vault.toFixed(2)} ${_ps.currency_title},  максимальная - ${max_order_vault.toFixed(3)} ${_ps.currency_title}.`});
                    if (!validator.isFloat(req.body.ipay, {
                            min: parseFloat(min_order_vault.toFixed(2)),
                            max: parseFloat(max_order_vault.toFixed(2))
                        })) {
                        req.flash('errors', {msg: `Неверная сумма! Минимиальная - ${min_order_vault.toFixed(2)} ${_ps.currency_title},  максимальная - ${max_order_vault.toFixed(2)} ${_ps.currency_title}.`});
                        return res.redirect('/chips/offer/' + req.body.chip_id + '?pay=' + req.body.ipay + '&nick=' + req.body.charname);
                    }

                } else {
                    if (!validator.isFloat(req.body.ipay, {
                            max: parseFloat(max_order_vault.toFixed(2))
                        })) {
                        req.flash('errors', {msg: `Неверная сумма! Максимальная - ${max_order_vault.toFixed(2)} ${_ps.currency_title}.`});
                        return res.redirect('/chips/offer/' + req.body.chip_id + '?pay=' + req.body.ipay + '&nick=' + req.body.charname);
                    }
                }

                let end_count = (req.body.ipay/price_per_one).toFixed(2);


                let Bookings = await OrderBooking.find({lot: req.body.chip_id, time: { $gte: Date.now() - 1000*60 }});
                //console.log(Bookings);
                let total_booked= 0;
                for(let ent of Bookings) {
                    total_booked+=ent.reservation;
                }



                if(_chip.count - total_booked /*оставшееся кол-во*/ < end_count ) {
                    req.flash('errors', {msg: `На данный момент эта сумма не доступна. Доступно ${(_chip.count - total_booked).toFixed(2)} ${_chip._chip_page.currency_plural}`});
                    return res.redirect('/chips/offer/' + req.body.chip_id + '?pay=' + req.body.ipay + '&nick=' + req.body.charname);
                }



                //console.log('comission: ', commission, 'price pre one: ', price_per_one, ' ipay: ', req.body.ipay, ' end count: ',end_count);
                let order = {};
                order.chip_id = req.body.chip_id;
                order.coins_amount = end_count;
                order.sum = parseFloat(req.body.ipay).toFixed(2);
                order.payment_method = req.body.paymentMethod;
                order.type = 'chip';
                order.charname = req.body.charname;
                order.ps_method_title = _ps.title;
                order.seller_online = ((moment().unix()- moment(_chip._owner.lastActive).unix())/60) < 15;

                if(_chip.server_id)
                    _chip._server = _chip._chip_page.servers.id(_chip.server_id);
                if(_chip.side_id)
                    _chip._side = _chip._chip_page.sides.id(_chip.side_id);

                res.render('pages/chip/create_order', {
                    offer: _chip,
                    order: order,
                    title: 'Подтверждение заказа'
                });
            });
        });


    });
};
