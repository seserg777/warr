'use strict';
const nodemailer = require('nodemailer');
const passport = require('passport');
const mongoose = require('mongoose');
const moment = require('moment');
const numeral = require('numeral');
const async = require('async');
const Chat =require('../models/Chat');
const percent = require("percent-value");
const Operations = require('../models/Operations');
const MainStats = require('../models/MainStats');
const PS = require('../models/PaymentSystem');
const Chip = require('../models/Chip');
const Order = require('../models/Order');
const Lot = require('../models/Lot');
const Log = require('../models/Log');
const User = require('../models/User');
const PublicChat = require('../models/PublicChat');
const Helper = require('../helpers/helper');

// Import a module
var CloudFlareAPI = require('cloudflare4');

// Create an instance with your API V4 credentials
var api = new CloudFlareAPI({email: 'o-sotnikova@yandex.ru', key: '05512fa6f4727f7b40feb5356190a984d3d6b'});

const PAGE_LIMIT = 10;
exports.getUsers = (req, res, next) => {

    let page = req.params.page ? req.params.page : 1;
    let search = req.query.search ? req.query.search : "";
    User.find({username: { "$regex": search, "$options": "i" } }).count().then((count) => {
        User.find({username: { "$regex": search, "$options": "i" } }).limit(PAGE_LIMIT).skip((page-1)*PAGE_LIMIT).exec((err, users) => {
            res.render('admin/users', {
                users: users,
                count: count,
                page: parseInt(page),
                adminPage: res.app.get('adminPage'),
                limit: PAGE_LIMIT,
                search: search,
                menuCode: 802,
                title: "Пользователи"
            });
        });
    });
};

exports.getUsers = (req, res, next) => {
    res.render('admin/users', {
        menuCode: 802,
        adminPage: res.app.get('adminPage'),
        title: "Пользователи"
    });
};

exports.postUsers = async (req, res, next) => {
    try {



        let range = {};
        if(req.query.range) {
            let dates = req.query.range.split(" - ");

            let from = moment(dates[0], 'DD.MM.YYYY').toDate();
            let to = moment(dates[1], 'DD.MM.YYYY').add(23, 'hours').add(59, 'minutes').toDate();
            range = {$and: [{createdAt: { $gte: from, $lte: to}}]};
        }


        let table = await User.dataTables({
            limit: req.body.length,
            skip: req.body.start,
            search: {
                value: req.body.search.value,
                fields: ['email', 'username']
            },
            range: range,
            order: req.body.order,
            columns: req.body.columns,
            sort: {
                createdAt: -1,

            }
        });
       // console.log(table.data);


        let arr = [];

        for(let user of table.data) {
            arr.push({
                username: `<a href="${res.app.get('adminPage')}/user/${user._id}">${user.username}</a>`,
                email:  user.vkontakte ? `<a href="https://vk.com/id${user.vkontakte}">vk.com/id${user.vkontakte}</a>` : user.email,
                banned: user.banned,
                updatedAt: user.updatedAt,
                status: user.isAdmin ? "Admin" : user.isSeller ? "Продавец" : "User",
                phone: {
                    number: user.phone ? user.phone.number ||"" : "",
                },
                balances: {
                    webmoney: user.balances.webmoney.toFixed(2)+" WMR",
                    yandex: user.balances.yandex.toFixed(2),
                    qiwi: user.balances.qiwi.toFixed(2),
                },

                deals_count: user.deals_count,
                saleSum: user.saleSum.toFixed(2),
                button: `<button
                data-uid="${user._id.toString()}" 
                data-isadmin="${user.isAdmin ? "1" : "0"}" 
                data-banned="${user.banned ? "1" : "0"}" 
                data-partner="${user.referral.enabled ? "1" : "0"}" 
                data-toggle="modal" 
                data-target=".bs-user-options" 
                onclick="editUser(this)"
                class="btn btn-default">|||</button>`
            });


        }

        res.json({
            draw: req.body.draw,
            recordsFiltered: table.recordsTotal,
            recordsTotal: table.recordsTotal,
            data: arr,
        });

    } catch (e) {
        console.error(e);
        req.flash('errors', {msg: e.message});
        res.redirect('/');
    }
};

