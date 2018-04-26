'use strict';
/**
 * Module dependencies.
 */
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const bodyParser = require('body-parser');
const logger = require('morgan');
const errorHandler = require('errorhandler');
const lusca = require('lusca');
const dotenv = require('dotenv');
const MongoStore = require('connect-mongo')(session);
const flash = require('express-flash');
const path = require('path');
const mongoose = require('mongoose');
const cachegoose = require('cachegoose');
const passport = require('passport');
const validator = require('validator');
const expressValidator = require('express-validator');
const sass = require('node-sass-middleware');
const cookieParser = require('cookie-parser');
const secure = require('express-force-https');
const userWorker = require('./workers/user');
const FCM = require('fcm-node');
const fcm = new FCM("AAAAA1Irkvs:APA91bECttP52Nq_A4dA-VEfvzIRkw3ydNlAwngVQiidRxKmK_vZU7CS9oszGU6Cca75Pi7BUSjnrQPFqtRQGoUcbtlj3jx8fbTWKAjbS40wBS5IE-Q10rBzzc7qKqptLJ386h0SMXYM");

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({path: '.env.example'});


var smsc = require('node-smsc')({
    login: process.env.SMSC_LOGIN,
    password: process.env.SMSC_MD5_PASSWORD,
    hashed: true,
});

global.site_enabled = true;
/**
 * Controllers (route handlers).
 */
//import * as homeController from "controllers/home"
const newsController = require('./controllers/news');
const homeController = require('./controllers/home');
const userController = require('./controllers/user');
const adminController = require('./controllers/admin');
const adminUsersController = require('./controllers/admin_users');
const gameController = require('./controllers/game');
const apiController = require('./controllers/api');
const contactController = require('./controllers/contact');
const ordersController = require('./controllers/orders');
const chatController = require('./controllers/chat');
const pageController = require('./controllers/page');
const chipController = require('./controllers/chip');
const lotController = require('./controllers/lot');
const orderController = require('./controllers/order');
const statsController = require('./controllers/stats');
/**
 * API keys and Passport configuration.
 */
const passportConfig = require('./config/passport');

/**
 * Create Express server.
 */
const app = express();
//app.use(secure);
app.disable('x-powered-by');

/**
 * Connect to MongoDB.
 */
mongoose.Promise = global.Promise;

//mongoose.set('debug', true);

mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI, {
    useMongoClient: true,
    /* other options */
});
mongoose.connection.on('error', () => {
    console.error('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
});

cachegoose(mongoose);

/**
 * Express configuration.
 */

app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.set('adminPage', '/admin1337');

app.use(compression());
app.use(sass({
    src: path.join(__dirname, 'public'),
    dest: path.join(__dirname, 'public')
}));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(expressValidator());
const sessionStore = new MongoStore({
    url: process.env.MONGODB_URI || process.env.MONGOLAB_URI,
    autoReconnect: true
});
const sessionMiddleware = session({
    name: "JSESSIOINID",
    resave: true,
    cookie: {
     //      domain: '.play4play.ru'
    },
    saveUninitialized: true,
    secret: process.env.SESSION_SECRET,
    store: sessionStore
});
app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use((req,res, next) => {
    if(!req.user) next();
    else {
        let ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (ip !== req.session.ip) {
            req.flash('errors',{msg:"У вас сменился IP, для безопасности мы разлогинили вас!"});
            req.logout();
            res.redirect('/');
        } else {
            next();
        }
    }
});

app.use((req, res, next) => {

    if (req.path === '/api/upload') {
        next();
    } else if (req.path.includes('/api/payments/webmoney')) {
        next();
    } else if (req.path.includes('/api/payments/yande')) {
        next();
    } else if (req.path.match(/^\/stats/)) {
        next();
    } else {
        lusca.csrf()(req, res, next);
    }
});
app.use(lusca.xframe('SAMEORIGIN'));
app.use(lusca.xssProtection(true));
app.use((req, res, next) => {
    res.locals.user = req.user;

    next();
});

app.use(function (req, res, next) {
    if(req.hostname[0] === 'w' && req.hostname.includes( 'play4play.ru' ) ) {
            res.redirect('https://play4play.ru' + req.url);
    }else
    if(req.hostname === 'play4play.ru' || req.hostname === 'www.play4play.ru') return secure(req,res,next);
    else next();
});

app.use(function (req, res, next) {

    if(global.site_enabled)
        next();
    else {
        if(req.user && req.user.isAdmin)
            next();
        else {
            res.status(500).send('<html><head><title>Тех. работы</title></head><body><center><h1>На стайте ведутся технические работы...</h1></center></body></html>')
        }
    }


});

app.use(function (req, res, next) {
    // After successful login, redirect back to the intended page
    if (!req.user &&
        req.path !== '/check-otp' &&
        !req.path.match(/^\/check-otp/) &&
        req.path !== '/login' &&
        req.path !== '/signup' && !req.path.match(/^\/auth/) && !req.path.match(/\./)) {
        req.session.returnTo = req.path;

    }
    next();
});

app.get('/robots.txt',(req,res,next) => {
   if(req.hostname.indexOf("www") !== 0) {
       res.header('Content-Type', 'text/plain')
       res.end("User-agent: *\r\nDisallow: /")
   }else {
       next();
   }
});
app.use(express.static(path.join(__dirname, 'public'), {maxAge: 31557600000}));
/*
let user_ips = {};
app.use(function(req,res,next) {
    let ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if(user_ips[ip] +200 > new Date().getTime())
        return res.send("Нельзя так часто обновлять страницу");
    else
        user_ips[ip] = new Date().getTime();
    next();
});*/
/**
 * Primary app routes.
 */

app.use(function (req, res, next) {
    if (req.user && req.user._id) {
        userWorker.lastLogin(req.user._id);
        if(req.user.banned) {
            req.logout();
            req.flash('errors', {msg: 'Вы были заблокированы на этом сайте. Для уточнения информации о причине блокировки вы можете обращаться на почту: support@play4play.ru или в онлайн чат.'});
            res.redirect('/');
        }
    } else if(req.query && req.query.promo) {
        User.findOne({promo: req.query.promo}, (err, user)=>{
            if(user) {
                req.session.invitedBy = user._id;
                //console.log('1111111111111111111111111');
            }
        });
    } else if(req.query && req.query.index) {
        User.findOne({promo: req.query.index}, (err, user)=>{
            if(user) {
                req.session.invitedBy = user._id;
                //console.log('1111111111111111111111111');
            }
        });
    }
    next();
});

app.get('/check-otp/:cancel' , userController.postOTPauth);
app.post('/check-otp' , userController.postOTPauth);

app.use((req,res, next) => {
    if(req.session.needOTP) {
        userController.getOTPauth(res, res, next);
    } else {
        next();
    }
});

app.get('/', homeController.index);
app.get('/login', userController.getLogin);
app.post('/login', userController.postLogin);
app.get('/logout', userController.logout);
app.get('/forgot', userController.getForgot);
app.post('/forgot', userController.postForgot);
app.get('/reset/:token', userController.getReset);
app.post('/reset/:token', userController.postReset);
app.get('/signup', userController.getSignup);
app.post('/signup', userController.postSignup);
app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);
app.get('/account', passportConfig.isAuthenticated, (req,res) => {res.redirect('/account/balance')});
app.get('/resend-email', userController.getResendActivation);
app.post('/resend-email', userController.postResendActivation);
app.get('/confirm-email/:key', userController.getActivateUser);

app.get('/blog', newsController.index);
app.get('/blog/add', passportConfig.isAdmin, newsController.add);
app.get('/blog/del/:id', passportConfig.isAdmin, newsController.delete);
app.get('/blog/edit/:id', passportConfig.isAdmin, newsController.add);
app.post('/blog/add', passportConfig.isAdmin, newsController.post);
app.get('/blog/:id', newsController.read);



app.get('/thank-you-for-registration', (req,res)=> {res.render('user/registration-end')});
app.get('/account/balance', passportConfig.isAuthenticated, userController.getBalance);
app.post('/account/balance/accept', passportConfig.isAuthenticated, userController.postAcceptChanged);
app.get('/account/profile', passportConfig.isAuthenticated, userController.getAccount);

app.get('/account/partner', passportConfig.isAuthenticated, userController.getPartner);

app.get('/account/partner/withdraw', passportConfig.partnerEnabled, userController.getPartnerWithdraw);
app.get('/account/partner/enable', passportConfig.isAuthenticated, userController.getEnablePartner);
app.post('/account/setup2a', passportConfig.isAuthenticated, userController.postEnable2fa);
app.get('/account/wallets', passportConfig.isAuthenticated, userController.getWallets);
app.post('/account/wallets', passportConfig.isAuthenticated, userController.postWallets);
app.get('/account/notifications', passportConfig.isAuthenticated, userController.getNotifications);
app.post('/account/notifications', passportConfig.isAuthenticated, userController.postNotifications);
app.get('/account/withdrawal/:method', passportConfig.isAuthenticated, userController.getWithdrawal);
app.post('/account/withdrawal', passportConfig.isAuthenticated, userController.postWithdrawal);
app.post('/account/notification-enable', passportConfig.isAuthenticated, userController.postNotificationsBrowser);
app.post('/account/notification-add-device', passportConfig.isAuthenticated, userController.postAddNotificationsDevice);
//app.post('/account/profile', passportConfig.isAuthenticated, userController.postUpdateProfile);
app.post('/account/password', passportConfig.isAuthenticated, userController.postUpdatePassword);
//app.post('/account/delete', passportConfig.isAuthenticated, userController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConfig.isAuthenticated, userController.getOauthUnlink);

