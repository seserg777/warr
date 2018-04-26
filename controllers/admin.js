'use strict';
const moment = require('moment');
const ps = require('../models/PaymentSystem');
const Config = require('../models/Config');
const Order = require('../models/Order');
const Operations = require('../models/Operations');
const ProfitStats  = require('../models/ProfitStats');
const Log = require('../models/Log');
const User = require('../models/User');
const Vars = require('../models/Vars');
const Helper = require('../helpers/helper');
const ChatHelper = require('../helpers/chat');
const PAGE_LIMIT = 20;


exports.calcProfit = async (req,res, next) => {
    let vars = await Vars.findOne({}, 'statistic');
    console.log(req.body);
   // console.log(vars);
    Order.aggregate().match({$and: [{status: 4}, {updatedAt: { $gte: moment().subtract(1,'days').toDate()}}] }).project( {
        _id: 0, // let's remove bson id's from request's result
        sum: 1, // we need this field
        release_sum: 1,
       // district: '$address.district' // and let's turn the nested field into usual field (usual renaming)
    }).group({
        _id: '$district', // grouping key - group by field district
        minPrice: { $min: '$sum'}, // we need some stats for each group (for each district)
        maxPrice: { $max: '$sum'},
        sum1: {$sum: '$sum'},
        sum2: {$sum: '$release_sum'},
        ordersCount: { $sum: 1 }
    }).exec( (err, result) => {
        if(result.length>0) {

            delete result[0]._id;
            result[0].sum = result[0].sum1;
            result[0].profit = result[0].sum1-result[0].sum2;
            delete result[0].sum2;
            delete result[0].sum1;
            vars.statistic.daily = result[0];

        } else {
            vars.statistic.daily = {
                minPrice: 0,
                maxPrice: 0,
                sum:    0,
                ordersCount:0
            };
        }
        vars.save();

    });


    Order.aggregate().match({$and: [{status: 4}, {updatedAt: { $gte: moment().subtract(7,'days').toDate() }}] }).project( {
        _id: 0, // let's remove bson id's from request's result
        sum: 1, // we need this field
        release_sum: 1,
        // district: '$address.district' // and let's turn the nested field into usual field (usual renaming)
    }).group({
        _id: '$district', // grouping key - group by field district
        minPrice: { $min: '$sum'}, // we need some stats for each group (for each district)
        maxPrice: { $max: '$sum'},
        sum1: {$sum: '$sum'},
        sum2: {$sum: '$release_sum'},
        ordersCount: { $sum: 1 }
    }).exec( (err, result) => {

        if(result.length>0) {
            delete result[0]._id;
            result[0].sum = result[0].sum1;
            result[0].profit = result[0].sum1-result[0].sum2;
            delete result[0].sum2;
            delete result[0].sum1;
            vars.statistic.weakly = result[0];
        } else {
            vars.statistic.weakly = {
                minPrice: 0,
                maxPrice: 0,
                sum:    0,
                ordersCount:0
            };
        }
        vars.save();
    });

    Order.aggregate().match({$and: [{status: 4}, {updatedAt: { $gte: moment().subtract(1,'months').toDate()}}] }).project( {
        _id: 0, // let's remove bson id's from request's result
        sum: 1, // we need this field
        release_sum: 1,
        // district: '$address.district' // and let's turn the nested field into usual field (usual renaming)
    }).group({
        _id: '$district', // grouping key - group by field district
        minPrice: { $min: '$sum'}, // we need some stats for each group (for each district)
        maxPrice: { $max: '$sum'},
        sum1: {$sum: '$sum'},
        sum2: {$sum: '$release_sum'},
        ordersCount: { $sum: 1 }
    }).exec( (err, result) => {

        if(result.length>0) {
            delete result[0]._id;
            result[0].sum = result[0].sum1;
            result[0].profit = result[0].sum1-result[0].sum2;
            delete result[0].sum2;
            delete result[0].sum1;

            vars.statistic.monthly = result[0];

        } else {
            vars.statistic.monthly = {
                minPrice: 0,
                maxPrice: 0,
                sum:    0,
                ordersCount:0
            };
        }
        vars.save();
    });


    Order.aggregate().match({$and: [{status: 4}, {updatedAt: { $gte: moment().subtract(1,'years').toDate()}}] }).project( {
        _id: 0, // let's remove bson id's from request's result
        sum: 1, // we need this field
        release_sum: 1,
        // district: '$address.district' // and let's turn the nested field into usual field (usual renaming)
    }).group({
        _id: '$district', // grouping key - group by field district
        minPrice: { $min: '$sum'}, // we need some stats for each group (for each district)
        maxPrice: { $max: '$sum'},
        sum1: {$sum: '$sum'},
        sum2: {$sum: '$release_sum'},
        ordersCount: { $sum: 1 }
    }).exec( (err, result) => {

        if(result.length>0) {
            delete result[0]._id;
            result[0].sum = result[0].sum1;
            result[0].profit = result[0].sum1-result[0].sum2;
            delete result[0].sum2;
            delete result[0].sum1;
            vars.statistic.yearly = result[0];

        } else {
            vars.statistic.yearly = {
                minPrice: 0,
                maxPrice: 0,
                sum:    0,
                ordersCount:0
            };
        }
        vars.save();
    });

    if(req.body.daterange) {
        let dates = req.body.daterange.split(" - ");

        let from = moment(dates[0], 'DD.MM.YYYY').toDate();
        let to = moment(dates[1], 'DD.MM.YYYY').toDate();

        console.log(from, to);

        Order.aggregate().match({$and: [{status: 4}, {updatedAt: { $gte: from, $lte: to}}] }).project( {
            _id: 0, // let's remove bson id's from request's result
            sum: 1, // we need this field
            release_sum: 1,
            // district: '$address.district' // and let's turn the nested field into usual field (usual renaming)
        }).group({
            _id: '$district', // grouping key - group by field district
            minPrice: { $min: '$sum'}, // we need some stats for each group (for each district)
            maxPrice: { $max: '$sum'},
            sum1: {$sum: '$sum'},
            sum2: {$sum: '$release_sum'},
            ordersCount: { $sum: 1 }
        }).exec( (err, result) => {

            if(result.length>0) {
                delete result[0]._id;
                result[0].sum = result[0].sum1;
                result[0].profit = result[0].sum1-result[0].sum2;
                delete result[0].sum2;
                delete result[0].sum1;
                vars.statistic.custom = result[0];
                vars.statistic.custom.custom_date = req.body.daterange;
            } else {
                vars.statistic.custom = {
                    minPrice: 0,
                    maxPrice: 0,
                    sum:    0,
                    ordersCount:0
                };
            }
            vars.save();
        });
    }
    res.redirect(res.app.get('adminPage'));
};


