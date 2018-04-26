'use strict';
const async = require('async');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const passport = require('passport');
const User = require('../models/User');
const Operations = require('../models/Operations');
const SellersStats = require('../models/SellersStats');
const ReferralStats = require('../models/ReferralStats');
const OTP = require('otp.js');
const GA = OTP.googleAuthenticator;
const Helper = require('../helpers/helper');
const PS = require('../models/PaymentSystem');
const Chip = require('../models/Chip');
const Lot = require('../models/Lot');
const Log = require('../models/Log');
const moment = require('moment');
const numeral = require('numeral');
const mongoose = require('mongoose');
const validator = require('validator');
const recaptcha2 = require('recaptcha2');
const percent = require("percent-value");
const recaptcha = new recaptcha2({
    siteKey:'6Lcj6B8UAAAAABHzhbZwkiUEJT_TgkSf0FclMTMD',
    secretKey:'6Lcj6B8UAAAAAAILTK_vVNtIJKcdmqZBCm77yT4a'
});
var smsc = require('node-smsc')({
    login: process.env.SMSC_LOGIN,
    password: process.env.SMSC_MD5_PASSWORD,
    hashed: true,
});

exports.getUser = (req, res, next) => {
    if (req.params.uid) {
        User.findOne({_id: req.params.uid}, (err, _user) => {
            if (err) return res.redirect('/');
            moment.locale('ru');
            let MinutesFromLastActive = (moment().unix() - moment(_user.lastActive).unix()) / 60;
            let regDates = {};

            regDates.Date = moment(_user.createdAt).format('DD MMMM');
            regDates.Time = moment(_user.createdAt).format('HH:mm');
            regDates.DateFromNow = moment(_user.createdAt).fromNow();

            let lastActiveDates = {};
            if (MinutesFromLastActive > 15) {
                lastActiveDates.Date = moment(_user.lastActive).format('DD MMMM');
                lastActiveDates.Time = moment(_user.lastActive).format('HH:mm');
                lastActiveDates.DateFromNow = moment(_user.lastActive).fromNow();
            }
            let reviews = [];
            //_user.comments;
            if(_user.comments)
            for(let com_id in _user.comments.toObject()) {
                _user.comments[com_id].time =  moment( _user.comments[com_id].date).fromNow();
            }

            PS.findOne({active:true}).sort({commision: 1}).exec((err, ps)=> {
                let lowest_commission = ps.commision | 0;
                Chip.find({_owner: req.params.uid}).sort({_game: -1}).populate('_game _chip_page').exec((err, chips) => {
                    if (err) return next(err);

                    for (let skey in chips) {
                        if (chips.hasOwnProperty(skey)) {
                            chips[skey]._owner._createdAt = moment(chips[skey]._owner.createdAt).fromNow(true);

                            let commission = percent(parseFloat(process.env.COMMISSION) + chips[skey]._chip_page.commission + lowest_commission).from(chips[skey].price);
                            chips[skey].price = (chips[skey].price + commission).toFixed(2);
                        }
                    }

                    Lot.find({_owner: req.params.uid}).sort({_game: -1}).populate('_game _lot_page').exec((err, lots) => {
                        if (err) return next(err);

                        for (let skey in lots) {
                            if (lots.hasOwnProperty(skey)) {
                                lots[skey]._owner._createdAt = moment(lots[skey]._owner.createdAt).fromNow(true);

                                let commission = percent(parseFloat(process.env.COMMISSION) + lots[skey]._lot_page.commission + lowest_commission).from(lots[skey].price);
                                lots[skey].price = (lots[skey].price + commission).toFixed(2);
                            }
                        }
                        //console.log(lots);

                        res.render('user/page', {
                            isAdmin: _user.isAdmin,
                            title: 'Пользователь ' + _user.username,
                            uname: _user.username,
                            reviews: _user.comments,
                            numeral: numeral,
                            lots: lots,
                            chips: chips,
                            uid: _user._id,
                            regDates: regDates,
                            lastactive: MinutesFromLastActive,
                            lastDates: lastActiveDates,
                        });
                    });


                });
            });

        });
    }
};


/**
 * GET /login
 * Login page.
 */
exports.getLogin = (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }
    res.render('account/login', {
        menuCode: 102,
        title: 'Вход'
    });
};

/**
 * POST /login
 * Sign in using email and password.
 */