exports.getBanUser = (req, res, next) => {
    let uid = req.query.id;

    if(mongoose.Types.ObjectId.isValid(uid)) {
        User.findOne({_id: uid}, (err, user) => {
            user.banned = !user.banned;
            let log = new Log({
                user: req.user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: (user.banned ? "Забанил ":"Разбанил ") +"пользователя "+user.username,
                type:'info'
            });
            log.save();
            if(user.banned) {
                Lot.remove({_owner: user._id}).exec();
                Chip.remove({_owner: user._id}).exec();
                PublicChat.update({_owner: user._id},{deleted:true}).exec();
                Chat.find({subscribers:{$in:[user._id.toString()]}}, (err, chat_entries) => {
                    for(let entry of chat_entries) {
                        let chatter = null;
                        if(entry.subscribers[0].toString() === user._id.toString()) chatter = entry.subscribers[1];
                        else chatter = entry.subscribers[0];
                        User.findOneAndUpdate({_id: chatter}, {$pop: {"counters.unread": entry._id}}).exec();
                    }
                    Chat.update({subscribers:{$in:[user._id.toString()]}},{$set: {banned:true}}).exec();
                });


                Lot.find({$or: [{}, {}]})
            } else {
                Chat.update({subscribers:{$in:[user._id.toString()]}},{$set: {banned:false}}).exec();
            }
            res.json({ success: 1, status: user.banned  });
            user.save();
        });

    } else {
        res.setHeader('Content-Type', 'application/json');
        res.json({ success: 0 });
    }
};
exports.getBanUserFromLog = (req, res, next) => {
    let stat_id = req.body.stat_id;

    if(mongoose.Types.ObjectId.isValid(stat_id)) {
        Log.findById(stat_id).exec((err, log) => {
            if(log.user && mongoose.Types.ObjectId.isValid(log.user))  {
                User.findOne({_id: log.user}, (err, user) => {
                    user.banned = !user.banned;
                    let log = new Log({
                        user: req.user._id,
                        ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                        description: (user.banned ? "Забанил ":"Разбанил ") +"пользователя "+user.username,
                        type:'info'
                    });
                    log.save();
                    if(user.banned) {
                        Lot.remove({_owner: user._id}).exec();
                        Chip.remove({_owner: user._id}).exec();
                        PublicChat.remove({_owner: user._id}).exec();
                        Chat.find({subscribers:{$in:[user._id.toString()]}}, (err, chat_entries) => {
                            for(let entry of chat_entries) {
                                let chatter = null;
                                if(entry.subscribers[0].toString() === user._id.toString()) chatter = entry.subscribers[1];
                                else chatter = entry.subscribers[0];
                                User.findOneAndUpdate({_id: chatter}, {$pop: {"counters.unread": entry._id}}).exec();
                            }
                            Chat.update({subscribers:{$in:[user._id.toString()]}},{$set: {banned:true}}).exec();
                        });

                        Lot.find({$or: [{}, {}]})
                    } else {
                        Chat.update({subscribers:{$in:[user._id.toString()]}},{$set: {banned:false}}).exec();
                    }
                    res.json({ success: 1, status: user.banned  });
                    user.save();
                });
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.json({ success: 0 });
            }
        });

    } else {
        res.setHeader('Content-Type', 'application/json');
        res.json({ success: 0 });
    }
};

