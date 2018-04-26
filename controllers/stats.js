'use strict';
const moment = require('moment');
const querystring = require('querystring');

const MainStats = require('../models/MainStats');
const SellersStats = require('../models/SellersStats');
const ReferralStats = require('../models/ReferralStats');
const ProfitStats = require('../models/ProfitStats');
const RefundStats = require('../models/RefundStats');
const User = require('../models/User');
const Log = require('../models/Log');
const Vars = require('../models/Vars');
const Helper = require('../helpers/helper');

exports.getIndex = async (req, res, next) => {
    try {
        res.render('admin/stats_main', {
            title: 'Основная',
            fullscreen: false,
            menuCode:900
        });
    } catch (e) {
        console.error(e);
        req.flash('errors', {msg: e.message});
        res.redirect('/');
    }
};

exports.postIndex = async (req, res, next) => {
    try {



        let range = {};
        if(req.query.range) {
            let dates = req.query.range.split(" - ");

            let from = moment(dates[0], 'DD.MM.YYYY').toDate();
            let to = moment(dates[1], 'DD.MM.YYYY').add(23, 'hours').add(59, 'minutes').toDate();
            range = {$and: [{updatedAt: { $gte: from, $lte: to}}]};
        }


        let table = await MainStats.dataTables({
            limit: req.body.length,
            skip: req.body.start,
            populate: [
                { path: 'order', select: 'order_id description _id' },
                { path: 'user', select: 'username _id' },
                { path: 'confirmed_by', select: 'username _id' },
                { path: 'ps', select: 'title' },
            ],
            search: {
                value: req.body.search.value,
                fields: ['searchable.description', 'searchable.username','searchable.date']
            },
            range: range,
            order: req.body.order,
            columns: req.body.columns,
            sort: {
                main_stat_id: -1,

            }
        });



        let arr = [];
        let counters = {
            incoming: 0,
            outcoming: 0,
            avg: 0,
        };
        for(let stat of table.data) {
            arr.push({
                sum: stat.operation === 'incoming' ? "+ " + stat.sum.toFixed(2) : "- "+ stat.sum.toFixed(2),
                main_stat_id: stat.main_stat_id,
                operation: stat.operation === 'incoming' ? "Пополнение" : (stat.operation === 'outcoming' ? 'Расход' : 'Возврат'),
                order: {
                    order_id: stat.order ? "<a href='/order/"+stat.order._id+"'>"+ stat.order.order_id + '</a>':"",
                    description: stat.order ? stat.order.description :'Изменён администратором'
                },
                user: {
                    username: stat.user.username
                },
                ps: {
                    title: stat.ps ? stat.ps.title: 'внутрянка'
                },
                updatedAt: moment(stat.updatedAt).format("HH:mm:ss DD.MM.YYYY"),
                need_confirmation: stat.need_confirmation ?
                    "<button class='btn btn-success confirm-incoming' data-stat-id='"+stat._id+"'>Подтвердить</button>"
                    :
                    (
                        stat.confirmation_date.getUTCFullYear() > 2015 ?
                            "Подтвердил "+stat.confirmed_by.username+" в "+moment(stat.confirmation_date).format("HH:mm:ss DD.MM.YYYY")
                            :
                            "не требуется"
                    )
            });

            if(stat.operation === 'incoming') {
                counters.incoming += stat.sum;
                counters.avg += stat.sum;
            }

            if(stat.operation === 'outcoming') {
                counters.outcoming += stat.sum;
                counters.avg -= stat.sum;
            }
        }

        res.json({
            draw: req.body.draw,
            recordsFiltered: table.recordsTotal,
            recordsTotal: table.recordsTotal,
            data: arr,
            counters: counters

        });

    } catch (e) {
        console.error(e);
        req.flash('errors', {msg: e.message});
        res.redirect('/');
    }
};



exports.getSellers = async (req, res, next) => {
    try {


        res.render('admin/stats_sellers', {
            title: 'Продавцов',
            fullscreen: false,
            menuCode:901
        });
    } catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(req.path+req.query);
    }
};