app.get('/orders/purchases', passportConfig.isAuthenticated, ordersController.getPurchases);
app.get('/orders/sales', passportConfig.isAuthenticated, ordersController.getSales);

app.get('/users/:uid', userController.getUser);

app.get('/chat', passportConfig.isAuthenticated, chatController.getChatIndex);
app.get('/help', (req, res)=> {
    res.render('help', {title: "Вопросы и ответы"})
});
app.get('/payer-qa', (req, res)=> {
    res.render('payer-qa', {title: "FAQ покупателя"})
});
app.get('/seller-qa', (req, res)=> {
    res.render('seller-qa', {title: "FAQ продавцов"})
});

app.get('/rules', (req, res)=> {
    res.render('rules', {title: "Правила для продавцов"})
});

app.post('/rules', passportConfig.isAuthenticated, userController.postBeSeller);
app.post('/check-code', passportConfig.isAuthenticated, userController.postBeSeller2);
app.get('/arbitrage', (req, res)=> {
    res.render('arbitrage', {title: "Решение спорных вопросов"})
});
app.get('/partner-system', (req, res)=> {
    res.render('partner-system', {title: "Партнёрскай программа"})
});

app.get(app.get('adminPage'), passportConfig.isAdmin, adminController.getIndex);
app.get(app.get('adminPage') + '/calculate-profit', passportConfig.isAdmin, adminController.calcProfit);
app.post(app.get('adminPage') + '/calculate-profit', passportConfig.isAdmin, adminController.calcProfit);
app.get(app.get('adminPage') + '/payment-systems', passportConfig.isAdmin, adminController.getPaySystems);
app.get(app.get('adminPage') + '/operations', passportConfig.isAdmin, adminController.getOperations);
app.get(app.get('adminPage') + '/operations/:page', passportConfig.isAdmin, adminController.getOperations);
app.post(app.get('adminPage') + '/toggle-off', passportConfig.isAdmin, adminController.toggleOff);
app.post(app.get('adminPage') + '/operations/add', passportConfig.isAdmin, adminController.addOperations);
app.post(app.get('adminPage') + '/operations/:page/add', passportConfig.isAdmin, adminController.addOperations);

app.get(app.get('adminPage') + '/payment-systems/switch', passportConfig.isAdmin, adminController.disablePaySystem);
app.get(app.get('adminPage') + '/payment-systems/:ps_id', passportConfig.isAdmin, adminController.getPaySystemSettings);
app.post(app.get('adminPage') + '/payment-systems/save/:ps_id', passportConfig.isAdmin, adminController.postSavePS);
app.post(app.get('adminPage') + '/payment-systems/:ps_id', passportConfig.isAdmin, adminController.postPaySystemSettings);
app.get(app.get('adminPage') + '/orders', passportConfig.isAdmin, adminController.getOrders);
app.get(app.get('adminPage') + '/orders/:page', passportConfig.isAdmin, adminController.getOrders);
app.get(app.get('adminPage') + '/config', passportConfig.isAdmin, adminController.getConfig);
app.post(app.get('adminPage') + '/config', passportConfig.isAdmin, adminController.postConfig);
app.get(app.get('adminPage') + '/users', passportConfig.isAdmin, adminUsersController.getUsers);
app.post(app.get('adminPage') + '/users', passportConfig.isAdmin, adminUsersController.postUsers);
app.get(app.get('adminPage') + '/users/:page', passportConfig.isAdmin, adminUsersController.getUsers);
app.post(app.get('adminPage') + '/users', passportConfig.isAdmin, adminUsersController.getUsers);
app.get(app.get('adminPage') + '/user/:uid', passportConfig.isAdmin, adminUsersController.getUserPage);
app.get(app.get('adminPage') + '/user/:uid/remove-deal/:type/:cp_id', passportConfig.isAdmin, adminUsersController.RemoveChip);
app.get(app.get('adminPage') + '/user/:uid/deals-history',  passportConfig.isAdmin, adminUsersController.getUserPageDeals);
app.get(app.get('adminPage') + '/user/:uid/reviews',  passportConfig.isAdmin, adminUsersController.getUserReviews);
app.get(app.get('adminPage') + '/user/:uid/remove-review/:rid',  passportConfig.isAdmin, adminUsersController.RemoveReview);
app.get(app.get('adminPage') + '/user/:uid/purses',  passportConfig.isAdmin, adminUsersController.getUserPurses);
app.post(app.get('adminPage') + '/user/:uid/purses',  passportConfig.isAdmin, adminUsersController.updateBalances);
app.get(app.get('adminPage') + '/user/:uid/operations',  passportConfig.isAdmin, adminUsersController.getUserOperations);
app.get(app.get('adminPage') + '/user/:uid/chats',  passportConfig.isAdmin, adminUsersController.getUserChats);
app.get(app.get('adminPage') + '/user/:uid/partner',  passportConfig.isAdmin, adminUsersController.getUserPartner);