exports.getBanIPFromLog = (req, res, next) => {
    let stat_id = req.body.stat_id;

    if(mongoose.Types.ObjectId.isValid(stat_id)) {
        Log.findById(stat_id).exec((err, log) => {
            if(log.user && mongoose.Types.ObjectId.isValid(log.user))  {
                api.userFirewallAccessRuleNew({"mode":"block","configuration":{"target":"ip","value":log.ip},"notes":"Забанен с сайта, по логам админом "+req.user.username}).then(function(){});
                res.json({ success: 1, status: 1});
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.json({ success: 0 });
            }
        });

    } else {
        res.setHeader('Content-Type', 'application/json');
        res.json({ success: 0 });
    }
};
exports.getPartner = (req, res, next) => {
    let uid = req.query.id;

    if(mongoose.Types.ObjectId.isValid(uid)) {
        User.findOne({_id: uid}, (err, user) => {
            user.referral.enabled = !user.referral.enabled;

            let log = new Log({
                user: req.user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: (user.referral.enabled ? "Включил ":"Выключил ") +"партнёрку для "+user.username,
                type:'info'
            });
            log.save();
            res.json({ success: 1, status: user.promoEnabled  });
            user.save();
        });

    } else {
        res.setHeader('Content-Type', 'application/json');
        res.json({ success: 0 });
    }
};
exports.getUserPage = async (req, res, next) => {
    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found '+uid);
        let user = await User.findOne({_id: uid}).populate('invitedBy');

        if(!user || !user._id)
            throw new Error('user not found');

        let inviter = null;
        if(user.invitedBy && '_id' in user.invitedBy)
            inviter = user.invitedBy;

        moment.locale('ru');
        let MinutesFromLastActive = (moment().unix() - moment(user.lastActive).unix()) / 60;
        let regDates = {};

        regDates.Date = moment(user.createdAt).format('DD MMMM');
        regDates.Time = moment(user.createdAt).format('HH:mm');
        regDates.DateFromNow = moment(user.createdAt).fromNow();

        let lastActiveDates = {};
        if (MinutesFromLastActive > 15) {
            lastActiveDates.Date = moment(user.lastActive).format('DD MMMM');
            lastActiveDates.Time = moment(user.lastActive).format('HH:mm');
            lastActiveDates.DateFromNow = moment(user.lastActive).fromNow();
        }
        let reviews = [];
        //_user.comments;
        if(user.comments)
            for(let com_id in user.comments.toObject()) {
                user.comments[com_id].time =  moment( user.comments[com_id].date).fromNow();
            }

        let ps = await PS.findOne({active:true}).sort({commision: 1});
        let lowest_commission = ps.commision | 0;
        let chips = await Chip.find({_owner: req.params.uid}).sort({_game: -1}).populate('_game _chip_page');

        for (let skey in chips) {
            if (chips.hasOwnProperty(skey)) {
                chips[skey]._owner._createdAt = moment(chips[skey]._owner.createdAt).fromNow(true);

                let commission = percent(parseFloat(process.env.COMMISSION) + chips[skey]._chip_page.commission + lowest_commission).from(chips[skey].price);
                chips[skey].price = (chips[skey].price + commission).toFixed(2);
            }
        }

        let lots = await Lot.find({_owner: req.params.uid}).sort({_game: -1}).populate('_game _lot_page');

        for (let skey in lots) {
            if (lots.hasOwnProperty(skey)) {
                lots[skey]._owner._createdAt = moment(lots[skey]._owner.createdAt).fromNow(true);

                let commission = percent(parseFloat(process.env.COMMISSION) + lots[skey]._lot_page.commission + lowest_commission).from(lots[skey].price);
                lots[skey].price = (lots[skey].price + commission).toFixed(2);
            }
        }
        //console.log(chips);

        res.render('admin/user_page', {
            isAdmin: user.isAdmin,
            title: 'Пользователь ' + user.username,
            uname: user.username,
            reviews: user.comments,
            numeral: numeral,
            lots: lots,
            chips: chips,
            menuCode: 800,
            User: user,
            uid: user._id,
            regDates: regDates,
            lastactive: MinutesFromLastActive,
            lastDates: lastActiveDates,
            inviter:inviter,
            adminPage: res.app.get('adminPage'),
        });
    }
    catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(res.app.get('adminPage'))
    }

};
exports.RemoveChip = async (req, res, next) => {
    let type =   req.params.type.charAt(0).toUpperCase() + req.params.type.substring(1).toLowerCase();
    eval(""+ type + ".findOne({_id: req.params.cp_id}).remove().exec();");
    let log = new Log({
        user: req.user._id,
        ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        description: 'Удалил лот продавца  ',
        type:'info'
    });
    log.save();
    res.redirect(res.app.get('adminPage') + "/user/"+req.params.uid);
};