exports.getIndex = async (req,res) => {
    let _var = await Vars.findOne();
    let profit = _var.statistic;
    delete _var.statistic;
    res.render('admin/index',{
        war: _var,
        profit: profit,
        title:"Управление",
        adminPage:res.app.get('adminPage'),
        menuCode: 800
    });
};

exports.getOrders = async (req,res, next) => {
    let count = await Order.find().count();
    let page = req.params.page ? req.params.page : 1;
    let orders = await Order.find().limit(PAGE_LIMIT).skip((page-1)*PAGE_LIMIT).populate('_chip _lot _payeer _seller _game _chip_page _lot_page paymentSystem').sort({order_id: -1});

    res.render('admin/orders',{
        title:"Управление",
        count: count,
        limit: PAGE_LIMIT,
        page: page || 1,
        adminPage:res.app.get('adminPage'),
        menuCode: 801,
        orders: orders,
        moment: moment
    });
};


exports.getPaySystems = (req,res, next) => {
    ps.find().exec((err, systems) => {
        if(err) next(err);

        res.render('admin/paymentsystems',{
            title:"Платёжные системы",
            adminPage:res.app.get('adminPage'),
            menuCode: 803,
            ps: systems,
        });
    });

};

exports.getPaySystemSettings = (req, res, next) => {
    ps.findOne({_id:req.params.ps_id}).exec((err, system) =>{

        if(err) next(err);
        const settings_page = require('..'+system.pay_system_setting_controller);
        settings_page.exec(req,res,system);
    })
};

exports.postSavePS = (req, res, next) => {
    ps.findOne({_id:req.params.ps_id}).exec((err, system) =>{

        let log = new Log({
            user: req.user._id,
            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            description: 'Изменил комиссию платёжной системы',
            type:'info'
        });
        log.save();

        if(err) next(err);
        system.title = req.body.title;
        system.ref_back = req.body.ref_back.replace(',','').replace(' ','');
        system.commision = req.body.commision.replace(',','').replace(' ','');
        system.save();
        res.redirect(res.app.get('adminPage')+'/payment-systems')
    })
};

exports.postPaySystemSettings = (req, res, next) => {
    ps.findOne({_id:req.params.ps_id}).exec((err, system) =>{

        if(err) next(err);
        const settings_page = require('..'+system.pay_system_setting_controller);
        settings_page.exec(req,res,system);
    })
};

exports.disablePaySystem = (req, res, next) => {
    ps.findOne({_id:req.query.id},(err, ps) => {
        ps.active = !ps.active;
        if(ps.active === false) {
            let log = new Log({
                user: req.user._id,
                ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                description: 'Выключил платёжную систему',
                type:'info'
            });
            log.save();
        }
        ps.save((err) => {
            res.redirect(res.app.get('adminPage')+'/payment-systems');
        });

    })
};

