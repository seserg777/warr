'use strict';
const bcrypt = require('bcrypt-nodejs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const moment = require('moment');
const dataTables = require('../modules/datatables/mongoose-datatables');
moment.locale('ru');


const userSchema = new mongoose.Schema({
    email: {type: String},
    username: {type: String, unique: true},
    isAdmin: {type: Boolean, default: false},
    banned: {type: Boolean, default: false},
    password: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    phone: {
        number: {type: String},
        valid: {type: Boolean, default: false},
        code: String,
        errors: {type: Number, default: 0}
    },
    balance: Number,
    vkontakte: String,
    facebook: String,
    twitter: String,
    google: String,
    github: String,
    instagram: String,
    linkedin: String,
    steam: String,
    tokens: Array,
    lastActive: Date,
    isSeller: {type: Boolean, default: false},
    notifications: {type: Boolean, default: false},
    activated: {type: Boolean, default: false},
    activationKey: String,
    invitedBy: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    promo: { type: String },
    saleSum: { type: Number, default: 0 },
    deals_count: { type: Number, default: 0 },
    push_notifications: {
        enabled: {type: Boolean, default: false},
        tokens: [String],
    },
    sms_notifications: {
        after_purchase:  {type: Boolean, default: false},
        on_new_chat:  {type: Boolean, default: false},
    },
    referral: {
        enabled: {type: Boolean, default: false},
        balance: { type: Number, default: 0 },
        registrations: { type: Number, default: 0 }, // кол-во регистраций
        deals: { type: Number, default: 0 }, // кол-во сделок
        deals_sum: { type: Number, default: 0 }, // сумма сделок
        bonus_sum: { type: Number, default: 0 }, // Итого вознаграждение
    },
    profile: {
        name: {type: String, default: ''},
        gender: {type: String, default: ''},
        location: {type: String, default: ''},
        website: {type: String, default: ''},
        picture: {type: String, default: ''}
    },
    counters: {
        myorders: {type: Number, default: 0},
        payorders: {type: Number, default: 0},
        messages: {type: Number, default: 0},
        unread: [{type: mongoose.Schema.Types.ObjectId, ref: 'Chat'}],
    },
    balances: {
        webmoney: {type: Number, default: 0.0},
        yandex: {type: Number, default: 0.0},
        qiwi: {type: Number, default: 0.0},
        play4play: {type: Number, default: 0.0}
    },
    wallets: [
        {
            type: {type: String, default: 'webmoney', enum: ["webmoney", "qiwi", "yandex"]},
            wallet: {type: String, default: ""}
        }
    ],
    accepting: {
        webmoney: {type: Boolean, default: false},
        yandex: {type: Boolean, default: false},
        qiwi: {type: Boolean, default: true}
    },
    operations: [
        {
            type: {type: String, default: ''},
            subject: {type: String, default: ''},
            date: { type: Date, default: Date.now },
            status: {type: String, default: 'pending', enum: ["success", "canceled", "pending", "refunded"]},
            sum: {type: Number, default: 0.0},
            ps: {type: String, default: 'QIWI', enum: ["QIWI", "Webmoney", "Yandex.Money", "UnitPay", "Balance", "Play4Pay"]},
        }
    ],
    comments: [
        {
            from: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
            order: {type: mongoose.Schema.Types.ObjectId, ref: 'Order'},
            subject: String,
            message: String,
            reply: String,
            date: { type: Date, default: Date.now }
        }
    ],
    otp: {
        enabled: {type: Boolean, default:false},
        code: {type: String}
    }


}, {timestamps: true});

/**
 * Password hash middleware.
 */
userSchema.pre('save', function (next) {
    const user = this;
    if (!user.isModified('password')) {
        return next();
    }
    bcrypt.genSalt(10, (err, salt) => {
        if (err) {
            return next(err);
        }
        bcrypt.hash(user.password, salt, null, (err, hash) => {
            if (err) {
                return next(err);
            }
            user.password = hash;
            next();
        });
    });
});

/**
 * Helper method for validating user's password.
 */
userSchema.methods.comparePassword = function (candidatePassword, cb) {
    bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
        cb(err, isMatch);
    });
};

/**
 * Helper method for getting user's gravatar.
 */
userSchema.methods.gravatar = function (size) {
    if (!size) {
        size = 200;
    }
    if (!this.email) {
        return `https://gravatar.com/avatar/?s=${size}&d=retro`;
    }
    const md5 = crypto.createHash('md5').update(this.email).digest('hex');
    return `https://gravatar.com/avatar/${md5}?s=${size}&d=retro`;
};
userSchema.methods.incRefferals = function(cb) {
    this.update({_id: this.invitedBy.toString()},{
        $inc: {
            'referral.registrations' : 1
        }
    }).exec(cb);
};

userSchema.virtual('regDateFromNow').get(function () {
    return moment(this.createdAt).fromNow();
});


userSchema.virtual('isOnline').get(function () {
    return ((moment().unix() - moment(this.lastActive).unix()) / 60) < 15;
});

userSchema.virtual('isInTouch').get(function () {
    return (!this.isOnline && this.sms_notifications.on_new_chat && (this.balances.webmoney >= 1.8 || this.balances.yandex >= 1.8 || this.balances.qiwi >= 1.8) );
});

userSchema.plugin(dataTables, {
    totalKey: 'recordsTotal',
    dataKey: 'data'
});

const User = mongoose.model('User', userSchema);

module.exports = User;