exports.getUserPageDeals = async (req, res, next) => {
    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found ' + uid);
        let user = await User.findOne({_id: uid}).populate('invitedBy');

        if (!user || !user._id)
            throw new Error('user not found');

        let inviter = null;
        if(user.invitedBy && '_id' in user.invitedBy)
            inviter = user.invitedBy;

        moment.locale('ru');
        let MinutesFromLastActive = (moment().unix() - moment(user.lastActive).unix()) / 60;
        let regDates = {};

        regDates.Date = moment(user.createdAt).format('DD MMMM');
        regDates.Time = moment(user.createdAt).format('HH:mm');
        regDates.DateFromNow = moment(user.createdAt).fromNow();

        let lastActiveDates = {};
        if (MinutesFromLastActive > 15) {
            lastActiveDates.Date = moment(user.lastActive).format('DD MMMM');
            lastActiveDates.Time = moment(user.lastActive).format('HH:mm');
            lastActiveDates.DateFromNow = moment(user.lastActive).fromNow();
        }

        let orders = await Order
            .find({ $or: [{_payeer: user._id}, {_seller: user._id}]})
            .populate('_chip _lot _payeer _seller _game _chip_page _lot_page paymentSystem').sort({createdAt:-1})
            .exec();

        res.render('admin/user_deals', {
            orders: orders,
            moment: moment,
            User: user,
            Helper: Helper,
            regDates: regDates,
            lastactive: MinutesFromLastActive,
            lastDates: lastActiveDates,
            inviter: inviter,
            adminPage: res.app.get('adminPage'),
            title: "История сделок пользователя",
            menuCode: 801
        });
    }
    catch (e) {
            req.flash('errors', {msg: e.message});
            res.redirect(res.app.get('adminPage'))
    }

};










exports.getUserReviews = async (req, res, next) => {
    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found '+uid);
        let user = await User.findOne({_id: uid}).populate('comments.from invitedBy');

        if(!user || !user._id)
            throw new Error('user not found');

        let inviter = null;
        if(user.invitedBy && '_id' in user.invitedBy)
            inviter = user.invitedBy;


        moment.locale('ru');
        let MinutesFromLastActive = (moment().unix() - moment(user.lastActive).unix()) / 60;
        let regDates = {};

        regDates.Date = moment(user.createdAt).format('DD MMMM');
        regDates.Time = moment(user.createdAt).format('HH:mm');
        regDates.DateFromNow = moment(user.createdAt).fromNow();

        let lastActiveDates = {};
        if (MinutesFromLastActive > 15) {
            lastActiveDates.Date = moment(user.lastActive).format('DD MMMM');
            lastActiveDates.Time = moment(user.lastActive).format('HH:mm');
            lastActiveDates.DateFromNow = moment(user.lastActive).fromNow();
        }
        let reviews = [];
        //_user.comments;
        if(user.comments)
            for(let com_id in user.comments.toObject()) {
                user.comments[com_id].time =  moment( user.comments[com_id].date).fromNow();
            }

        res.render('admin/user_reviews', {
            isAdmin: user.isAdmin,
            title: 'Отзывы для ' + user.username,
            reviews: user.comments,
            menuCode: 804,
            User: user,
            regDates: regDates,
            lastactive: MinutesFromLastActive,
            lastDates: lastActiveDates,
            inviter: inviter,
            adminPage: res.app.get('adminPage'),
        });
    }
    catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(res.app.get('adminPage'))
    }

};

exports.RemoveReview = async (req,res,next) => {

    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found ' + uid);
        let user = await User.findOne({_id: uid});

        if (!user || !user._id)
            throw new Error('user not found');
        user.comments.id(req.params.rid).remove();
        user.save();
        let log = new Log({
            user: req.user._id,
            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            description: 'Удалил отзыв у  продавца '+user.username,
            type:'info'
        });
        log.save();
        res.redirect(res.app.get('adminPage')+'/user/'+user._id+'/reviews');
    }
    catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(res.app.get('adminPage'))
    }
};

