const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');


dotenv.load({ path: '.env.example' });

const Games = require('./models/Game');
const SellersStats = require('./models/SellersStats');
const ReferralStats = require('./models/ReferralStats');
const RefundStats = require('./models/RefundStats');
const ProfitStats = require('./models/ProfitStats');
const User = require('./models/User');
const MainStats = require('./models/MainStats');
const Operations = require('./models/Operations');
const PublicChat = require('./models/PublicChat');
const Chat = require('./models/Chat');
const ChatRoom = require('./models/ChatRoom');
const Chip = require('./models/Chip');
const Lot = require('./models/Lot');
const Log = require('./models/Log');
const Order = require('./models/Order');

const Vars = require('./models/Vars');
const ps = require('./models/PaymentSystem');
mongoose.connect(process.env.MONGODB_URI || process.env.MONGOLAB_URI);
mongoose.connection.on('error', () => {
    console.error('MongoDB Connection Error. Please make sure that MongoDB is running.');
    process.exit(1);
});
Vars.updateOne({}, {
    site_balance: {}
}).exec();
SellersStats.remove({}).exec();
ReferralStats.remove({}).exec();
RefundStats.remove({}).exec();
ProfitStats.remove({}).exec();
MainStats.remove({}).exec();
Chat.remove({}).exec();
PublicChat.remove({}).exec();
Order.remove({}).exec();
Chip.remove({}).exec();
Lot.remove({}).exec();
Log.remove({}).exec();
Operations.remove({}).exec();
User.update({},{
    balance: 0,
    banned: false,
    activated:true,
    'balances.qiwi':0,
    'balances.webmoney':0,
    'balances.yandex':0,
    'balances.play4play':0,
    'referral.enabled' : false,
    'referral.registrations' :0,
    'referral.balance' :0,
    'referral.deals' :0,
    'referral.deals_sum' :0,
    'referral.bonus_sum' :0,
    saleSum: 0,
    deals_count: 0,
    operations: [],
    comments: [],
    push_notifications: {
        enabled: false,
        tokens:[]
    },
    'counters.unread': [],
    'counters.myorders':0,
    'counters.payorders':0,
    'counters.messages':0
},{multi: true}).exec();
setTimeout(()=>{
    process.exit();
},1000);