exports.postLogin = (req, res, next) => {
    recaptcha.validateRequest(req)
        .then(function() {
            req.assert('email', 'Email не верный').isEmail();
            req.assert('password', 'Пароль не может быть пустым').notEmpty();
            if (req.body.code)
                req.assert('code', 'Нужен код аутентификации').notEmpty();

            req.sanitize('email').normalizeEmail({remove_dots: false});

            const errors = req.validationErrors();

            if (errors) {
                req.flash('errors', errors);
                return res.redirect('/login');
            }

            passport.authenticate('local', (err, user, info) => {
                if (err) {
                    return next(err);
                }
                if (!user) {
                    req.flash('errors', info);
                    if (info.user) {
                        let log = new Log({
                            user: info.user._id,
                            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                            description: 'Не удачная попытка входа',
                            type: 'danger'
                        });
                        log.save();
                    } else {
                        let log = new Log({
                            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                            description: 'Не удачная попытка входа ' + req.body.email + ':' + req.body.password,
                            type: 'danger'
                        });
                        log.save();
                    }
                    return res.redirect('/login');
                }
                if (user.otp.enabled) {
                    let result = null;
                    if (req.body.code) {
                        try {
                            result = GA.verify(req.body.code, user.otp.code);

                            if (result === null) {
                                req.flash('errors', {msg: 'Не правильный код!'});
                            }
                        } catch (e) {
                            req.flash('errors', {msg: 'Не правильный код!'});
                        }
                    }

                    if (result === null || !req.body.code)
                        return res.render('account/login', {
                            menuCode: 102,
                            credentials: {
                                login: req.body.email,
                                password: req.body.password,
                            },
                            title: 'Вход'
                        });


                }

                req.logIn(user, (err) => {
                    if (err) {
                        return next(err);
                    }

                    //if(user.isAdmin) {
                    let log = new Log({
                        user: user._id,
                        ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                        description: 'Успешный вход',
                        type: 'info'
                    });
                    log.save();
                    req.session.ip = log.ip;
                    // }
                    req.flash('success', {msg: 'Вы успешно вошли в свой аккаунт.'});
                    res.redirect(req.session.returnTo || '/');
                });
            })(req, res, next);
        }).catch((errorCodes)=> {
            // invalid captcha
            req.flash('errors', {msg: 'Подтвердите что вы не робот.'});
            return res.redirect('/login');
        });

};

/**
 * GET /logout
 * Log out.
 */
exports.logout = (req, res) => {
    req.logout();
    res.redirect('/');
};
exports.postBeSeller = (req, res, next) => {
    recaptcha.validateRequest(req)
        .then(function(){
            let code = Math.floor((Math.random() * 100000) + 100000);
            User.findByIdAndUpdate(req.user._id, {
                $set: {
                    'phone.code': code,
                    'phone.errors': 0,
                    'phone.number': req.body.phone
                }
            }).exec((err) => {
                if(err) next(err)
            });

            console.log`Sending SMS to ${req.body.phone} with code ${code}`;
            smsc.send({
                phones: req.body.phone,
                mes: `Ваш код для Play4Pay: ${code}!`,
            });
            return res.json({errors: 0, redirect:'/'});
        }).catch(function(errorCodes){
            // invalid captcha
            return res.json({errors: 1, message: "Проверка на бота не пройдена",redirect:'/'});
        });
};

exports.postBeSeller2 = (req, res, next) => {

    User.findById(req.user._id, (err, user) => {
        if(err || !user) return res.json({errors: 1, message:'Ошибка при запросе', redirect:'/'});
        if(!user.phone) {
            user.phone = {code:"", number:"", errors:0};
        }

        if (!user.phone.code) user.phone.code = "";
        if (!user.phone.number) user.phone.number = "";
        if (!user.phone.errors) user.phone.errors=0;

        if(user.phone.code !== "" && req.body.code !== "" && user.phone.code.toUpperCase() === req.body.code.toUpperCase() && user.phone.errors <= 3) {
            user.isSeller = true;
            user.phone.code = "";
            user.phone.errors = 0;
            user.save();
            req.flash('info',{msg:"Вы успешно стали продавцом!"});
            return res.json({errors: 0, redirect:'/'});

        } else {
            if(user.phone.errors <= 3) {
                user.phone.errors += 1;
                user.save();
                return  res.json({errors: 1, message: "Не верный код.",redirect:'/'});
            } else {
                user.phone.code = "";
                user.save();
                return  res.json({errors: 1, message: "Слишком много безуспешных попыток.",redirect:'/'});
            }

        }
    });


};

exports.getResendActivation = (req,res, next) => {
res.render('account/resend-email',{
    title: "Не пришло письмо?"
});
};