exports.getUserPurses = async (req, res, next) => {
    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found '+uid);
        let user = await User.findOne({_id: uid}).populate('invitedBy');

        if(!user || !user._id)
            throw new Error('user not found');

        let inviter = null;
        if(user.invitedBy && '_id' in user.invitedBy)
            inviter = user.invitedBy;

        moment.locale('ru');
        let MinutesFromLastActive = (moment().unix() - moment(user.lastActive).unix()) / 60;
        let regDates = {};

        regDates.Date = moment(user.createdAt).format('DD MMMM');
        regDates.Time = moment(user.createdAt).format('HH:mm');
        regDates.DateFromNow = moment(user.createdAt).fromNow();

        let lastActiveDates = {};
        if (MinutesFromLastActive > 15) {
            lastActiveDates.Date = moment(user.lastActive).format('DD MMMM');
            lastActiveDates.Time = moment(user.lastActive).format('HH:mm');
            lastActiveDates.DateFromNow = moment(user.lastActive).fromNow();
        }

        res.render('admin/user_purses', {
            isAdmin: user.isAdmin,
            title: 'Кошельки ' + user.username,
            balances: user.balances,
            menuCode: 803,
            User: user,
            regDates: regDates,
            inviter: inviter,
            lastactive: MinutesFromLastActive,
            lastDates: lastActiveDates,
            adminPage: res.app.get('adminPage'),
        });
    }
    catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(res.app.get('adminPage'))
    }

};

exports.updateBalances = async (req, res, next) => {
    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found ' + uid);
        let user = await User.findOne({_id: uid}).populate('comments.from');

        if (!user || !user._id)
            throw new Error('user not found');

        if(req.body.purse && req.body.purse !== "" && req.body.balances[req.body.purse] && parseFloat(req.body.balances[req.body.purse]) >= 0 ) {
            let add = false;
            let sum = parseFloat(req.body.balances[req.body.purse]);

            if(req.body.action[req.body.purse] === "add") {
                user.balances[req.body.purse] += sum;
                add=true;
            } else {
                user.balances[req.body.purse] -= sum;
            }


            let user_operation = mongoose.Types.ObjectId();
            user.operations.push({
                _id: user_operation,
                type: add ? 'in':'out',
                subject: 'Изменение баланса администратором',
                status: 'success',
                sum: sum,
                ps: Helper.OperationWallet(req.body.purse)
            });

            let log = new Log({
                user: req.user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: (req.body.action[req.body.purse] === "add" ? "Увеличил ":"Уменьшил ") +' баланс пользоватля '+user.username+" на "+sum+" ед. "+Helper.OperationWallet(req.body.purse),
                type:'info'
            });
            log.save();

            let MainStat = new MainStats({
                    sum: sum,
                    operation: add ?'incoming':'outcoming',

                    user: user._id ,
                    need_confirmation: false,
                    confirmed_by: req.user._id,
                    confirmation_date: new Date(),
                    searchable: {
                        username: req.user.username,
                        date: moment().format('HH:mm:ss DD.MM.YYYY'),
                        description: "Баланс изменён администратором"
                    }
                }

            );
            MainStat.save();
            let Operation = new Operations();
            Operation.type = req.body.purse;
            Operation.user = user._id;
            Operation.user_operation = user_operation;
            Operation.sum = sum;
            Operation.in_out = add ? 'in':'out';
            Operation.comment = 'Изминение баланса администратором';
            Operation.wallet = req.body.purse;
            Operation.save();

            await user.save();
            req.flash('info', {msg: "Баланс успешно обновлён!"});
            res.redirect(res.app.get('adminPage')+'/user/'+uid+'/purses');
        } else {
            req.flash('errors', {msg: "Произошла ошибка!"});
            res.redirect(res.app.get('adminPage')+'/user/'+uid+'/purses');
        }
    } catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(res.app.get('adminPage')+'/user/'+uid+'/purses');
    }
};

exports.getUserOperations = async (req, res, next) => {
    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found '+uid);
        let user = await User.findOne({_id: uid}).populate('invitedBy');

        if(!user || !user._id)
            throw new Error('user not found');


        let inviter = null;
        if(user.invitedBy && '_id' in user.invitedBy)
            inviter = user.invitedBy;

        moment.locale('ru');
        let MinutesFromLastActive = (moment().unix() - moment(user.lastActive).unix()) / 60;
        let regDates = {};

        regDates.Date = moment(user.createdAt).format('DD MMMM');
        regDates.Time = moment(user.createdAt).format('HH:mm');
        regDates.DateFromNow = moment(user.createdAt).fromNow();

        let lastActiveDates = {};
        if (MinutesFromLastActive > 15) {
            lastActiveDates.Date = moment(user.lastActive).format('DD MMMM');
            lastActiveDates.Time = moment(user.lastActive).format('HH:mm');
            lastActiveDates.DateFromNow = moment(user.lastActive).fromNow();
        }

        res.render('admin/user_operations', {
            isAdmin: user.isAdmin,
            title: 'Операции ' + user.username,
            menuCode: 805,
            moment:moment,
            User: user,
            regDates: regDates,
            inviter: inviter,
            lastactive: MinutesFromLastActive,
            lastDates: lastActiveDates,
            adminPage: res.app.get('adminPage'),
        });
    } catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(res.app.get('adminPage')+'/user/'+uid+'/purses');
    }
};




