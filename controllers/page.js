'use strict';
const ChipPage = require('../models/ChipPage');
const LotPage = require('../models/LotPage');
const Chip = require('../models/Chip');
const Lot = require('../models/Lot');
const Log = require('../models/Log');
const Game = require('../models/Game');
const async = require('async');
const mongoose = require('mongoose');


exports.getAddPage = (req,res) => {
    res.render('pages/add', {
        title: "Добавить новую страницу"
    })
};
exports.getChipEditPage = (req,res,next) => {
    ChipPage.findOne({chip_id:req.params.chip}).populate('_game').exec((err,cp)=> {
        if(err) return next(err);
        res.render('pages/chip/edit', {
            cp: cp,
            title: "Редактировать страницу"
        });
    });
};


exports.getLotEditPage = (req,res,next) => {
    LotPage.findOne({lot_id:req.params.lot}).populate('_game').exec((err,lp)=> {
        if(err) return next(err);
        res.render('pages/lot/edit', {
            lp: lp,
            title: "Редактировать страницу"
        });
    });
};

exports.getLotDelete = (req,res,next) => {
    LotPage.findOne({lot_id:req.params.lot},(err,lp)=> {
        Lot.find({_lot_page:req.params.lot}).remove();
        LotPage.remove({_id: lp._id}).exec((err) => {
            if (err) return next(err);
            let log = new Log({
                user: req.user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: 'Удалена страница  '+lp.title,
                type:'info'
            });
            log.save();
            Game.findOneAndUpdate({_id:lp._game},
                {$pull: {childrens: {id: lp.lot_id}}},
                (err, _game) => {
                    if (err) return next(err);
                    Lot.remove({_lot_page: lp._id}).exec((err) => {
                        if (err) return next(err);
                        res.redirect('/');
                    });
                });
        });
    });
};

exports.getChipDelete = (req,res,next) => {
    ChipPage.findOne({chip_id:req.params.chip},(err,cp)=> {
        Chip.find({_chip_page:req.params.chip}).remove();
        ChipPage.remove({_id: cp._id}).exec((err) => {
            if (err) return next(err);
            let log = new Log({
                user: req.user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: 'Удалена страница  '+cp.title,
                type:'info'
            });
            log.save();
            Game.findOneAndUpdate({_id:cp._game},
                {$pull: {childrens: {id: cp.chip_id}}},
                (err, _game) => {
                    if (err) return next(err);
                    Chip.remove({_chip_page: cp._id}).exec((err) => {
                        if (err) return next(err);
                        res.redirect('/');
                    });
            });
        });
    });

};