app.get(app.get('adminPage') + '/letters', passportConfig.isAdmin, adminController.getLetters);
app.post(app.get('adminPage') + '/letters', passportConfig.isAdmin, adminController.postLetters);

//app.get(app.get('adminPage') + '/withdrawals', passportConfig.isAdmin, adminController.getWithdrawals);
//app.get(app.get('adminPage') + '/withdrawals/:page', passportConfig.isAdmin, adminController.getWithdrawals);
//app.get(app.get('adminPage') + '/withdrawals/manage/:task', passportConfig.isAdmin, adminController.postWithdrawals);
app.get(app.get('adminPage') + '/log', passportConfig.isAdmin, adminController.getLogs);
app.post(app.get('adminPage') + '/log', passportConfig.isAdmin, adminController.postLogs);
app.get('/stats', passportConfig.isAdmin, statsController.getIndex);
app.post('/stats', passportConfig.isAdmin, statsController.postIndex);
app.get('/stats/sellers', passportConfig.isAdmin, statsController.getSellers);
app.post('/stats/sellers', passportConfig.isAdmin, statsController.postSellers);

app.get('/stats/referral', passportConfig.isAdmin, statsController.getReferral);
app.post('/stats/referral', passportConfig.isAdmin, statsController.postReferral);

app.get('/stats/profit', passportConfig.isAdmin, statsController.getProfit);
app.post('/stats/profit', passportConfig.isAdmin, statsController.postProfit);
app.get('/stats/refund', passportConfig.isAdmin, statsController.getRefund);
app.post('/stats/refund', passportConfig.isAdmin, statsController.postRefund);

app.post('/stats/confirm', passportConfig.isAdmin, statsController.ajaxConfirm);
app.post('/stats/confirm-withdraw', passportConfig.isAdmin, statsController.ajaxConfirmWithdraw);
app.post('/stats/confirm-referral', passportConfig.isAdmin, statsController.ajaxConfirmReferral);
app.get('/admin/unban', passportConfig.isAdmin, adminUsersController.getBanUser);
app.get('/admin/enablePS', passportConfig.isAdmin, adminUsersController.getPartner);
app.get('/admin/getuser/:id', passportConfig.isAdmin, adminUsersController.getUser);
app.post('/admin/saveuser/:id', passportConfig.isAdmin, adminUsersController.postUser);
app.post('/admin/ban-user', passportConfig.isAdmin, adminUsersController.getBanUserFromLog);
app.post('/admin/ban-ip', passportConfig.isAdmin, adminUsersController.getBanIPFromLog);

app.get('/game/add', gameController.getAddGame);
app.post('/game/add', gameController.postAddGame);
app.get('/game/edit/:id', passportConfig.isAdmin, gameController.getAddGame);
app.post('/game/edit/:id', passportConfig.isAdmin, gameController.postAddGame);
app.get('/game/remove/:id', passportConfig.isAdmin, gameController.getRemoveGame);

app.get('/game/:gid/pages/add', passportConfig.isAdmin, pageController.getAddPage);
app.post('/game/:gid/pages/add', passportConfig.isAdmin, pageController.postAddPage);

app.get('/chips/:chip', chipController.getChip);
app.get('/lots/:lot', lotController.getLot);
app.get('/lots/:lot/trade', passportConfig.isAuthenticated, lotController.getTrade);
app.post('/lots/:lot/trade', passportConfig.isAuthenticated, lotController.postTrade);
app.post('/lots/:lot/trade/delete', passportConfig.isAuthenticated, lotController.postDeleteOffer);
app.post('/lots/:lot/trade/push-up', passportConfig.isAuthenticated, lotController.postPushUp);
app.get('/lots/:lot/edit', passportConfig.isAdmin, pageController.getLotEditPage);
app.get('/lots/:lot/delete', passportConfig.isAdmin, pageController.getLotDelete);
app.post('/lots/:lot/edit', passportConfig.isAdmin, pageController.postAddPage);
app.get('/chips/:chip/trade', passportConfig.isAuthenticated, chipController.getTrade);
app.get('/chips/:chip/price', passportConfig.isAuthenticated, chipController.getPrices);
app.post('/chips/:chip/trade', passportConfig.isAuthenticated, chipController.postTrade);
app.get('/chips/:chip/edit', passportConfig.isAdmin, pageController.getChipEditPage);
app.get('/chips/:chip/delete', passportConfig.isAdmin, pageController.getChipDelete);
app.post('/chips/:chip/edit', passportConfig.isAdmin, pageController.postAddPage);
app.post('/order/create', passportConfig.isAuthenticated, orderController.postCreateOrder);
app.post('/order/close', passportConfig.isAuthenticated, orderController.postCloseOrder);
app.get('/order/create', passportConfig.isAuthenticated, (req, res)=> {
    res.redirect('/')
});
app.get('/order/close', passportConfig.isAuthenticated, (req, res)=> {
    res.redirect('/')
});
app.get('/order/:oid', passportConfig.isAuthenticated, orderController.getOrder);
app.post('/order/:oid/comment', passportConfig.isAuthenticated, orderController.postSendComment);