exports.postSellers = async (req, res, next) => {
    try {



        let range = {};
        if(req.query.range) {
            let dates = req.query.range.split(" - ");

            let from = moment(dates[0], 'DD.MM.YYYY').toDate();
            let to = moment(dates[1], 'DD.MM.YYYY').add(23, 'hours').add(59, 'minutes').toDate();
            range = {$and: [{updatedAt: { $gte: from, $lte: to}}]};
        }


        let table = await SellersStats.dataTables({
            limit: req.body.length,
            skip: req.body.start,
            populate: [
                { path: 'order', select: 'order_id description _id' },
                { path: 'user', select: 'username _id' },
                { path: 'confirmed_by', select: 'username _id' },
                { path: 'ps', select: 'title' },
            ],
            search: {
                value: req.body.search.value,
                fields: ['searchable.description', 'searchable.username','searchable.date','wallet','purse']
            },
            range: range,
            order: req.body.order,
            columns: req.body.columns,
            sort: {
                seller_stat_id: -1,

            }
        });



        let arr = [];
        let counters = {
            incoming: 0,
            outcoming: 0,
            avg: 0,
        };
        for(let stat of table.data) {
            arr.push({
                sum: stat.operation === 'input' ? "+ " + stat.sum.toFixed(2) : (stat.need_confirmation ? stat.sum.toFixed(2) : "- "+ stat.sum.toFixed(2)),
                seller_stat_id: stat.seller_stat_id,
                operation: stat.operation === 'input' ? "Приход" : "Расход",
                order: {
                    order_id: stat.order ? "<a href='/order/"+stat.order._id+"'>"+ stat.order.order_id + '</a>' : 'Вывод средств',
                    description: stat.order ? stat.order.description: stat.searchable.description
                },
                user: {
                    username: stat.user.username
                },
                wallet: Helper.OperationWallet(stat.wallet),
                purse: stat.purse,
                updatedAt: moment(stat.updatedAt).format("HH:mm:ss DD.MM.YYYY"),
                need_confirmation: stat.need_confirmation ?
                    "<button class='btn btn-success confirm-incoming' data-stat-id='"+stat._id+"'>Подтвердить</button>"
                    :
                    (
                        stat.confirmation_date.getUTCFullYear() > 2015 ?
                            "Подтвердил "+stat.confirmed_by.username+" в "+moment(stat.confirmation_date).format("HH:mm:ss DD.MM.YYYY")
                            :
                            "не требуется"
                    )
            });

            if(stat.operation === 'input') {
                counters.incoming += stat.sum;
                counters.avg += stat.sum;
            }

            if(stat.operation === 'output' && !stat.need_confirmation) {
                counters.outcoming += stat.sum;
                counters.avg -= stat.sum;
            }
        }

        res.json({
            draw1: req.body.draw,
            recordsFiltered: table.recordsTotal,
            recordsTotal: table.recordsTotal,
            data: arr,
            counters: counters

        });

    } catch (e) {
        console.error(e);
        req.flash('errors', {msg: e.message});
        res.redirect('/');
    }
};


exports.getReferral = async (req, res, next) => {
    try {


        res.render('admin/stats_ref', {
            title: 'Реферальная',
            fullscreen: false,
            menuCode:902
        });
    } catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(req.path+req.query);
    }
};

