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

Chat.remove({}).exec();
PublicChat.remove({}).exec();

User.update({},{
    'counters.unread': [],
},{multi: true}).exec();
setTimeout(()=>{
    process.exit();
},1000);