'use strict';
const mongoose = require('mongoose');
const User = require('./User');

const PublicChatSchema = new mongoose.Schema({
    _owner: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    message: String,
    show: Boolean,
    chat: String,
    deleted: {type: Boolean, default: false}
},
{
    timestamps: true
});

const PublicChat = mongoose.model('PublicChat',PublicChatSchema);

module.exports = PublicChat;