exports.postReferral = async (req, res, next) => {
    try {



        let range = {};
        if(req.query.range) {
            let dates = req.query.range.split(" - ");

            let from = moment(dates[0], 'DD.MM.YYYY').toDate();
            let to = moment(dates[1], 'DD.MM.YYYY').add(23, 'hours').add(59, 'minutes').toDate();
            range = {$and: [{updatedAt: { $gte: from, $lte: to}}]};
        }


        let table = await ReferralStats.dataTables({
            limit: req.body.length,
            skip: req.body.start,
            populate: [
                { path: 'order', select: 'order_id description _id' },
                { path: 'user', select: 'username _id' },
                { path: 'confirmed_by', select: 'username _id' },
            ],
            search: {
                value: req.body.search.value,
                fields: ['searchable.description', 'searchable.username','searchable.date','purse']
            },
            range: range,
            order: req.body.order,
            columns: req.body.columns,
            sort: {
                seller_stat_id: -1,

            }
        });



        let arr = [];
        let counters = {
            incoming: 0,
            outcoming: 0,
            avg: 0,
        };
        for(let stat of table.data) {
            arr.push({
                sum: stat.operation === 'input' ? "+ " + stat.sum.toFixed(2) : (stat.need_confirmation ? stat.sum.toFixed(2) : "- "+ stat.sum.toFixed(2)),
                ref_stat_id: stat.ref_stat_id,
                operation: stat.operation === 'input' ? "Приход" : "Расход",
                order: {
                    order_id: stat.order ? "<a href='/order/"+stat.order._id+"'>"+ stat.order.order_id + '</a>' : 'Вывод средств',
                    description: stat.order ? stat.order.description: stat.searchable.description
                },
                user: {
                    username: stat.user.username
                },
                purse: Helper.OperationWallet(stat.purse),
                updatedAt: moment(stat.updatedAt).format("HH:mm:ss DD.MM.YYYY"),
                need_confirmation: stat.need_confirmation ?
                    "<button class='btn btn-success confirm-incoming' data-stat-id='"+stat._id+"'>Подтвердить</button>"
                    :
                    (
                        stat.confirmation_date.getUTCFullYear() > 2015 ?
                            "Подтвердил "+stat.confirmed_by.username+" в "+moment(stat.confirmation_date).format("HH:mm:ss DD.MM.YYYY")
                            :
                            "не требуется"
                    )
            });

            if(stat.operation === 'input') {
                counters.incoming += stat.sum;
                counters.avg += stat.sum;
            }

            if(stat.operation === 'output' && !stat.need_confirmation) {
                counters.outcoming += stat.sum;
                counters.avg -= stat.sum;
            }
        }

        res.json({
            draw1: req.body.draw,
            recordsFiltered: table.recordsTotal,
            recordsTotal: table.recordsTotal,
            data: arr,
            counters: counters

        });

    } catch (e) {
        console.error(e);
        req.flash('errors', {msg: e.message});
        res.redirect('/');
    }
};

exports.postProfit = async (req, res, next) => {
    try {



        let range = {};
        if(req.query.range) {
            let dates = req.query.range.split(" - ");

            let from = moment(dates[0], 'DD.MM.YYYY').toDate();
            let to = moment(dates[1], 'DD.MM.YYYY').add(23, 'hours').add(59, 'minutes').toDate();
            range = {$and: [{updatedAt: { $gte: from, $lte: to}}]};
        }


        let table = await ProfitStats.dataTables({
            limit: req.body.length,
            skip: req.body.start,
            populate: [
                { path: 'order', select: 'order_id description _id' },
                { path: 'user', select: 'username _id' },
                { path: 'confirmed_by', select: 'username _id' },
                { path: 'ps', select: 'title' },
            ],
            search: {
                value: req.body.search.value,
                fields: ['searchable.description', 'searchable.username','searchable.date','wallet','purse']
            },
            range: range,
            order: req.body.order,
            columns: req.body.columns,
            sort: {
                seller_stat_id: -1,

            }
        });



        let arr = [];
        let counters = {
            incoming: 0,
            outcoming: 0,
            avg: 0,
        };
        for(let stat of table.data) {
            arr.push({
                sum: stat.operation === 'input' ? "+ " + stat.sum.toFixed(2) : (stat.need_confirmation ? stat.sum.toFixed(2) : "- "+ stat.sum.toFixed(2)),
                profit_stat_id: stat.profit_stat_id,
                operation: stat.operation === 'input' ? "Приход" : "Расход",
                order: {
                    order_id: stat.order ? "<a href='/order/"+stat.order._id+"'>"+ stat.order.order_id + '</a>' : 'Денежная операция',
                    description: stat.order ? stat.order.description: stat.searchable.description
                },
                user: {
                    username: stat.user.username
                },
                wallet: stat.wallet,
                updatedAt: moment(stat.updatedAt).format("HH:mm:ss DD.MM.YYYY"),
                need_confirmation: stat.need_confirmation ?
                    "<button class='btn btn-success confirm-incoming' data-stat-id='"+stat._id+"'>Подтвердить</button>"
                    :
                    (
                        stat.confirmation_date.getUTCFullYear() > 2015 ?
                            "Подтвердил "+stat.confirmed_by.username+" в "+moment(stat.confirmation_date).format("HH:mm:ss DD.MM.YYYY")
                            :
                            "не требуется"
                    )
            });

            if(stat.operation === 'input') {
                counters.incoming += stat.sum;
                counters.avg += stat.sum;
            }

            if(stat.operation === 'output' && !stat.need_confirmation) {
                counters.outcoming += stat.sum;
                counters.avg -= stat.sum;
            }
        }

        res.json({
            draw1: req.body.draw,
            recordsFiltered: table.recordsTotal,
            recordsTotal: table.recordsTotal,
            data: arr,
            counters: counters

        });

    } catch (e) {
        console.error(e);
        req.flash('errors', {msg: e.message});
        res.redirect('/');
    }
};