exports.postResendActivation = (req, res, next) => {
    req.assert('email', 'Пожалуйста введите настоящий email адрес.').isEmail();
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();
    if (errors) {
        req.flash('errors', errors);
        res.render('account/resend-email',{
            title: "Не пришло письмо?",
            email: req.body.email
        });
        return false;
    }
    recaptcha.validateRequest(req)
        .then(function(){
            User.findOne({email: req.body.email}, (err, user) => {
                if(err || !user) {
                    req.flash('errors',  {msg: 'Пользователь с данным email не найден.'});
                    res.render('account/resend-email',{
                        title: "Не пришло письмо?",
                        email: req.body.email
                    });
                    return false;
                } else {
                    if(user.activated) {
                        req.flash('info',  {msg: 'Вы уже подтвердили свой email и можете войти на сайт.'});
                        return res.redirect('/');
                    }
                    user.activationKey = Math.random().toString(36).substring(2, 38);
                    user.save((err) => {
                        if(err) return next(err);

                        const transporter = nodemailer.createTransport({
                            service: 'Mailgun',
                            auth: {
                                user: process.env.MAILGUN_USER,
                                pass: process.env.MAILGUN_PASSWORD
                            }
                        });
                        const mailOptions = {
                            to: user.email,
                            from: 'noreply@mg.play4play.ru',
                            subject: 'Подтверждение почты на Play4Pay',
                            text: `Вы получили эту почту так как кто-то (возможно вы) запросили ссылку для подтверждения регистрации на сайте.\n\n
          Для подтверждения регистрации пожалуйста перейдите по ссылке:\n\n
          http://${req.headers.host}/confirm-email/${user.activationKey}\n\n
          Если вы не запрашивали эту ссылку, пожалуйста игнорируйте этот email.\n`
                        };
                        transporter.sendMail(mailOptions, (err) => {
                            req.flash('info', {msg: `Вам отправлен e-mail на ${user.email}. Следуйте инструкциям.`});
                            res.redirect('/');
                            if(err) return next(err);
                        });
                    });
                }

            });
        })
        .catch(function(errorCodes){
            // invalid captcha
            req.flash('errors', {msg: 'Подтвердите что вы не робот.'});
            res.render('account/resend-email',{
                title: "Не пришло письмо?",
                email: req.body.email
            });
        });
};

exports.getActivateUser = (req, res, next) => {
    if(req.params.key && req.params.key.trim() !== "") {
        User.findOne({activationKey: req.params.key}).exec((err, user) => {
            if(err || !user) return res.redirect('/');
            user.activated = true;
            user.activationKey = "";
            user.save((err) => {
                //req.flash('info', {msg: 'Аккаунт успешно подтверждён.'});
                req.logIn(user, (err) => {
                    if (err) {
                        return next(err);
                    }
                    //if(user.isAdmin) {
                    let log = new Log({
                        user: user._id,
                        ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                        description: 'Подтвердил email и вошел на сайт.',
                        type:'info'
                    });
                    log.save();
                    req.session.ip = log.ip;
                    // }
                    res.redirect('/thank-you-for-registration');
                });
            });
        })
    } else {
        return res.redirect('/');
    }
};
/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = (req, res) => {
    let need_promo = false;//req.hostname.indexOf("www") !== 0 && !req.session.invitedBy;


    if (req.user) {
        return res.redirect('/');
    }
    if (req.query.social && !req.session.socialReg) {
        res.redirect('/login');
    } else {
        if (req.query.social && req.session.socialReg) {
            res.render('account/social-signup', {
                title: 'Регистрация',
                menuCode: 101,
                need_promo: need_promo,
                profileLink: req.session.profileLink,
                profilePhoto: req.session.profilePhoto,
                profileName: req.session.profileName,
            });
        } else {
            res.render('account/signup', {
                title: 'Регистрация',
                need_promo: need_promo,
                menuCode: 101,
            });
        }

    }

};

