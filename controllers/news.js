'use strict';
const Article = require('../models/Article');
const moment = require('moment');


exports.index = async (req, res, next) => {
    try {
        let News = await  Article.find().sort({human_id: -1}).exec();
        let blogs = News.map(o => o.toObject());
        for(let i in  blogs) {
            blogs[i]['hdate'] = moment(News[i].createdAt).format('DD MMMM, HH:mm');

        }
        console.log(blogs);
        //console.log(News);
        res.render('articles/index', {
            articles: blogs,
            page: 0,
            title: 'Блог',
            menuCode: 108
        })

    } catch (e) {

    }
};

exports.read = async (req, res, next) => {
    try {
        let entry = await  Article.findOne({human_id:req.params.id});

        if(!entry) throw new Error('notfound');

        res.render('articles/article', {
            entry: entry,
            page: 0,
            title: 'Блог',
            menuCode: 108
        })
    } catch (e) {
        res.redirect('/blog');
    }
};

exports.add = async (req, res, next) => {
    try {
        let human_id = null;
        let editArticle;
        if(req.params.id) {
            editArticle = await Article.findOne({human_id: req.params.id});
            human_id = editArticle.human_id;
        }


        res.render('articles/post', {
            article: editArticle,
            human_id: human_id,
            page: 0,
            title: human_id ?'Изменить новость':  'Добавить новость',
            menuCode: 108
        })
    } catch (e) {

    }
};

exports.post = async (req, res, next) => {
    try {
        if(!req.body.blog_title || !req.body.description) throw new Error('Нельзя отправлять пустое содержимое! ');

        let newArticle;

        if(req.body.human_id)
            newArticle =  await Article.findOne({human_id:parseInt(req.body.human_id)});
        else
            newArticle = new Article();

        newArticle.title =  req.body.blog_title.trim();
        newArticle.body =  req.body.description;
        newArticle.body_main_page = req.body.main_page_description;
        newArticle.body_short = req.body.short_description;

        await newArticle.save();

        res.redirect('/blog/'+newArticle.human_id);
    } catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect('/blog');
    }
};


exports.delete = async (req, res, next) => {
    try {
        if(!req.params.id) throw new Error('Нельзя отправлять пустое содержимое! ');
        await Article.remove({human_id:parseInt(req.params.id)});
        req.flash('info', {msg: "Блог был удалён!"});
        res.redirect('/blog/'+newArticle.human_id);
    } catch (e) {
        req.flash('errors', {msg: e.message});
        res.redirect('/blog');
    }
};