exports.postAddPage = (req,res,next) => {
    if(req.body.title && req.body.gameType) {

        if(req.body.gameType == 'coins') {
            async.waterfall([
            (done)=> {
                if(!req.body.id) {
                    done(null,new ChipPage());
                } else {
                    ChipPage.findOne({chip_id: req.body.id}, (err, cp) => {

                        if (err) return next(err);
                        if (cp) done(null, cp);
                        else  done(null, new ChipPage());
                    });
                }
            },
            (cp,done)=> {

                cp.title = req.body.title;
                cp.currency = req.body.currency || '';
                cp.currency_plural = req.body.currency_plural || cp.currency;
                cp.currency_sell_count = req.body.price_for || 1;
                cp.currency_sell_sufix = req.body.sufix || '';
                cp._game =  req.params.gid || req.body.gid;

                cp.description = req.body.description || req.body.description;
                cp.seo_meta = req.body.seo_meta || req.body.seo_meta;
                cp.seo_tags = req.body.seo_tags || req.body.seo_tags;
                cp.page_title = req.body.page_title || req.body.page_title;
                cp.commission  = req.body.commission;
                cp.ref_commission = req.body.ref_commission;
                if (req.body.delete &&  typeof req.body.delete == 'object') {
                    for(let obj of req.body.delete) {
                        if(obj.indexOf('sides') !== -1) {
                            let side_id = obj.substring(6,30);
                            if(mongoose.Types.ObjectId.isValid(side_id)) {
                                cp.sides.pull({_id: side_id});
                                Chip.remove({side_id:side_id}).exec();
                            }
                        }
                        if(obj.indexOf('servers') !== -1) {
                            let server_id = obj.substring(8,32);
                            if(mongoose.Types.ObjectId.isValid(server_id)) {
                                cp.servers.pull({_id: server_id});
                                Chip.remove({server_id:server_id}).exec();
                            }
                        }
                    }
                }
                if (req.body.servers &&  typeof req.body.servers == 'object') {
                    for(let key in req.body.servers) {
                        if(req.body.servers.hasOwnProperty(key) && req.body.servers[key] != "") {
                            let server = {name: req.body.servers[key]};
                            if(mongoose.Types.ObjectId.isValid(key)) {
                                ChipPage.update(
                                    {chip_id: req.body.id, 'servers._id':key},
                                    {'servers.$.name':req.body.servers[key]}, (err,cp)=>{
                                        if(err) return next(err);
                                    });
                            }
                            else {
                                cp.servers.push(server);
                            }
                        }
                    }
                }

                if (req.body.sides &&  typeof req.body.sides == 'object') {
                    for(let key in req.body.sides) {
                        if(req.body.sides.hasOwnProperty(key) && req.body.sides[key] != "") {
                            let side = {name: req.body.sides[key]};
                            if(mongoose.Types.ObjectId.isValid(key)) {
                                ChipPage.update(
                                    {chip_id: req.body.id, 'sides._id':key},
                                    {'sides.$.name':req.body.sides[key]}, (err,cp)=>{
                                        if(err) return next(err);
                                    });
                            }
                            else {
                                cp.sides.addToSet(side);
                            }
                        }

                    }
                }

                cp.save((err) => {
                    if (err) { return next(err); }

                    let log = new Log({
                        user: req.user._id,
                        ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                        description: 'Добавлена или изменена страница  '+cp.title,
                        type:'info'
                    });
                    log.save();
                    done(err,cp);
                });
            }, (cp,done) => {

                if(!req.params.gid) {
                    Game.update({_id:cp._game ,'childrens.id':cp.chip_id, 'childrens.childType':'chips'},{'$set':{
                        'childrens.$.childName': cp.title
                    }},(err,num)=>{
                        if (err) {
                            req.flash('error', err);
                            return res.redirect('/');
                        }

                        req.flash('success', { msg: "Страница успешно изменена. "});
                        done(null,cp);
                    });

                } else {
                    Game.findOne({_id: req.params.gid}, (err, game) => {
                        if (err) {
                            req.flash('error', err);
                            return res.redirect('/');
                        }
                        var id = mongoose.Types.ObjectId();

                        game.childrens.addToSet({childType: 'chips', childName: cp.title, _id: id, id: cp.chip_id});
                        game.save((err)=> {
                            if (err) return next(err);
                            cp._children = id;
                            cp.save((err)=> {
                                if (err) return next(err);
                                req.flash('success', {msg: "Страница успешно добавлена."});
                                done(null,cp);
                            });
                        });
                    });
                }
            }, (cp,done)=>{
               // console.log(done);
                res.redirect('/chips/'+cp.chip_id+'/edit');
            }]);

        }

        if(req.body.gameType == 'accs') {

            async.waterfall([
                (done)=> {
                    if(!req.body.id) done(null,new LotPage());
                    LotPage.findOne({lot_id: req.body.id}, (err,lp)=>{
                        if(err) return next(err);

                        if(lp) done(null, lp);
                    });
                },
                (lp, done) => {
                    lp.title  = req.body.title;
                    lp._game = req.params.gid || req.body.gid;
                    lp.description = req.body.description || req.body.description;
                    lp.seo_meta = req.body.seo_meta || req.body.seo_meta;
                    lp.seo_tags = req.body.seo_tags || req.body.seo_tags;
                    lp.page_title = req.body.page_title || req.body.page_title;
                    lp.commission  = req.body.commission;
                    lp.ref_commission = req.body.ref_commission;
                    /* Удаление */
                    if (req.body.delete &&  typeof req.body.delete == 'object') {
                        for(let obj of req.body.delete) {
                            if(obj.indexOf('sides') !== -1) {
                                let side_id = obj.substring(6,30);
                                if(mongoose.Types.ObjectId.isValid(side_id)) {
                                    lp.sides.pull({_id: side_id});
                                    Lot.remove({side_id:side_id}).exec();
                                }
                            }
                            if(obj.indexOf('servers') !== -1) {
                                let server_id = obj.substring(8,32);
                                if(mongoose.Types.ObjectId.isValid(server_id)) {
                                    lp.servers.pull({_id: server_id});
                                    Lot.remove({server_id:server_id}).exec();
                                }
                            }

                            if(obj.indexOf('races') !== -1) {
                                let race_id = obj.substring(6,30);
                                if(mongoose.Types.ObjectId.isValid(race_id)) {
                                    lp.races.pull({_id: race_id});
                                    Lot.remove({race_id:race_id}).exec();
                                }
                            }

                            if(obj.indexOf('classes') !== -1) {
                                let class_id = obj.substring(8,32);
                                if(mongoose.Types.ObjectId.isValid(class_id)) {
                                    lp.classes.pull({_id: class_id});
                                    Lot.remove({class_id:class_id}).exec();
                                }
                            }

                            if(obj.indexOf('custom_fields') !== -1) {
                                let cf_id = obj.substring(14,38);
                                if(mongoose.Types.ObjectId.isValid(cf_id)) {
                                    lp.custom_fields.pull({_id: cf_id});
                                }
                            }
                        }
                    }

                    /* Обработка серверов */
                    if (req.body.servers &&  typeof req.body.servers == 'object') {
                        for(let key in req.body.servers) {
                            if(req.body.servers.hasOwnProperty(key) && req.body.servers[key] != "") {
                                let server = {name: req.body.servers[key]};
                                if(mongoose.Types.ObjectId.isValid(key)) {
                                    LotPage.update(
                                        {lot_id: req.body.id, 'servers._id':key},
                                        {'servers.$.name':req.body.servers[key]}, (err,lp)=>{
                                            if(err) return next(err);
                                        });
                                }
                                else {
                                    lp.servers.push(server);
                                }
                            }
                        }
                    }
                    /* Обработка сторон */
                    if (req.body.sides &&  typeof req.body.sides == 'object') {
                        for(let key in req.body.sides) {
                            if(req.body.sides.hasOwnProperty(key) && req.body.sides[key] != "") {
                                let side = {name: req.body.sides[key]};
                                if(mongoose.Types.ObjectId.isValid(key)) {
                                    LotPage.update(
                                        {lot_id: req.body.id, 'sides._id':key},
                                        {'sides.$.name':req.body.sides[key]}, (err,lp)=>{
                                            if(err) return next(err);
                                        });
                                }
                                else {
                                    lp.sides.addToSet(side);
                                }
                            }

                        }
                    }
                    /* Обработка рас */
                    if (req.body.races &&  typeof req.body.races == 'object') {
                        for(let key in req.body.races) {
                            if(req.body.races.hasOwnProperty(key) && req.body.races[key] != "") {
                                let race = {name: req.body.races[key]};
                                if(mongoose.Types.ObjectId.isValid(key)) {
                                    LotPage.update(
                                        {lot_id: req.body.id, 'races._id':key},
                                        {'races.$.name':req.body.races[key]}, (err,lp)=>{
                                            if(err) return next(err);
                                        });
                                }
                                else {
                                    lp.races.addToSet(race);
                                }
                            }

                        }
                    }
                    /* Обработка классов */
                    if (req.body.classes &&  typeof req.body.classes == 'object') {
                        for(let key in req.body.classes) {
                            if(req.body.classes.hasOwnProperty(key) && req.body.classes[key] != "") {
                                let _class = {name: req.body.classes[key]};
                                if(mongoose.Types.ObjectId.isValid(key)) {
                                    LotPage.update(
                                        {lot_id: req.body.id, 'classes._id':key},
                                        {'classes.$.name':req.body.classes[key]}, (err,lp)=>{
                                            if(err) return next(err);
                                        });
                                }
                                else {
                                    lp.classes.addToSet(_class);
                                }
                            }

                        }
                    }

                    if(req.body.custom_fields && typeof req.body.custom_fields == 'object') {
                        for(let key in req.body.custom_fields) {
                            if(req.body.custom_fields.hasOwnProperty(key) && req.body.custom_fields[key] ) {
                                let _custom_field = req.body.custom_fields[key];

                                if(mongoose.Types.ObjectId.isValid(key) ) {
                                    if(_custom_field.name != "") {
                                       // console.log(_custom_field.name, _custom_field.list);
                                        _custom_field.list = _custom_field.list.filter((n) => {return n!="";});
                                        LotPage.update(
                                            {lot_id: req.body.id, 'custom_fields._id': key},
                                            {
                                                'custom_fields.$.ftype': _custom_field.ftype,
                                                'custom_fields.$.name': _custom_field.name,
                                                'custom_fields.$.list': _custom_field.list,
                                            }, (err, lp) => {
                                                if (err) return next(err);
                                            });
                                    }
                                }
                                else {
                                    if(_custom_field.name != "")
                                        lp.custom_fields.push(_custom_field);
                                }
                            }
                        }
                    }

                    lp.ptype = "accs";
                    /* Сохранение */
                    lp.save((err) => {
                        if (err) { return next(err); }
                        let log = new Log({
                            user: req.user._id,
                            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                            description: 'Добавлена или изменена страница  '+lp.title,
                            type:'info'
                        });
                        log.save();
                        done(err,lp);
                    });
                }, (lp,done) => {

                    if(!req.params.gid) {

                        Game.findOne({_id:lp._game, 'childrens.id':lp.lot_id, 'childrens.childType':'lots'}, (err, game) => {
                           for(let id in game.childrens) {
                               if(!game.childrens.hasOwnProperty(id)) continue;
                               if(game.childrens[id].id === lp.lot_id && game.childrens[id].childType === 'lots') {
                                   game.childrens[id].childName = lp.title;
                                   game.save();
                                   break;
                               }
                           }
                            req.flash('success', {msg: "Страница успешно обновлена."});
                            done(null, lp);
                        });

                    } else {
                        Game.findOne({_id: req.params.gid}, (err, game) => {
                            if (err) {
                                req.flash('error', err);
                                return res.redirect('/');
                            }
                            var id = mongoose.Types.ObjectId();

                            game.childrens.addToSet({childType: 'lots', childName: lp.title, _id: id, id: lp.lot_id});
                            game.save((err)=> {
                                if (err) return next(err);
                                lp._children = id;
                                lp.save((err)=> {
                                    if (err) return next(err);
                                    req.flash('success', {msg: "Страница успешно добавлена."});
                                    done(null, lp);
                                });
                            });
                        });
                    }
                }, (lp,done)=>{

                    res.redirect('/lots/'+lp.lot_id+'/edit');
                }]);
        }
    }

};
