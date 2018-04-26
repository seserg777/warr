'use strict';
const moment = require('moment');
const Game = require('../models/Game');
const Blog = require('../models/Article');
/**
 * GET /
 * Home page.
 */
exports.index = (req, res) => {
     Game.find().sort({'title':1}).cache().exec((err, _games) => {
        if(err) return next(err);
        Blog.find().limit(4).sort('-human_id').select('human_id body_main_page title createdAt').cache().exec((err, _blogs) => {
            if(err) return next(err);


            let blogs = _blogs.map(o => o.toObject());
            for(let i in  blogs) {
                blogs[i]['hdate'] = moment(blogs[i].createdAt).format('DD MMMM, HH:mm');

            }


            res.render('home', {
                games: _games,
                blogs: blogs,
                menuCode: 103
            });
        });

    });
};