exports.getProfit = async (req, res, next) => {
    try {


        res.render('admin/stats_profit', {
            title: 'Прибыль',
            fullscreen: false,
            menuCode:903
        });
    } catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(req.path+req.query);
    }
};


exports.postRefund = async (req, res, next) => {
    try {



        let range = {};
        if(req.query.range) {
            let dates = req.query.range.split(" - ");

            let from = moment(dates[0], 'DD.MM.YYYY').toDate();
            let to = moment(dates[1], 'DD.MM.YYYY').add(23, 'hours').add(59, 'minutes').toDate();
            range = {$and: [{updatedAt: { $gte: from, $lte: to}}]};
        }


        let table = await RefundStats.dataTables({
            limit: req.body.length,
            skip: req.body.start,
            populate: [
                { path: 'order', select: 'order_id description _id' },
                { path: 'user', select: 'username _id' },
                { path: 'confirmed_by', select: 'username _id' },
                { path: 'ps', select: 'title' },
            ],
            search: {
                value: req.body.search.value,
                fields: ['searchable.description', 'searchable.username','searchable.date','wallet','purse']
            },
            range: range,
            order: req.body.order,
            columns: req.body.columns,
            sort: {
                seller_stat_id: -1,

            }
        });



        let arr = [];
        let counters = {
            incoming: 0,
            outcoming: 0,
            avg: 0,
        };
        for(let stat of table.data) {
            arr.push({
                sum: stat.operation === 'input' ? "+ " + stat.sum.toFixed(2) : (stat.need_confirmation ? stat.sum.toFixed(2) : "- "+ stat.sum.toFixed(2)),
                refund_stat_id: stat.refund_stat_id,
                operation: stat.operation === 'input' ? "Приход" : "Расход",
                order: {
                    order_id: stat.order ? "<a href='/order/"+stat.order._id+"'>"+ stat.order.order_id + '</a>' : 'Вывод средств',
                    description: stat.order ? stat.order.description: stat.searchable.description
                },
                user: {
                    username: stat.user.username
                },
                purse: stat.purse,
                updatedAt: moment(stat.updatedAt).format("HH:mm:ss DD.MM.YYYY"),
                need_confirmation: stat.need_confirmation ?
                    "<button class='btn btn-success confirm-incoming' data-stat-id='"+stat._id+"'>Подтвердить</button>"
                    :
                    (
                        stat.confirmation_date.getUTCFullYear() > 2015 ?
                            "Подтвердил "+stat.confirmed_by.username+" в "+moment(stat.confirmation_date).format("HH:mm:ss DD.MM.YYYY")
                            :
                            "не требуется"
                    )
            });

            if(stat.operation === 'input') {
                counters.incoming += stat.sum;
                counters.avg += stat.sum;
            }

            if(stat.operation === 'output' && !stat.need_confirmation) {
                counters.outcoming += stat.sum;
                counters.avg -= stat.sum;
            }
        }

        res.json({
            draw1: req.body.draw,
            recordsFiltered: table.recordsTotal,
            recordsTotal: table.recordsTotal,
            data: arr,
            counters: counters

        });

    } catch (e) {
        console.error(e);
        req.flash('errors', {msg: e.message});
        res.redirect('/');
    }
};