exports.getConfig = (req,res,next) => {
    let courses;
    Config.findOne({param:"Courses"}).exec((err, CoursCFG) => {
        if(err) return next(err);
        courses = CoursCFG;
        res.render('admin/config',{
            title:"Настройки сайта",
            adminPage:res.app.get('adminPage'),
            courses: courses,
            menuCode: 804,
        });
    });

};

exports.postConfig = (req,res,next) => {
    let avalibleTasks = ["saveCourses"];

    if(!req.body.task || avalibleTasks.indexOf(req.body.task) == -1 )
        return next('Не выбрано действие!');

    switch (req.body.task) {
        case "saveCourses":
            Config.findOne({param:"Courses"}).exec((err, CoursCFG) => {
                let cfg;
                if(!CoursCFG) {
                    cfg = new Config();
                    cfg.param = "Courses";
                } else {
                    cfg = CoursCFG;
                }
                cfg.value = req.body.vaults;

                cfg.value['RUB'] = '1';
                let log = new Log({
                    user: req.user._id,
                    ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                    description: 'Изменил курсы валют на сайте',
                    type:'info'
                });
                log.save();

                cfg.save((err)=> {
                    if (err) return (next(err));
                    req.flash('info', {msg: 'Курысы валют успешно обновлены!'});
                    res.redirect(res.app.get('adminPage') + '/config');
                });
            });
            break;
    }


};

exports.getWithdrawals = async (req, res, next) => {
    try {
        let count = await Operations.find({in_out:'withdraw'}).count();
        let page = req.params.page ? req.params.page : 1;
        let operations = await Operations.find({in_out:'withdraw'}).limit(PAGE_LIMIT).skip((page-1)*PAGE_LIMIT).populate('user');

        //console.log(count);
        res.render('admin/withdrawals', {
            count: count,
            limit: PAGE_LIMIT,
            page: page || 1,
            title: "Настройки сайта",
            adminPage: res.app.get('adminPage'),
            operations: operations,
            menuCode: 805,
        });
    } catch(err) {
        req.flash('errors', {msg: err.message});
        res.redirect(res.app.get('adminPage'));
    }
};
exports.toggleOff = async (req, res, next) => {
    try {
        global.site_enabled = !global.site_enabled;

        new Log({
            user: req.user._id,
            ip: req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            description: global.site_enabled ? "Включил сайт " :  'Выключил сайт',
            type:'danger'
        }).save();


        res.redirect(res.app.get('adminPage')+'/config');
    } catch(err) {
        req.flash('errors', {msg: err.message});
        res.redirect(res.app.get('adminPage'));
    }
};


exports.getLetters = async (req, res, next) => {
    try {
        res.render('admin/letters', {
            title: 'Рассылка',
            menuCode: 808,
            adminPage: res.app.get('adminPage'),
        });
    } catch(e) {
        console.error(e);
        req.flash('errors', {msg: e.message});
        res.redirect(res.app.get('adminPage'));
    }
};

exports.postLetters = async (req, res, next) => {
    //console.log(req.body.description);

    req.flash('info', {msg: "Сообщение отправленно ена рассылку!"});
    res.redirect(res.app.get('adminPage')+'/letters');
    let users = await User.find({banned:false,activated:true},'_id');
    for(let k in users) {
        if(!users.hasOwnProperty(k)) continue;
        ChatHelper.AdminMessage(req.body.description, [users[k]._id, '5963511824301a436729fc2a']);
        //console.info("Sending message to users["+k+"]._id = " + users[k]._id);
    }
};

exports.getOperations = async (req, res, next) => {
    try {
        let count = await Operations.find().count();
        let page = req.params.page ? req.params.page : 1;
        let operations = await Operations.find({ $or: [{in_out: 'in'}, {in_out: 'out'}]}).sort({operation_id:-1}).limit(PAGE_LIMIT).skip((page-1)*PAGE_LIMIT).populate('user');

        //console.log(count);
        res.render('admin/operations', {
            count: count,
            moment: moment,
            limit: PAGE_LIMIT,
            fullscreen: false,
            page: page || 1,
            title: "Денежные операции",
            adminPage: res.app.get('adminPage'),
            operations: operations,
            menuCode: 806,
        });
    } catch(err) {
        req.flash('errors', {msg: err.message});
        res.redirect(res.app.get('adminPage'));
    }
};


