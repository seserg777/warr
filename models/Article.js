'use strict';

const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);


const articlesSchema = new mongoose.Schema({
    human_id: Number,
    title: String,
    body: String,
    body_short: String,
    body_main_page: String,
    },
    {
        timestamps: true
    });


articlesSchema.plugin(AutoIncrement, {inc_field: 'human_id'});
const Article = mongoose.model('Article', articlesSchema);
module.exports = Article;