'use strict';
const Game = require('../models/Game');
const async = require('async');
const Log = require('../models/Log');
exports.getAddGame = (req,res,next) => {
    if(!req.user) return res.redirect('/');
    if(!req.user.isAdmin) return res.redirect('/');
    if(req.params.id) {
        Game.findOne({_id:req.params.id},(err, game) => {
            if (err) { return next(err); }

            res.render('game/edit', {
                game: game,
                title: "Изменить игру"
            });
        });
    } else {
        res.render('game/add', {

            title: "Добавить игру"
        });
    }
};

exports.postAddGame = (req,res,next) => {
    if(!req.user) return res.redirect('/');
    if(!req.user.isAdmin) return res.redirect('/');

    async.waterfall([(done) => {
        if(req.params.id) {
            Game.findOne({_id:req.body.id},(err, game) => {
                if (err) { return next(err); }
                done(err,game);
            });
        } else {
            const game = new Game();
            done(null,game);
        }
    }, (game, done) => {
        game.title = req.body.gameName;
        game.localization=req.body.locales;
        game.commission = req.body.commission;
        game.save((err)=>{
            if(err) return(next(err));

            let log = new Log({
                user: req.user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: 'Добавил игру изминил  '+game.title,
                type:'info'
            });
            log.save();

            res.redirect('/game/edit/'+game._id);
            req.flash('success', { msg: 'Успешно Добавлено!' });
            done(err);
        })
    }]);


};

exports.getRemoveGame = (req,res,next) => {
    if(!req.user) return res.redirect('/');
    if(!req.user.isAdmin) return res.redirect('/');
    if(req.params.id) {
        Game.remove({_id: req.params.id}, (err) => {
            if (err) {
                return next(err);
            }

            let log = new Log({
                user: req.user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: 'Удалил игру',
                type:'info'
            });
            log.save();
            req.flash('success', { msg: 'Успешно удалено!' });
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
};