/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = async (req, res, next) => {
    try {
        const sess = req.session;

        if (!sess.socialReg || !sess.accessToken)
            await recaptcha.validateRequest(req);
        let need_promo = false;//req.hostname.indexOf("www") !== 0;

        const user = new User();

        if (sess.socialReg && sess.accessToken) {
            req.assert('username', 'Имя указано не верно').matches(/[a-zA-Z0-9]{4,20}/,'i').notEmpty().len(4, 20);
        } else {
            req.assert('username', 'Имя указано не верно').matches(/[a-zA-Z0-9]{4,20}/,'i').notEmpty().len(4, 20);
            req.assert('email', 'Email is not valid').isEmail();
            req.assert('password', 'Password must be at least 4 characters long').len(4);
            req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password);
            req.sanitize('email').normalizeEmail({remove_dots: false});
        }
        if(need_promo && !req.session.invitedBy) {
            req.assert('promo', 'Неверный код приглашения').notEmpty();
        }

        const errors = req.validationErrors();

        if (errors) {
            req.flash('errors', errors);
            return res.redirect('/signup' + sess.socialReg ? "?social=1" : "");
        }


        let existingUser = await User.findOne({username: req.body.username});

        if (existingUser) {
            req.flash('errors', {msg: 'Данное имя уже занято, попробуйте ещё раз.'});
            return res.redirect('/signup'+ (sess.socialReg ? "?social=1" : ""));
        }

        const accessToken = sess.accessToken;

        if (sess.socialReg && accessToken) {

            user.username = req.body.username;
            user[sess.profileProvider] = sess.profileId;
            user.tokens.push({kind: sess.profileProvider, accessToken});
            user.profile.name = sess.profileName;
            user.profile.picture = sess.profilePhoto;
            user.profile.website = sess.profileLink;
            user.email = sess.profileEmail;
            user.promo = Math.random().toString(36).substring(2, 6).toUpperCase();

            if(need_promo && !req.session.invitedBy) {
                let usr = await User.findOne({promo: req.body.promo});
                if (usr && '_id' in usr) {
                    user.invitedBy = usr._id;
                    User.update({_id: user.invitedBy},{
                        $inc: {
                            'referral.registrations' : 1
                        }
                    }).exec((err)=> {
                        if(err) console.error(err);
                    });
                } else {
                    req.flash('errors', {msg: 'Код приглашения не найден, если у Вас нет кода - обратитесь пожалуйста в онлайн поддержку.'});
                    return res.redirect('/signup?social=1');
                }
            } else if(req.session.invitedBy) {
                user.invitedBy = req.session.invitedBy;
                User.update({_id: user.invitedBy},{
                    $inc: {
                        'referral.registrations' : 1
                    }
                }).exec((err)=> {
                    if(err) console.error(err);
                });
            }

            user.save((err) => {
                if (err) {
                    return next(err);
                }
                sess.socialReg = null;
                sess.accessToken = null;
                req.logIn(user, (err) => {
                    if (err) {
                        return next(err);
                    }
                    //if(user.isAdmin) {
                    let log = new Log({
                        user: user._id,
                        ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                        description: 'Зарегистрировался и вошел через ВК',
                        type:'info'
                    });
                    log.save();
                    req.session.ip = log.ip;
                    // }
                    res.redirect('/thank-you-for-registration');
                });
            });

        } else {

            user.username = req.body.username;
            user.email = req.body.email;
            user.promo = Math.random().toString(36).substring(2, 6).toUpperCase();
            user.password = req.body.password;
            user.activationKey = Math.random().toString(36).substring(2, 38);
            let existingUser = await User.findOne({email: req.body.email});
            if (existingUser) {
                req.flash('errors', {msg: 'Аккаунт с данным Email уже существет.'});
                return res.redirect('/signup');
            }

            if(need_promo && !req.session.invitedBy) {
                let usr = await User.findOne({promo: req.body.promo});
                if (usr && '_id' in usr) {
                    user.invitedBy = usr._id;
                    User.update({_id: user.invitedBy},{
                        $inc: {
                            'referral.registrations' : 1
                        }
                    }).exec((err)=> {
                        if(err) console.error(err);
                    });
                } else {
                    req.flash('errors', {msg: 'Код приглашения не найден, если у Вас нет кода - обратитесь пожалуйста в онлайн поддержку.'});
                    return res.redirect('/signup');
                }
            } else if(req.session.invitedBy) {
                user.invitedBy = req.session.invitedBy;
                User.update({_id: user.invitedBy},{
                    $inc: {
                        'referral.registrations' : 1
                    }
                }).exec((err)=> {
                    if(err) console.error(err);
                });
            }

            await user.save();

            const transporter = nodemailer.createTransport({
                service: 'Mailgun',
                auth: {
                    user: process.env.MAILGUN_USER,
                    pass: process.env.MAILGUN_PASSWORD
                }
            });
            const mailOptions = {
                to: user.email,
                from: 'noreply@mg.play4play.ru',
                subject: 'Подтверждение почты на Play4Pay',
                text: `Вы получили эту почту так как кто-то (возможно вы) зарегистрировались на сайте Play4Pay.\n\n
                                  Для подтверждения регистрации пожалуйста перейдите по ссылке:\n\n
                                  http://${req.headers.host}/confirm-email/${user.activationKey}\n\n
                                  Если вы не регистрировались на этом, пожалуйста игнорируйте этот email.\n`
            };
            transporter.sendMail(mailOptions, (err) => {

                if (err) return next(err);
            });

            req.flash('info', {msg: `Вам отправлен e-mail для подтверждения регистрации на ${user.email}. Следуйте инструкциям.`});
            res.redirect('/');

        }


    } catch (e) {
        console.error(e);
        if(e[0] && e[0] === 'missing-input-response') {
            req.flash('errors', {msg: "Докажите что вы не бот"});
            return res.redirect('/signup');
        } else {
            req.flash('errors', {msg: e.message || e[0]});
            return res.redirect('/signup' + (req.session.socialReg ? "?social=1" : ""));
        }
    }

};

/**
 * GET /account/wallets
 * Profile page.
 */
exports.getWallets = (req, res) => {
    let wallets = [];
    if(req.user.wallets && req.user.wallets.length > 0) {
        for (let wallet of req.user.wallets) {
            wallets.push({ftype: wallet.type, name: wallet.wallet});
        }
    }

    res.render('account/wallets', {
        title: 'Кошельки',
        wallets: wallets,
        menuCode: 100,
        headerCode: 502
    });
};