exports.addOperations = async (req, res, next) => {
    try {

        let Operation = new Operations(
            {
                wallet:'system',
                user: req.user._id,
                in_out: req.body.type,
                sum: req.body.sum.replace(',','').replace(' ',''),
                status: 0,
                comment: req.body.comment,
                type: req.body.ps
            }
        );
        await Operation.save();


        let ProfitStat = new ProfitStats({
            sum: req.body.sum.replace(',','').replace(' ',''),
            operation: (req.body.type === 'in') ? 'input':'output',

            user: req.user._id,
            wallet: Helper.OperationWallet(req.body.ps),
            purse: 'сайт',
            need_confirmation: false,
            confirmed_by: req.user._id,
            searchable: {
                username: req.user.username,
                date: moment().format('HH:mm:ss DD.MM.YYYY'),
                description: 'Денежная операция'
            }
        });
        ProfitStat.save();

        res.json({errors:0, operation: Operation.toObject(),
            date:moment(Operation.updatedAt).format('HH:mm:ss DD-MM-YYYY'),
            username: req.user.username
        });
    } catch(err) {
        res.json({errors:1, msg:err.message});
    }
};

exports.postWithdrawals = async (req, res, next) => {
    if(req.params.task && req.query.operation) {
        let operation = await Operations.findOne({_id: req.query.operation}).populate('user');
        switch (req.params.task) {
            case "paid":
                await User.update(
                    { "_id": operation.user._id, "operations._id": operation.user_operation },
                    {"operations.$.status":'success'});

                operation.status = 1;
                await operation.save();
                req.flash('info', {msg: 'Вывод средств пользователю ' +operation.user.username +' на сумму '+ operation.sum + ' на кошелёк ' + operation.wallet+ ' Подтверждён!'});
                let Operation = new Operations(
                    {
                        wallet:operation.wallet,
                        user: operation.user,
                        in_out: 'out',
                        sum: operation.sum,
                        status: 0,
                        comment: 'Вывод пользователю',
                        type: operation.type
                    }
                );
                await Operation.save();
                return res.redirect(res.app.get('adminPage')+'/withdrawals');
                break;
            case "cancel":
                await User.update(
                    { "_id": operation.user._id, "operations._id": operation.user_operation },
                    {"operations.$.status":'canceled'});

                operation.status = 2;
                await operation.save();
                req.flash('info', {msg: 'Вывод отменен, деньги пользователю НЕ ВОЗВРАЩЕННЫ!'});
                return res.redirect(res.app.get('adminPage')+'/withdrawals');
                break;

            case "refund":
                let update_obj = {"operations.$.status":'refunded'};
                update_obj['balances'] = {};
                update_obj['balances'][operation.type] = operation.user.balances[operation.type] + operation.sum;

                await User.update(
                    { "_id": operation.user._id, "operations._id": operation.user_operation },
                    update_obj);

                operation.status = 3;
                await operation.save();
                req.flash('info', {msg: 'Средства пользователю ' +operation.user.username +' на сумму '+ operation.sum + ' возвращенны на баланс!'});
                return res.redirect(res.app.get('adminPage')+'/withdrawals');
                break;
        }
    }else {
        return res.redirect(res.app.get('adminPage')+'/withdrawals');
    }

};

exports.getLogs = async (req, res, next) => {
  try {
      res.render('admin/log', {
          title: 'Логи',
          adminPage: res.app.get('adminPage'),
          fullscreen: false,
          menuCode:807
      });
  }  catch (e) {
      console.error(e);
      next(e);
  }
};

exports.postLogs = async (req, res, next) => {
    try {



        let range = {};
        if(req.query.range) {
            let dates = req.query.range.split(" - ");

            let from = moment(dates[0], 'DD.MM.YYYY').toDate();
            let to = moment(dates[1], 'DD.MM.YYYY').add(23, 'hours').add(59, 'minutes').toDate();
            range = {$and: [{updatedAt: { $gte: from, $lte: to}}]};
        }


        let table = await Log.dataTables({
            limit: req.body.length,
            skip: req.body.start,
            populate: [
                { path: 'user', select: 'username _id' },
            ],
            search: {
                value: req.body.search.value,
                fields: ['description', 'ip','user.username']
            },
            range: range,
            order: req.body.order,
            columns: req.body.columns,
            sort: {
                seller_stat_id: -1,

            }
        });

        let adminPage = res.app.get('adminPage');

        let arr = [];
        for(let log of table.data) {
            arr.push({
                user: {
                    _id: log.user? log.user._id : "",
                    username: log.user ? `<a href="${adminPage}/user/${log.user._id}">${log.user.username}</a>` : "гость"
                },
                description: log.description,
                ip: log.ip,
                updatedAt: moment(log.updatedAt).format("HH:mm:ss DD.MM.YYYY"),
                sClass: log.type || "",
                ban: '<button class="btn btn-primary banbtn" onclick="last_selected_user=\''+log._id+'\'" data-toggle="modal" data-target=".bs-ban">|||</button>'
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