exports.getRefund = async (req, res, next) => {
    try {



        res.render('admin/stats_refund', {
            title: 'Возврат',
            fullscreen: false,
            menuCode:904
        });
    } catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect(req.path+req.query);
    }
};


exports.ajaxConfirm = async (req, res, next) => {
    try {

        if(!req.body.stat_id || !req.body.page)
            throw new Error('Не задан параметр.');
        let PageModel;
        switch (req.body.page) {
            case 'main':
                PageModel = MainStats;
                break;
        }

        if(!PageModel)
            throw new Error('Operation not found');

        let Stat = await PageModel.findById(req.body.stat_id).populate('order');

        Stat.confirmed_by = req.user._id;
        Stat.confirmation_date = Date.now();
        Stat.need_confirmation = false;

        if(req.body.page === 'main') {
            Stat.order.status = Helper.statusEnum.ORDER_PAID;
            Stat.order.save();
        }
        Stat.save();

        let log = new Log({
            user: req.user._id,
            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            description: "Подтвердил оплату зказа №"+Stat.order.order_id,
            type:'info'
        });
        log.save();
        res.json({errors:0});

    } catch (e) {
        res.json({
            errors: 1,
            message: e.message
        })
    }
};


exports.ajaxConfirmWithdraw = async (req, res, next) => {
    try {

        if(!req.body.stat_id || !req.body.page)
            throw new Error('Не задан параметр.');
        let PageModel;
        switch (req.body.page) {
            case 'main':
                PageModel = SellersStats;
                break;
        }

        if(!PageModel)
            throw new Error('Operation not found');

        let Stat = await PageModel.findById(req.body.stat_id).populate('order user');

        Stat.confirmed_by = req.user._id;
        Stat.confirmation_date = Date.now();
        Stat.need_confirmation = false;

        await User.update(
            { "_id": Stat.user._id, "operations._id": Stat.user_operation },
            {"operations.$.status":'success'});
        Stat.save();

        let log = new Log({
            user: req.user._id,
            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            description: "Подтвердил заявку на вывод пользователю "+Stat.user.username,
            type:'info'
        });
        log.save();

        let $inc = {};
        $inc['site_balance.'+Stat.wallet] = 0-Stat.sum;
        console.log($inc);
        Vars.updateOne({},{$inc:$inc}).exec();
        res.json({errors:0});

    } catch (e) {
        res.json({
            errors: 1,
            message: e.message
        })
    }
};



exports.ajaxConfirmReferral = async (req, res, next) => {
    try {

        if(!req.body.stat_id || !req.body.page)
            throw new Error('Не задан параметр.');
        let PageModel;
        switch (req.body.page) {
            case 'main':
                PageModel = ReferralStats;
                break;
        }

        if(!PageModel)
            throw new Error('Operation not found');

        let Stat = await PageModel.findById(req.body.stat_id).populate('order user');

        Stat.confirmed_by = req.user._id;
        Stat.confirmation_date = Date.now();
        Stat.need_confirmation = false;
        Stat.save();


        await User.update(
            { "_id": Stat.user._id, "operations._id": Stat.user_operation },
            {"operations.$.status":'success'});

        let user = await User.findById(Stat.user._id);
        user.balances[Stat.purse] += Stat.sum;

        let log = new Log({
            user: req.user._id,
            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            description: "Подтвердил вывод реферальных денег пользователю "+user.username,
            type:'info'
        });
        log.save();
        console.log(user.balances, Stat.purse, Stat.sum);
        user.save();
        res.json({errors:0});

    } catch (e) {
        res.json({
            errors: 1,
            message: e.message
        })
    }
};