exports.postWallets = async (req, res) => {
    if (req.body.custom_fields && req.body.custom_fields.length > 0) {
        let errors = {};
        await User.update({_id: req.user._id}, {$set: {wallets:  []}}).exec();

        for (let i in req.body.custom_fields) {

            if (
                req.body.custom_fields[i]
                && req.body.custom_fields[i].hasOwnProperty('ftype')
                && req.body.custom_fields[i].hasOwnProperty('name')
            ) {

                let type = req.body.custom_fields[i]['ftype'];
                let wallet = req.body.custom_fields[i]['name'];

                switch (type) {
                    case "webmoney":
                        if(wallet.trim() == "") {
                            delete req.body.custom_fields[i];
                            break;
                        }
                        if(wallet[0] === "R" && wallet.length === 13) {
                            User.update(
                                {_id: req.user._id},
                                {$addToSet: {wallets: {type: type, wallet: wallet}}},
                                {upsert: true},
                                (err, numAffected)=>{}
                            );
                        } else {
                            req.body.custom_fields[i]['error'] = "Поле должно быть вида R123456789123";
                        }
                        break;
                    case "qiwi":
                        if(wallet.trim() == "") {
                            delete req.body.custom_fields[i];
                            break;
                        }
                        if(wallet[0] === "+" && wallet.length >= 12 && wallet.length <= 14) {
                            User.update(
                                {_id: req.user._id},
                                {$addToSet: {wallets: {type: type, wallet: wallet}}},
                                {upsert: true},
                                (err, numAffected)=>{}
                            );
                        } else {
                            req.body.custom_fields[i]['error'] = "Поле должно быть вида +18001234567";
                        }
                        break;
                    case "yandex":
                        if(wallet.trim() == "") {
                            delete req.body.custom_fields[i];
                            break;
                        }
                        if(wallet.slice(0,4) === "4100" && wallet.length >= 14 && wallet.length <= 16) {
                            User.update(
                                {_id: req.user._id},
                                {$addToSet: {wallets: {type: type, wallet: wallet}}},
                                {upsert: true},
                                (err, numAffected)=>{}
                            );
                        } else {
                            req.body.custom_fields[i]['error'] = "Поле должно быть вида 410012345678912";
                        }
                        break;
                }

            }

            if(i >= req.body.custom_fields.length-1) {

                res.render('account/wallets', {
                    title: 'Кошельки',
                    wallets: req.body.custom_fields,
                    menuCode: 100,
                    headerCode: 502
                });
            }

        }
    }

};

/**
 * GET /account/wallets
 * Profile page.
 */
exports.getNotifications = (req, res) => {
    res.render('account/notifycations', {
        title: 'Уведомления',
        menuCode: 100,
        headerCode: 503
    });
};
exports.postNotifications = (req, res) => {

        let toggle = ('notify' in req.body &&  req.body.notify === 'on');
        User.update({_id: req.user._id}, {notifications: toggle}).exec((err) => {
            res.redirect('/account/notifications');
        });

};
exports.postNotificationsBrowser = (req, res) => {
    if(req.body.property) {
        if(req.body.property === "notification") {
            User.findByIdAndUpdate(req.user._id,
                {
                    $set: {
                        'push_notifications.enabled': req.body.status || false,

                    }
                }).exec();
        }
        if(req.body.property === "after_purchase") {
            User.findByIdAndUpdate(req.user._id,
                {
                    $set: {
                        'sms_notifications.after_purchase': req.body.status || false,

                    }
                }).exec();
        }
        if(req.body.property === "on_new_chat") {
            User.findByIdAndUpdate(req.user._id,
                {
                    $set: {
                        'sms_notifications.on_new_chat': req.body.status || false,

                    }
                }).exec();
        }
    }
    res.json({sucess:true, errors:0});
};
exports.postAddNotificationsDevice = (req, res) => {
    User.findByIdAndUpdate(req.user._id,
        {
            $addToSet: {
                'push_notifications.tokens' : req.body.token
            }
        }).exec();
    res.json({sucess:true, errors:0});
};