app.post('/order/pay', passportConfig.isAuthenticated, orderController.postOrderPay);
app.get('/chips/offer/:chip_id', passportConfig.isAuthenticated, chipController.getChipOffer);
app.post('/chips/offer/:chip_id', passportConfig.isAuthenticated, chipController.postCreateChipOffer);
app.get('/lots/offer/:chip_id', passportConfig.isAuthenticated, lotController.getLotOffer);
app.post('/lots/offer/:chip_id', passportConfig.isAuthenticated, lotController.postCreateLotOffer);

app.get('/news');
/**
 * API routes.
 */
app.get('/api/payments/unitpay-Fi3mv', apiController.getUnitpay);
app.post('/api/payments/webmoney/:wallet', apiController.getWebmoney);
app.post('/api/payments/yande-xD', apiController.postYandex);


/**
 * OAuth authentication routes. (Sign in)
 */
app.get('/auth/google', passport.authenticate('google', {scope: 'profile email'}));
app.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/signup?social=1'}), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});

app.get('/auth/vkontakte', passport.authenticate('vkontakte', {scope: ['email']}));

app.get('/auth/vkontakte/callback',
    passport.authenticate('vkontakte', {failureRedirect: "/signup?social=1"}),
    (req, res) =>  {
        res.redirect(req.session.returnTo || '/');
    });

app.get('/auth/steam', passport.authenticate('steam'));
app.get('/auth/steam/callback', passport.authenticate('steam', {failureRedirect: '/signup?social=1'}), (req, res) => {
    res.redirect(req.session.returnTo || '/');
});


/**
 * Error Handler.
 */
app.use(errorHandler());
app.use(function (req, res, next) {
    res.status(404).render('errors/404');
});
app.use(function (error, req, res, next) {
    res.status(500);
    res.render('errors/500.jade', {title: '500: Internal Server Error', error: error});
});

/*
 * Socket.IO
 */
function onAuthorizeFail(data, message, error, accept) {
    accept();
}
const passportSocketIo = require('passport.socketio');
const moment = require('moment');
//var bundle = require('socket.io-bundle');
const PublicChat = require('./models/PublicChat');
const Chat = require('./models/Chat');
const Vars = require('./models/Vars');
const User = require('./models/User');
const Log = require('./models/Log');
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
global.io = io; //added

