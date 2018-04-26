'use strict';
const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);
const Vars = require('./Vars');


const operationSchema = new mongoose.Schema({
        operation_id: Number,
        user:  {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        user_operation: {type: mongoose.Schema.Types.ObjectId},
        type: {type: String, default: 'webmoney', enum: ["webmoney", "qiwi", "yandex", "balance", "play4play"]},
        status: {type: Number, default: 0},
        wallet: String,
        sum: {type: Number, default: 0},
        in_out: {type: String, default: 'out', enum: ["in", "out", "withdraw"]},
        comment: String
        },
    {
        timestamps: true
    });

operationSchema.pre('save', function (next) {
    const operation = this;
    let amount = 0;
    if(operation.in_out === 'in' || operation.in_out === 'out') {
        if(operation.in_out === 'in')
            amount += operation.sum;
        else
            amount -= operation.sum;

        Vars.findOne({}, (err, _var) => {


            _var.site_balance[operation.type] += amount;
            _var.save();



        });


    }
    next();
});

operationSchema.plugin(AutoIncrement, {inc_field: 'operation_id'});
const Operation = mongoose.model('Operation',operationSchema);
module.exports = Operation;