exports.getWithdrawal = (req, res, next) => {
    let wallets = {webmoney:[],qiwi:[],yandex:[]};
    for(let wallet of req.user.wallets) {
        wallets[wallet.type].push(wallet.wallet);
    }

    res.render('account/withdrawal', {
        title: 'Уведомления',
        wallets: wallets,
        type: req.params.method,
        menuCode: 100,
        headerCode: 503
    });
};
exports.postWithdrawal = async (req, res, next) => {
    try {
        if (req.body.sum && req.body.type && req.body.type) {
            if (!validator.isFloat(req.body.sum, {min: 10, max: 9000})) {
                req.flash('errors', {msg: "Не верно указана сумма. Минимальная сумма для вывода 10 рублей и максимальная 9000"});
                return res.redirect('/account/balance');
            }
            if (!validator.isIn(req.body.type, ['qiwi', 'webmoney', 'yandex'])) {
                req.flash('errors', {msg: "Не верно указана платёжная система."});
                return res.redirect('/account/balance');
            }
            let wallet = req.body.purse;
            let type = req.body.type;
            let sum = parseFloat(req.body.sum);
            if (req.user.balances[type] < sum) {
                req.flash('errors', {msg: "Сумма для вывода привышает баланс."});
                return res.redirect('/account/balance');
            }

            switch (req.body.type) {
                case "webmoney":
                    if (wallet[0] === "R" && wallet.length === 13) {
                      /*  await User.update(
                            {_id: req.user._id, 'wallets.wallet': {$in: [wallet]}},
                            {$addToSet: {wallets: {$each: [{type: type, wallet: wallet}]}}});*/
                    } else {
                        req.flash('errors', {msg: "Кошелек должен быть вида R123456789123"});
                        return res.redirect('/account/balance');
                    }
                    break;
                case "qiwi":
                    if (wallet[0] === "+" && wallet.length >= 12 && wallet.length <= 14) {
                        /*await User.update(
                            {_id: req.user._id},
                            {$addToSet: {wallets: {type: type, wallet: wallet}}});*/
                    } else {
                        req.flash('errors', {msg: "Кошелек должен быть вида +18001234567"});
                        return res.redirect('/account/balance');
                    }
                    break;
                case "yandex":
                    if (wallet.slice(0, 4) === "4100" && wallet.length === 15) {
                        /*await User.update(
                            {_id: req.user._id},
                            {$addToSet: {wallets: {type: type, wallet: wallet}}});*/
                    } else {
                        req.flash('errors', {msg: "Кошелек должен быть вида 410012345678912"});
                        return res.redirect('/account/balance');
                    }
                    break;
            }

            let user = await User.findOne({_id: req.user._id});
            user.balances[type] -= sum;
            user.balances[type] = parseFloat(user.balances[type].toFixed(2));
            user.save();

            let user_operation = mongoose.Types.ObjectId();

            let Operation = new Operations();
            Operation.type = type;
            Operation.user = user._id;
            Operation.user_operation = user_operation;
            Operation.sum = sum;
            Operation.in_out = 'withdraw';
            Operation.wallet = wallet;
            await Operation.save();


            let SellersStat = new SellersStats({
                sum: sum,
                operation: 'output',
                user: user._id,
                need_confirmation: true,
                user_operation: user_operation,
                wallet: type,
                purse: wallet,
                searchable: {
                    username: user.username,
                    date: moment().format('HH:mm:ss DD.MM.YYYY'),
                    description: Helper.OperationWallet(type) + ' на ' + wallet
                }
            });
            SellersStat.save();


            await User.update({_id: req.user._id},
                {
                    $push: {
                        operations: {
                            _id: user_operation,
                            type: 'out',
                            subject: 'Вывод средств',
                            status: 'pending',
                            sum: sum,
                            ps: Helper.OperationWallet(type)
                        }
                    }
                });




            req.flash('info', {msg: 'Заявка на вывод успешно создана и будет обработана в течении 24 часов.'});
            return res.redirect('/account/balance');

        }
    } catch (err) {
        req.flash('errors', {msg: err.message});
        return res.redirect('/account/balance');
    }
};
exports.postAcceptChanged = async (req, res, next) => {
    try {
        if(!req.body.for )
            throw new Error('Status not found');
        let ps = '';
        switch (req.body.for) {
            case 'acceptWM':
                ps = 'webmoney';
                break;
            case "acceptYandex":
                ps = 'yandex';
                break;
            case "acceptQiwi":
                ps = 'qiwi';
                break;
            default:
                throw new Error("payment system not found");
                break;
        }
        let $set = {
            accepting: req.user.accepting
        };
        $set.accepting[ps] = req.body.status;

        await User.update({_id: req.user._id},
            {
                $set: $set
            }
        );
        res.json({errors: 0, msg: "Успешно сохранено!"});

    } catch (err) {
        res.json({errors: 1, msg: err.message});
    }
};

/**
 * GET /account/balance
 * Balance page.
 */
exports.getBalance = async (req, res) => {
    try {
        let wallets = {webmoney: [], qiwi: [], yandex: []};
        for (let wallet of req.user.wallets) {
            wallets[wallet.type].push(wallet.wallet);
        }
        let user = await User.findOne({_id: req.user._id});
        //console.log(user.operations);
        res.render('account/balance', {
            title: 'Баланс',
            moment: moment,
            wallets: wallets,
            accepting: req.user.accepting,
            balances: user.balances,
            operations: user.operations,
            menuCode: 100,
            headerCode: 500
        });
    } catch (err) {
        console.error(err);
        req.flash('errors',{msg: err.message});
        res.redirect('/');
    }
};

exports.getOTPauth = (req, res, next) => {

    res.render('account/otp',{
        menuCode: 102,
    });
};
exports.postOTPauth =async (req, res, next) => {

    if(req.session.needOTP && req.session.userOTP) {
        if(req.params.cancel)
        {
            delete req.session.needOTP;
            delete req.session.userOTP;
            return res.redirect(req.session.returnTo);
        }
        let user = await User.findById(req.session.userOTP);
        let result = null;
        if(req.body.code) {

            try {


                result = GA.verify(req.body.code, user.otp.code);

                if (result === null) {
                    //if(user.isAdmin) {
                    let log = new Log({
                        user: user._id,
                        ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                        description: 'Ввёл не верный OTP код!',
                        type:'danger'
                    });
                    log.save();
                    req.session.ip = log.ip;
                    // }
                    req.flash('errors', {msg: 'Не правильный код!'});
                }
            } catch (e) {
                req.flash('errors', {msg: 'Не правильный код!'});
            }
        }

        if(result === null || !req.body.code)
            return res.render('account/otp', {
                menuCode: 102,
                title: 'Вход'
            });

        req.logIn(user, (err) => {
            if (err) {
                return next(err);
            }
            delete req.session.needOTP;
            delete req.session.userOTP;

            let log = new Log({
                user: user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: 'Успешный вход',
                type:'info'
            });
            log.save();
            req.session.ip = log.ip;

            req.flash('success', {msg: 'Вы успешно вошли в свой аккаунт.'});
            res.redirect(req.session.returnTo || '/');
        });
    }

};
/**
 * GET /account
 * Profile page.
 */
