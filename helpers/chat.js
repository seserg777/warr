'use strict';

const Chat = require('../models/Chat');
const moment = require('moment');
const User = require('../models/User');
const FCM = require('fcm-node');
const fcm = new FCM("AAAAA1Irkvs:APA91bECttP52Nq_A4dA-VEfvzIRkw3ydNlAwngVQiidRxKmK_vZU7CS9oszGU6Cca75Pi7BUSjnrQPFqtRQGoUcbtlj3jx8fbTWKAjbS40wBS5IE-Q10rBzzc7qKqptLJ386h0SMXYM");


function sendIo(html, receivers, chat_id) {

        for (let receiver of receivers) {

                global.io.in(receiver).emit('private-message', {
                    from: "111111111111111111111111",
                    sender_id: "111111111111111111111111",
                    sender_name: "Play4Pay",
                    message: html,
                    chat: chat_id,
                    time: moment(Date.now()).format('DD MMMM, HH:mm:ss'),
                    system: true
                });

        }

}

function sendIo2(html, receivers, chat_id) {

    for (let receiver of receivers) {

        global.io.in(receiver).emit('private-message', {
                from: "5963511824301a436729fc2a",
                sender_id: "5963511824301a436729fc2a",
                sender_name: "Play4Play",
                message: html,
                chat: chat_id,
                time: moment(Date.now()).format('DD MMMM, HH:mm:ss'),
                system: true
            });

    }

}


exports.SystemMessage = (html, receivers ) =>  {

    if(receivers && receivers.length === 2) {
        //fix it, if it ObjectId
        receivers[0] = receivers[0].toString();
        receivers[1] = receivers[1].toString();
        let dbCreated = false;
        Chat.findOne({subscribers: {$all: [receivers[0], receivers[1]]}}).exec((err, chat) => {
            if (chat && chat._id) {
                Chat.update({_id: chat._id},
                    {
                        $push: {
                            messages: {
                                sender: "111111111111111111111111",
                                message: html,
                                isSystem: true
                            }
                        }
                    },
                    function (err, numAffected, rawResponse) {
                        sendIo(html, receivers, chat._id);
                    }
                );


            } else { // создадим новый чатик? :-/
                let chat = new Chat();
                chat.subscribers.push(receivers[0]);
                chat.subscribers.push(receivers[1]);
                chat.last_messages.push({
                    sender: receivers[0]
                });
                chat.last_messages.push({
                    sender: receivers[1]
                });
                chat.messages.push({
                    sender: "111111111111111111111111",
                    message: html,
                    isSystem: true

                });
                chat.save((err) => {
                    if(!err) {
                        sendIo(html, receivers, chat._id);
                    }
                });
            }
        });


        User.findById(receivers[0]).exec((err, reciver) => {
            if(reciver.push_notifications.enabled) {
                for(let token of reciver.push_notifications.tokens) {
                    fcm.send({ //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                        to: token,
                        notification: {
                            title: "Play4Play.ru",
                            body: "Новое событие на сайте!",
                            click_action: 'https://play4play.ru/',
                            icon: 'https://play4play.ru/images/icons/android-icon-96x96.png'
                        },
                    }, function (err, response) {
                        if (err) {
                            console.log("Something has gone wrong!")
                        } else {
                            //console.log("Successfully sent with response: ", response)
                        }
                    });
                }
            }
        });

        User.findById(receivers[1]).exec((err, reciver) => {
            if(reciver.push_notifications.enabled) {
                for(let token of reciver.push_notifications.tokens) {
                    fcm.send({ //this may vary according to the message type (single recipient, multicast, topic, et cetera)
                        to: token,
                        notification: {
                            title: "Play4Play.ru",
                            body: "Новое событие на сайте!",
                            click_action: 'https://play4play.ru/',
                            icon: 'https://play4play.ru/images/icons/android-icon-96x96.png'
                        },
                    }, function (err, response) {
                        if (err) {
                            console.log("Something has gone wrong!")
                        } else {
                            //console.log("Successfully sent with response: ", response)
                        }
                    });
                }
            }
        });
    }
};

exports.AdminMessage = (html, receivers ) =>  {

    if(receivers && receivers.length === 2) {
        //fix it, if it ObjectId
        receivers[0] = receivers[0].toString();
        receivers[1] = receivers[1].toString();
        let dbCreated = false;
        Chat.findOne({subscribers: {$all: [receivers[0], receivers[1]]}}).exec((err, chat) => {
            if (chat && chat._id) {
                Chat.update({_id: chat._id},
                    {
                        $push: {
                            messages: {
                                sender: "5963511824301a436729fc2a",
                                message: html,
                                isSystem: true
                            }
                        }
                    },
                    function (err, numAffected, rawResponse) {

                        if(!err) {
                            if(receivers[0] !== "5963511824301a436729fc2a")
                                User.findOneAndUpdate({_id:receivers[0]}, {$addToSet:{"counters.unread": chat._id}})
                                    .exec((err) => {
                                        if(err) console.error(err);
                                    });
                            if(receivers[1] !== "5963511824301a436729fc2a")
                                User.findOneAndUpdate({_id:receivers[1]}, {$addToSet:{"counters.unread": chat._id}})
                                    .exec((err) => {
                                        if(err) console.error(err);
                                    });

                            sendIo2(html, receivers, chat._id);
                        }
                    }
                );
            } else { // создадим новый чатик? :-/
                let chat = new Chat();
                chat.subscribers.push(receivers[0]);
                chat.subscribers.push(receivers[1]);
                chat.last_messages.push({
                    sender: receivers[0]
                });
                chat.last_messages.push({
                    sender: receivers[1]
                });
                chat.messages.push({
                    sender: "5963511824301a436729fc2a",
                    message: html,
                    isSystem: true
                });
                chat.save((err) => {

                    if(!err) {
                        if(receivers[0] !== "5963511824301a436729fc2a")
                            User.findOneAndUpdate({_id:receivers[0]}, {$addToSet:{"counters.unread": chat._id}})
                                .exec((err) => {
                                    if(err) console.error(err);
                                });
                        if(receivers[1] !== "5963511824301a436729fc2a")
                            User.findOneAndUpdate({_id:receivers[1]}, {$addToSet:{"counters.unread": chat._id}})
                                .exec((err) => {
                                    if(err) console.error(err);
                                });

                        sendIo2(html, receivers, chat._id);
                    }
                });
            }
        });
    }
};