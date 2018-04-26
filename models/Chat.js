'use strict';
const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    messages: [
        {
            sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            message: String,
            updated: { type: Date, default: Date.now },
            isSystem: {type: Boolean, default: false}
        }
    ],
    subscribers: [ mongoose.Schema.Types.ObjectId ],
    banned: {type: Boolean, default: false},
    last_messages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        time: {type: Date, default: Date.now}
    }]
}, {timestamps: true});

const Chat = mongoose.model('Chat',ChatSchema);
module.exports = Chat;