exports.getAccount = (req, res) => {
    let secret = GA.secret();
    if(!req.user.otp.code) {
        User.update({_id: req.user._id}, {
            $set: {
                'otp.code': secret,
                'otp.enabled': false
            }
        }).exec();
    } else {
        secret = req.user.otp.code;
    }

    let qrCode = GA.qrCode(req.user.username, 'Play4Pay.ru', secret);

    res.render('account/profile', {
        qrcode: qrCode,
        secret: secret,
        title: 'Профиль',
        menuCode: 100,
        headerCode: 501
    });
};


exports.postEnable2fa = (req, res, next) => {
    if(!req.body.code)
        return res.redirect('/account/profile');
    try {

        let result = GA.verify(req.body.code, req.user.otp.code);

        if(result === null) {
            req.flash('errors',{msg: 'Не правильный код!'});
            return res.redirect('/account/profile');
        }

        User.update({_id:req.user._id}, {
            $set: {
                'otp.enabled': !req.user.otp.enabled
            }
        }).exec((err) =>{
            if(err) next(err);
            return res.redirect('/account/profile');
        });

    } catch (e) {

        req.flash('errors',{msg: 'Не правильный код!'});
        return res.redirect('/account/profile');

    }

};

exports.getPartner = (req, res) => {

    res.render('account/partner', {
        title: 'Партнёрскся программа',
        menuCode: 100,
        headerCode: 504
    });
};
exports.getEnablePartner = (req, res, next) => {
    let uid = req.user.id;

    if(mongoose.Types.ObjectId.isValid(uid)) {
        User.findByIdAndUpdate(uid, {
            $set : {
                'referral.enabled': true
            }
        }).exec((err) => {
            if(err) console.error(err);
        });
        res.redirect('/account/partner');
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.json({ success: 0 });
    }
};
exports.getPartnerWithdraw = (req, res, next) => {
    try {
        if(req.user.referral.balance < 50) {
            throw new Error('Минимальная сумма для вывода 50 рублей.')
        }
        if(!req.query.ps || !validator.isIn(req.query.ps, ['qiwi','webmoney','yandex']))
            throw new Error('Не выбрана платёжная система!');
        let user_operation = mongoose.Types.ObjectId();
        User.update({_id: req.user._id},{
            $push: {
                operations: {
                    _id: user_operation,
                    type: 'in',
                    subject: 'Вывод партнёрских бонусов.',
                    status: 'pending',
                    sum: req.user.referral.balance,
                    ps: Helper.OperationWallet(req.query.ps)
                }
            },
            $set: {
                'referral.balance':0.0
            }
        }).exec();

        let RefStat = new ReferralStats({
            sum: req.user.referral.balance,
            operation: 'output',
            user: req.user,
            user_operation:user_operation,
            need_confirmation: true,
            purse: req.query.ps,
            searchable: {
                username: req.user.username,
                date: moment().format('HH:mm:ss DD.MM.YYYY'),
                description: 'Вывод с рефки'
            }
        });
        RefStat.save();
        res.json({errors: 0, message: 'success'});
    } catch (e) {
        res.json({errors: 1, message: e.message});
    }
};
/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = (req, res, next) => {
    req.assert('email', 'Пожалуйста введите настоящий email адрес.').isEmail();
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/account');
    }

    User.findById(req.user.id, (err, user) => {
        if (err) {
            return next(err);
        }
        user.email = req.body.email || '';
        user.name = req.body.username || '';
        user.profile.name = req.body.name || '';
        user.profile.gender = req.body.gender || '';
        user.profile.location = req.body.location || '';
        user.profile.website = req.body.website || '';
        user.save((err) => {
            if (err) {
                if (err.code === 11000) {
                    req.flash('errors', {msg: 'Указанный email уже асоцирован с другим аккаунтом.'});
                    return res.redirect('/account');
                }
                return next(err);
            }
            req.flash('success', {msg: 'Информация успешно обновлена.'});
            res.redirect('/account');
        });
    });
};

/**
 * POST /account/password
 * Update current password.
 */
exports.postUpdatePassword = (req, res, next) => {
    req.assert('password', 'Пароль должен содержать как минимум 6 символов').len(6);
    req.assert('confirmPassword', 'Пароли не совпадают').equals(req.body.password);

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/account');
    }

    User.findById(req.user.id, (err, user) => {
        if (err) {
            return next(err);
        }
        user.password = req.body.password;
        user.save((err) => {
            if (err) {
                return next(err);
            }
            req.flash('success', {msg: 'Пароль был изменён.'});
            res.redirect('/account');
        });
    });
};

/**
 * POST /account/delete
 * Delete user account.
 */