var clients = {};
global.ioclients = {}; //added
var user_counters = {};
io.use(passportSocketIo.authorize({
    key: 'JSESSIOINID',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    passport: passport,
    cookieParser: cookieParser,
    fail: onAuthorizeFail
}));
let client_last_chat = {};
io.sockets.on('connection', async (socket) => {
    var userId = false;
    if (socket.request.user && socket.request.user.logged_in)
        userId = socket.request.user._id;

    if(userId) {
        setInterval(function () {
            socket.emit('you-are-online', function(response) {
               if(response === 'yes') {
                   userWorker.lastLogin(userId);
               }
            });
        },10000);
    }

    socket.on('admin', function(room) {
        if(socket.request.user.isAdmin)
            socket.join(room);
    });
    if(userId) {
        socket.join(userId);
    }
    socket.on('status', (confirm) => {
        if(userId && socket.request.user.isAdmin) {
            confirm(1);
        } else {
            confirm(0);
        }
    });
    socket.on('remove-main',(_id)=>{
        if (userId && socket.request.user.isAdmin) {
            PublicChat.update({_id:_id},{deleted:true},function (err) {
                if(err)
                    console.error(err);
            });
            io.emit('removed-message', {_id:_id});
        }
    });
    socket.on('message', (data, confirm)=> {
        if (userId) // А юзер то залогинен?
            if (data.chat && data.message && data.chat == 'home') {
                var _now = new Date().getTime();
                if(!client_last_chat.hasOwnProperty(userId) || (client_last_chat[userId]+5000 < _now) ) {
                    client_last_chat[userId] = _now;
                    let message = data.message.slice(0, 4000);

                    message = validator.escape(message);
                    message = message.replace(/\&\#x2F\;/g, '/');
                    message = message.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, "<a href='$1'>$1</a>");
                    message = message.replace(/(?:\r\n|\r|\n)/g, "<br />");
                    let chatMessage = new PublicChat();
                    chatMessage.chat = 'home';
                    chatMessage.message = message;
                    chatMessage._owner = socket.request.user._id;
                    chatMessage.save((err) => {
                        if (err) next(err);
                        confirm(true);
                        io.emit('message', {
                            id: chatMessage._id,
                            chat: 'home',
                            message: message,
                            userId: socket.request.user._id,
                            userName: socket.request.user.username,
                            date: moment(chatMessage.createdAt).format('DD MMMM, HH:mm'),
                            time: moment(chatMessage.createdAt).format('HH:mm:ss')

                        });
                    });
                } else {
                    confirm(false);
                }
            }
    });

    socket.on('my-counters', async (confirm) => {
        if (userId) {
            let user = await User.findById(userId);
            user = user.toObject();
            user.counters.messages = user.counters.unread.length;

            delete user.counters.unread;
            if(user.isAdmin) {
                let _var = await Vars.findOne();

                let counters = user.counters;
                counters.balances = _var.site_balance;
                //console.log(counters);
                confirm(counters);

            } else {
                confirm(user.counters);
            }
        }
    });
    socket.on('chat', (data, confirm) => {
        if (userId) // А юзер то залогинен?
            if (data.from && (data.to || data.chat) && data.message) {
                data.from = userId;
                let search_params = {};
                if(data.to) {
                    search_params =  {subscribers: {$all: [data.from, data.to]}};
                } else if (data.chat) {
                    search_params = {_id: data.chat}
                }
                Chat.find({subscribers: {$in: [data.from]}, last_messages:{ $elemMatch: { sender: data.from , time: { $gte: Date.now() - 5000*60 }}}}).count((err, count)=> {
                    if(count<6) {
                        Chat.findOne(search_params).exec((err, chat) => {
                            if (chat && chat._id) {
                                let message = data.message.slice(0,4000);
                                message = message.replace(/([^a-zA-Zа-я0-9\s\:\\\/\?\=\-\|\%\₽\$\%\#\~\`\'\"\;\<\>\№\\[\]\.\,\_\!\(\)]+)/gi, '');

                                message = validator.escape(message);
                                message = message.replace(/\&\#x2F\;/g,'/');
                                message = message.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,"<a href='$1'>$1</a>");
                                message = message.replace(/(?:\r\n|\r|\n)/g,"<br />");
                                //console.log(message);

                                Chat.update(
                                    {
                                        _id: chat._id,
                                        last_messages: {
                                            $elemMatch: { sender: data.from }
                                        }
                                    },
                                    {
                                        $push: {
                                            messages: {
                                                sender: data.from,
                                                message: message,
                                            },

                                        },
                                        $set: {
                                            "last_messages.$":  {
                                                sender: data.from,
                                                time: Date.now()
                                            }
                                        }

                                    }, function (err, numAffected, rawResponse) {
                                        if (err) {
                                            console.log(err);
                                        } else {
                                            confirm({
                                                sender_id: data.from,
                                                sender_name: socket.request.user.username,
                                                receiver_id: data.to,
                                                receiver_name: "NaN",
                                                is_new: false,
                                                admin: socket.request.user.isAdmin,
                                                message: message,
                                                chat: chat._id.toString(),
                                                time: moment(Date.now()).format('DD MMMM, HH:mm:ss'),
                                            });
                                        }


                                        socket.in(data.to).emit('private-message', {
                                            from: data.from,
                                            sender_id: data.from, sender_name: socket.request.user.username,
                                            message: message,
                                            is_new: false,
                                            admin: socket.request.user.isAdmin,
                                            chat: chat._id,
                                            time: moment(Date.now()).format('DD MMMM, HH:mm:ss'),
                                        });

                                        User.findById(data.to).exec((err, reciver) => {
                                            if(reciver.push_notifications.enabled) {
                                                for(let token of reciver.push_notifications.tokens) {
                                                    fcm.send({ //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                                                        to: token,
                                                        notification: {
                                                            title: socket.request.user.username,
                                                            body: message,
                                                            click_action: 'https://play4play.ru/chat?user='+socket.request.user._id,
                                                            icon: 'https://play4play.ru/images/icons/android-icon-96x96.png'
                                                        },
                                                    }, function (err, response) {
                                                        if (err) {
                                                            console.log("Something has gone wrong!")
                                                        } else {
                                                            console.log("Successfully sent with response: ", response)
                                                        }
                                                    });
                                                }
                                            }


                                            if(reciver.sms_notifications && reciver.sms_notifications.on_new_chat ) {
                                                let can_send = false;
                                                let last_message;
                                                if(chat.last_messages[0] && chat.last_messages[0].sender.toString() === data.to) {
                                                    last_message = moment(chat.last_messages[0].time);
                                                } else if(chat.last_messages[1] &&chat.last_messages[1].sender.toString() === data.to) {
                                                    last_message = moment(chat.last_messages[1].time);
                                                }

                                                let hours_from_last_message = moment().diff(last_message, 'hours');
                                              //  console.log("LAST MESSAGE: ", last_message, " HOURS FROM LAST: "+hours_from_last_message);
                                                if(hours_from_last_message > 12) {
                                                    let has_money = false;
                                                    if (reciver.balances.qiwi >= 1.81) {
                                                        has_money = true;
                                                        User.update({_id: reciver._id},
                                                            {
                                                                $push: {
                                                                    operations: {
                                                                        type: 'out',
                                                                        subject: 'Оплата SMS уведомления',
                                                                        status: 'success',
                                                                        sum: 1.8,
                                                                        ps: "QIWI"
                                                                    }
                                                                },
                                                                $inc: {
                                                                    'balances.qiwi': -1.8
                                                                }
                                                            }).exec();
                                                    }
                                                    else if (reciver.balances.yandex >= 1.81) {
                                                        has_money = true;
                                                        User.update({_id: reciver._id},
                                                            {
                                                                $push: {
                                                                    operations: {
                                                                        type: 'out',
                                                                        subject: 'Оплата SMS уведомления',
                                                                        status: 'success',
                                                                        sum: 1.8,
                                                                        ps: "Yandex.Money"
                                                                    }
                                                                },
                                                                $inc: {
                                                                    'balances.yandex': -1.8
                                                                }
                                                            }).exec();

                                                    }
                                                    else if (reciver.balances.webmoney >= 1.81) {
                                                        has_money = true;
                                                        User.update({_id: reciver._id},
                                                            {
                                                                $push: {
                                                                    operations: {
                                                                        type: 'out',
                                                                        subject: 'Оплата SMS уведомления',
                                                                        status: 'success',
                                                                        sum: 1.8,
                                                                        ps: "Webmoney"
                                                                    }
                                                                },
                                                                $inc: {
                                                                    'balances.webmoney': -1.8
                                                                }
                                                            }).exec();
                                                    }
                                                    if (has_money) {
                                                        /*console.log({
                                                            phones: reciver.phone.number,
                                                            mes: `У вас новый чат на Play4Pay.ru!`,
                                                        });*/
                                                        smsc.send({
                                                            phones: reciver.phone.number,
                                                            mes: `У вас новый чат на Play4Pay!`,
                                                        }).then(function (t1) {
                                                            // console.log(t1);
                                                        }).catch(function (err) {
                                                            //console.error(err);
                                                        });

                                                    }
                                                }
                                            }
                                        });

                                        User.findOneAndUpdate({_id:data.to}, {$addToSet:{"counters.unread": chat._id}})
                                            .exec((err, reciver_user) => {
                                                if(err) console.log(err);
                                            });


                                    });
                            }
                            else { // если беседа не существуюет создаём
                                //console.log("Creating new chat");
                                let message = data.message.slice(0,4000);
                                message = validator.escape(message);
                                message = message.replace(/\&\#x2F\;/g,'/');
                                message = message.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig,"<a href='$1'>$1</a>");
                                message = message.replace(/(?:\r\n|\r|\n)/g,"<br />");
                                let chat = new Chat();
                                chat.subscribers.push(data.from);
                                chat.subscribers.push(data.to);
                                chat.last_messages.push({
                                    sender: data.from
                                });
                                chat.last_messages.push({
                                    sender: data.to
                                });
                                chat.messages.push({
                                    sender: data.from,
                                    message: message,

                                });
                                chat.save();


                                // в кэлбэке отправляем информацию о полученном сообщении
                                confirm({
                                    sender_id: data.from,
                                    sender_name: socket.request.user.username,
                                    receiver_id: data.to,
                                    receiver_name: "",
                                    message: message,
                                    is_new: true,
                                    admin: socket.request.user.isAdmin,
                                    chat: chat._id.toString(),
                                    time: moment(Date.now()).format('DD MMMM, HH:mm:ss'),
                                });

                                socket.in(data.to).emit('private-message', {
                                    from: data.from,
                                    sender_id: data.from, sender_name: socket.request.user.username,
                                    message: message,
                                    is_new: true,
                                    admin: socket.request.user.isAdmin,
                                    chat: chat._id.toString(),
                                    time: moment(Date.now()).format('DD MMMM, HH:mm:ss'),
                                });

                                User.findById(data.to).exec((err, reciver) => {

                                    let log = new Log({
                                        user: data.from,
                                        ip: socket.request.headers['cf-connecting-ip'] || socket.request.headers['x-forwarded-for'] || socket.request.connection.remoteAddress,
                                        description: 'Создал чат с пользователем '+reciver.username,
                                        type:'info'
                                    });
                                    log.save();

                                    if(reciver.push_notifications.enabled) {
                                        for(let token of reciver.push_notifications.tokens) {
                                            fcm.send({ //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                                                to: token,
                                                notification: {
                                                    title: socket.request.user.username,
                                                    body: message,
                                                    click_action: 'https://play4play.ru/chat?user='+socket.request.user._id,
                                                    icon: 'https://play4play.ru/images/icons/android-icon-96x96.png'
                                                },
                                            }, function (err, response) {
                                                if (err) {
                                                    console.log("Something has gone wrong!")
                                                } else {
                                                    console.log("Successfully sent with response: ", response)
                                                }
                                            });
                                        }
                                    }

                                    if(reciver.sms_notifications && reciver.sms_notifications.on_new_chat) {
                                        let has_money = false;
                                        if(reciver.balances.qiwi >= 1.81) {
                                            has_money = true;
                                            User.update({_id: reciver._id},
                                                {
                                                    $push: {
                                                        operations: {
                                                            type: 'out',
                                                            subject: 'Оплата SMS уведомления',
                                                            status: 'success',
                                                            sum: 1.8,
                                                            ps: "QIWI"
                                                        }
                                                    },
                                                    $inc: {
                                                        'balances.qiwi' : -1.8
                                                    }
                                                }).exec();
                                        }
                                        else if(reciver.balances.yandex >= 1.81) {
                                            has_money = true;
                                            User.update({_id: reciver._id},
                                                {
                                                    $push: {
                                                        operations: {
                                                            type: 'out',
                                                            subject: 'Оплата SMS уведомления',
                                                            status: 'success',
                                                            sum: 1.8,
                                                            ps: "Yandex.Money"
                                                        }
                                                    },
                                                    $inc: {
                                                        'balances.yandex' : -1.8
                                                    }
                                                }).exec();

                                        }
                                        else if(reciver.balances.webmoney >= 1.81) {
                                            has_money = true;
                                            User.update({_id: reciver._id},
                                                {
                                                    $push: {
                                                        operations: {
                                                            type: 'out',
                                                            subject: 'Оплата SMS уведомления',
                                                            status: 'success',
                                                            sum: 1.8,
                                                            ps: "Webmoney"
                                                        }
                                                    },
                                                    $inc: {
                                                        'balances.webmoney' : -1.8
                                                    }
                                                }).exec();
                                        }
                                        if(has_money) {
                                            /*console.log({
                                                phones: reciver.phone.number,
                                                mes: `У вас новый чат на Play4Pay.ru!`,
                                            });*/
                                            smsc.send({
                                                phones: reciver.phone.number,
                                                mes: `У вас новый чат на Play4Pay!`,
                                            }).then(function(t1) {
                                               // console.log(t1);
                                            }).catch(function(err){
                                                //console.error(err);
                                            });

                                        }
                                    }
                                });


                                User.findOneAndUpdate({_id:data.to}, {$addToSet:{"counters.unread": chat._id}})
                                    .exec((err, reciver_user) => {});

                            }
                        });
                    } else {
                        confirm({errors: 1, message:"Нельзя так часто отправлять сообщения разным пользователям!"});
                    }
                });
               // console.log(data , search_params);
                // сначала нужно поискать существует ли уже беседа

            }
    });
    socket.on('readed', function(data) {
        if (userId) {
            User.findOneAndUpdate({_id: userId}, {$pop: {"counters.unread": data.chat_id}}).exec();
        }
    });
    socket.on('get_last', function (data) {
        let filter = {chat: data.chat, deleted: false};
        if(socket.request.user.isAdmin) delete filter['deleted'];
        PublicChat.find(filter).populate('_owner').sort({createdAt: 1}).limit(data.count).exec((err, messages)=> {
            if (err) return next(err);
            messages.forEach(function (val, i) {

                socket.emit('message', {
                    id: val.id,
                    chat: 'home',
                    deleted: val.deleted,
                    message: val.message,
                    userId: val._owner._id,
                    userName: val._owner.username,
                    date: moment(val.createdAt).format('DD MMMM, HH:mm'),
                    time: moment(val.createdAt).format('HH:mm:ss')

                });
            });

        });

    });

});

/**
 * Start Express server.
 */
server.listen(app.get('port'), () => {
    console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});

module.exports = app;