exports.getUserPartner = async (req, res, next) => {

    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found '+uid);
        let user = await User.findOne({_id: uid}).populate('invitedBy');

        if(!user || !user._id)
            throw new Error('user not found');

        let inviter = null;
        if(user.invitedBy && '_id' in user.invitedBy)
            inviter = user.invitedBy;

        let invited = await User.find({invitedBy: user._id}).count();
        let total_deals = 0;
        let deals_sum = 0.0 ;
        let ref_sum = 0.0;

        let invited_users = await User.find({invitedBy: user._id});
        for(let x in invited_users) {
            if(invited_users.hasOwnProperty(x) && '_id' in invited_users[x]) {
                //console.log({_payeer: invited_users[x]._id, status:4});
                let orders = await Order.find({_payeer: invited_users[x]._id, status:4});
                for(let k in orders) {
                    if(orders.hasOwnProperty(k) && invited_users[k] && '_id' in invited_users[k]) {
                        total_deals++;
                        deals_sum += orders[k].sum;
                        ref_sum += orders[k].ref_back;
                    }
                }
            }
        }

        moment.locale('ru');
        let MinutesFromLastActive = (moment().unix() - moment(user.lastActive).unix()) / 60;
        let regDates = {};

        regDates.Date = moment(user.createdAt).format('DD MMMM');
        regDates.Time = moment(user.createdAt).format('HH:mm');
        regDates.DateFromNow = moment(user.createdAt).fromNow();

        let lastActiveDates = {};
        if (MinutesFromLastActive > 15) {
            lastActiveDates.Date = moment(user.lastActive).format('DD MMMM');
            lastActiveDates.Time = moment(user.lastActive).format('HH:mm');
            lastActiveDates.DateFromNow = moment(user.lastActive).fromNow();
        }
        let user2 = null;
        if
        (
            req.query.user &&
            mongoose.Types.ObjectId.isValid(req.query.user)
        )
        {
            user2 = await User.findOne({_id: req.query.user});

        }
     //   let partners = await User.find({invitedBy:user._id});
       // console.log({invitedBy:user._id},partners);
        res.render('admin/user_partner', {
            current_user_id: (user2 !== null) ? user2._id.toString() : null,
            _user: (user2 !== null) ? user2 : null,
            invited: invited,
            total_deals: total_deals,
            deals_sum: deals_sum,
            partners:invited_users,
            ref_sum: ref_sum,
            moment: moment,
            User: user,
            title: 'Операции ' + user.username,
            menuCode: 808,
            inviter: inviter,
            regDates: regDates,
            lastactive: MinutesFromLastActive,
            lastDates: lastActiveDates,
            adminPage: res.app.get('adminPage'),
        })
    } catch (e) {
        req.flash('errors', {msg: e.message});
        console.error(e);
        res.redirect(res.app.get('adminPage')+'/user/'+uid+'/purses');
    }

};
exports.getUserChats = async (req, res, next) => {

    let uid = req.params.uid;
    try {
        if (!mongoose.Types.ObjectId.isValid(uid))
            throw new Error('usser not found '+uid);
        let user = await User.findOne({_id: uid}).populate('invitedBy');

        if(!user || !user._id)
            throw new Error('user not found');

        let inviter = null;
        if(user.invitedBy && '_id' in user.invitedBy)
            inviter = user.invitedBy;

        moment.locale('ru');
        let MinutesFromLastActive = (moment().unix() - moment(user.lastActive).unix()) / 60;
        let regDates = {};

        regDates.Date = moment(user.createdAt).format('DD MMMM');
        regDates.Time = moment(user.createdAt).format('HH:mm');
        regDates.DateFromNow = moment(user.createdAt).fromNow();

        let lastActiveDates = {};
        if (MinutesFromLastActive > 15) {
            lastActiveDates.Date = moment(user.lastActive).format('DD MMMM');
            lastActiveDates.Time = moment(user.lastActive).format('HH:mm');
            lastActiveDates.DateFromNow = moment(user.lastActive).fromNow();
        }
        let user2 = null;
        if
        (
            req.query.user &&
            mongoose.Types.ObjectId.isValid(req.query.user)
        )
        {
            user2 = await User.findOne({_id: req.query.user});

        }


        let chats = await Chat
            .find({subscribers:{$in:[user._id.toString()]}})
            .populate('messages.sender')
            .sort({updatedAt: -1}).exec();

        let chatter_id = '';
        let _chat = null;

        for(let id in chats )
        {
            if(!chats.hasOwnProperty(id)) continue;
            //if(_chat === null ) _chat = chat;
            chats[id]["chatter"] = {
                id: null,
                name: null,
            };
            chats[id]["hasNewEntries"] = false;

            if (chats[id].subscribers[0].toString() === user._id.toString()) {
                chats[id].chatter.id = chats[id].subscribers[1].toString();
            } else {
                chats[id].chatter.id = chats[id].subscribers[0].toString();
            }

            if(req.user.counters.unread.indexOf(chats[id]._id.toString()) !== -1)
            {
                chats[id]["hasNewEntries"] = true;
            }

            if (user2 !== null && user2._id && chats[id].chatter.id === user2._id.toString()) {
                _chat = chats[id];
            }
            //  chats[id]['time'] = Moment(chats[id].updated).format('DD MMMM, H:m');

            let _usr = await User.findOne({_id: chats[id].chatter.id});

            if(user2 === null) {
                user2 = _usr;
                _chat = chats[id];
            }

            chats[id].chatter.name = _usr.username;


        }
        let globalchats;
        if(req.query.global) {
            globalchats = await PublicChat.find({_owner:uid});

        }

        res.render(req.query.global ? 'admin/user_global_chat':'admin/user_chats', {
            current_user_id: (user2 !== null) ? user2._id.toString() : null,
            chat: _chat,
            _user: (user2 !== null) ? user2 : null,
            chats: chats,
            moment: moment,
            globalchats: globalchats,
            User: user,
            title: 'Операции ' + user.username,
            menuCode: 802,
            inviter: inviter,
            regDates: regDates,
            lastactive: MinutesFromLastActive,
            lastDates: lastActiveDates,
            adminPage: res.app.get('adminPage'),
        })
    } catch (e) {
        req.flash('errors', {msg: e.message});
        console.error(e);
        res.redirect(res.app.get('adminPage')+'/user/'+uid+'/purses');
    }

};

