'use strict';
const Chat = require('../models/Chat');
const User = require('../models/User');
const mongoose = require('mongoose');
const async = require('async');
const Moment = require('moment');
exports.getChatIndex = (req, res, next) => {
    if(req.query.user && req.query.user === req.user._id.toString()) return res.redirect('/chat');
    async.waterfall([
        // если к нам приходит запрос с Id пользователя ищем его
        function (callback) {
            if
            (
                req.query.user &&
                mongoose.Types.ObjectId.isValid(req.query.user)
            )
            {
                User.findOne({_id: req.query.user}).exec((err, user) => {
                    if(err) return next(err);
                    if(!user) {
                        req.flash('info', {msg: "Пользователь не найден."});
                        res.redirect('/');
                        return next("Пользователь не найден.");
                    } else {
                        callback(null, user);
                    }
                });

            }
            else
            {

                callback(null, null);
            }
        },
        // Ищем все чаты в которых учавствует текущий пользователь
        function (user, callback)
        {
            Chat
                .find({subscribers:{$in:[req.user._id.toString()]}, banned:false})
                .populate('messages.sender')
                .sort({updatedAt: -1})
                .exec((err, chats) => {

                let chatter_id = '';
                let _chat = null;

                async.eachOf(chats, (chat, id, Done) => {
                    //if(_chat === null ) _chat = chat;
                    chats[id]["chatter"] = {
                        id: null,
                        name: null,
                    };
                    chats[id]["hasNewEntries"] = false;

                    if (chats[id].subscribers[0].toString() === req.user._id.toString()) {
                        chats[id].chatter.id = chats[id].subscribers[1].toString();
                    } else {
                        chats[id].chatter.id = chats[id].subscribers[0].toString();
                    }

                    if(req.user.counters.unread.indexOf(chats[id]._id.toString()) !== -1)
                    {
                        chats[id]["hasNewEntries"] = true;
                    }

                    if (user !== null && chats[id].chatter.id === user._id.toString()) {
                        _chat = chats[id];
                    }
                  //  chats[id]['time'] = Moment(chats[id].updated).format('DD MMMM, H:m');

                    User.findOne({_id: chats[id].chatter.id}).exec((err, _usr) => {

                        if(user === null) {
                            user = _usr;
                            _chat = chats[id];
                        }

                        if(_chat && req.user.counters.unread.indexOf(_chat._id.toString()) !== -1)
                            User.findOneAndUpdate({_id:req.user._id}, {$pop:{"counters.unread": chat._id}}).exec();


                        chats[id].chatter.name = _usr.username;
                        Done();
                    });
                }, (err) => {
                    callback(null, user, chats, _chat);
                });
            });
        },
        
    ], function (err, user, chats, _chat) {
        res.render('chat/chat',{
            title: "Сообщения",
            current_user_id: (user !== null) ? user._id.toString() : null,
            chat: _chat,
            _user: (user !== null) ? user : null,
            chats: chats,
            moment: Moment,
            menuCode: 106
        });
    });


};