exports.postDeleteAccount = (req, res, next) => {
    User.remove({_id: req.user.id}, (err) => {
        if (err) {
            return next(err);
        }
        req.logout();
        req.flash('info', {msg: 'Your account has been deleted.'});
        res.redirect('/');
    });
};

/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
exports.getOauthUnlink = (req, res, next) => {
    const provider = req.params.provider;
    User.findById(req.user.id, (err, user) => {
        if (err) {
            return next(err);
        }
        user[provider] = undefined;
        user.tokens = user.tokens.filter(token => token.kind !== provider);
        user.save((err) => {
            if (err) {
                return next(err);
            }
            req.flash('info', {msg: `${provider} аккаунт был отключён.`});
            res.redirect('/account');
        });
    });
};

/**
 * GET /reset/:token
 * Reset Password page.
 */
exports.getReset = (req, res, next) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    User
        .findOne({passwordResetToken: req.params.token})
        .where('passwordResetExpires').gt(Date.now())
        .exec((err, user) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                req.flash('errors', {msg: 'Код сброса пароля не верен или истёк.'});
                return res.redirect('/forgot');
            }
            res.render('account/reset', {
                title: 'Сброс пароля'
            });
        });
};

/**
 * POST /reset/:token
 * Process the reset password request.
 */
exports.postReset = (req, res, next) => {
    req.assert('password', 'Пароль должен содержать 6 и более символов.').len(6);
    req.assert('confirm', 'Пароли не совпадают.').equals(req.body.password);

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('back');
    }

    async.waterfall([
        function (done) {
            User
                .findOne({passwordResetToken: req.params.token})
                .where('passwordResetExpires').gt(Date.now())
                .exec((err, user) => {
                    if (err) {
                        return next(err);
                    }
                    if (!user) {
                        req.flash('errors', {msg: 'Срок токена для сброса пароля истёк.'});
                        return res.redirect('back');
                    }
                    user.password = req.body.password;
                    user.passwordResetToken = undefined;
                    user.passwordResetExpires = undefined;
                    user.save((err) => {
                        if (err) {
                            return next(err);
                        }
                        req.logIn(user, (err) => {
                            let log = new Log({
                                user: user._id,
                                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                                description: 'Успешный вход',
                                type:'info'
                            });
                            log.save();
                            req.session.ip = log.ip;
                            done(err, user);
                        });
                    });
                });
        },
        function (user, done) {
            const transporter = nodemailer.createTransport({
                service: 'Mailgun',
                auth: {
                    user: process.env.MAILGUN_USER,
                    pass: process.env.MAILGUN_PASSWORD
                }
            });
            const mailOptions = {
                to: user.email,
                from: 'noreply@mg.play4play.ru',
                subject: 'Ваш пароль на Play4Pay был успешно изменён',
                text: "Здравствуйте,\n\nВы успешно изминили свой пароль для аккаунта " + user.email + ".\n"
            };
            transporter.sendMail(mailOptions, (err) => {
                req.flash('success', {msg: 'Успешно! Ваш пароль был изменён.'});
                done(err);
            });
        }
    ], (err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
};

/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/');
    }
    res.render('account/forgot', {
        title: 'Забыли пароль'
    });
};

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgot = (req, res, next) => {
    req.assert('email', 'Пожалуйста, введите правильны email адрес.').isEmail();
    req.sanitize('email').normalizeEmail({remove_dots: false});

    const errors = req.validationErrors();

    if (errors) {
        req.flash('errors', errors);
        return res.redirect('/forgot');
    }

    async.waterfall([
        function (done) {
            crypto.randomBytes(16, (err, buf) => {
                const token = buf.toString('hex');
                done(err, token);
            });
        },
        function (token, done) {
            User.findOne({email: req.body.email}, (err, user) => {
                if (!user) {
                    req.flash('errors', {msg: 'Аккаунт с таким email не существует.'});
                    return res.redirect('/forgot');
                }
                user.passwordResetToken = token;
                user.passwordResetExpires = Date.now() + 3600000; // 1 hour
                user.save((err) => {
                    done(err, token, user);
                });
            });
        },
        function (token, user, done) {
            const transporter = nodemailer.createTransport({
                service: 'Mailgun',
                auth: {
                    user: process.env.MAILGUN_USER,
                    pass: process.env.MAILGUN_PASSWORD
                }
            });
            const mailOptions = {
                to: user.email,
                from: 'noreply@mg.play4play.ru',
                subject: 'Reset your password on Play4Pay.ru',
                text: `You are receiving this email because you (or someone else) have requested the reset of the password for your account.\n\n
          Please click on the following link, or paste this into your browser to complete the process:\n\n
          http://${req.headers.host}/reset/${token}\n\n
          If you did not request this, please ignore this email and your password will remain unchanged.\n`
            };
            transporter.sendMail(mailOptions, (err) => {
                req.flash('info', {msg: `Вам отправлен e-mail на ${user.email}. Следуйте инструкциям.`});
                done(err);
            });
        }
    ], (err) => {
        if (err) {
            return next(err);
        }
        res.redirect('/forgot');
    });
};