exports.getUser = (req, res, next) => {
    let uid = req.params.id;

    if(mongoose.Types.ObjectId.isValid(uid)) {

        User.findOne({_id: uid}, (err, user) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(
                {
                    success: 1,
                    banned: user.banned,
                    admin: user.isAdmin,
                    email: user.email,
                    balance: user.balance,
                    username: user.username,

                }));
        });
    }
};

exports.postUser = (req,res, next) => {
    let uid = req.params.id;
    User.findOne({_id: uid}, (err, user) => {
        let log = new Log({
            user: req.user._id,
            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            description: "Изменил пользователя "+user.username,
            type:'info'
        });
        log.save();
        if(user.email != req.body.email) {
            User.findOne({ email: req.body.email }, (err, existingUser) => {
                if (existingUser) {
                    res.setHeader('Content-Type', 'application/json');
                    res.send(JSON.stringify(
                        {
                            error: "пользователь с таким email уже существует",
                        })
                    );
                } else {
                    user.email = req.body.email;
                    user.username = req.body.username;
                    user.isAdmin = req.body.admin;
                    if(req.body.password != "")
                        user.password = req.body.password;
                    user.save((err) => {
                        if (err) { return next(err); }

                    });


                }
            });
        } else {
            user.email = req.body.email;
            user.username = req.body.username;
            user.isAdmin = req.body.admin;
            if(req.body.password != "")
                user.password = req.body.password;
            user.save((err) => {
                if (err) { return next(err); }
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify(
                    {
                        success: 1,
                    })
                );
            });
        }
    });
};
