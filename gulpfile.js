'use strict';
/*
npm install --save-dev  \
  gulp  \
  node-sass \
  gulp-sass \
  compass-mixins  \
  bootstrap-sass  \
  gulp-autoprefixer \
  gulp-minify-css \
  gulp-sourcemaps
*/

// load plugins
var gulp = require('gulp'),
    sass = require('gulp-sass'),
    autoprefixer = require('gulp-autoprefixer'),
    minify_css = require('gulp-minify-css'),
    concat = require('gulp-concat'),
    sourcemaps = require('gulp-sourcemaps'),
    uglify = require('gulp-uglify'),
    path = require('path');

const scripts = [
    './assets/js/main.js',
    './assets/js/chat.js',
];
const libs = [
    './node_modules/jquery/dist/jquery.js',
    './node_modules/popper.js/dist/umd/popper.js',
    './node_modules/jquery-mask-plugin/src/jquery.mask.js',
    './node_modules/sweetalert2/dist/sweetalert2.js',
    './node_modules/jquery-number/jquery.number.js',

    './node_modules/bootstrap/dist/js/bootstrap.js',
    './node_modules/intl-tel-input/build/js/intlTelInput.js',
//    './assets/libs/mdb/js/mdb.js',

  //  './node_modules/intl-tel-input/build/js/utils.js',

];
let copy_list = [
    {from: './node_modules/intl-tel-input/build/img/', to: 'public/images/', filter:'*.png'},
    {from: './node_modules/font-awesome/fonts/', to: 'public/fonts/', filter:'fontawesome-webfont.*'},
    {from: './assets/libs/mdb/font/roboto/', to: 'public/fonts/roboto/', filter:'*'},
    {from: './assets/js/game/', to: 'public/js/game/', filter:'*'},
    {from: './assets/js/pages/', to: 'public/js/pages/', filter:'*'},

];

gulp.task('files', ()=> {
    for(let element of copy_list){
        console.log(element);
        gulp.src(element.from + element.filter)
            .pipe(gulp.dest(element.to));
    }
});

gulp.task('libjs', () => {
    gulp.src(libs)
        .pipe(sourcemaps.init())
        .pipe(uglify()).on('error', function(err) {
        console.error('Error in compress task', err.toString());
    })
        .pipe(concat('lib.min.js'))
        .pipe(sourcemaps.write('maps'))
        .pipe(gulp.dest("public/js"));

});
gulp.task('myjs', () => {
    gulp.src(scripts)
        .pipe(sourcemaps.init())
        .pipe(uglify()).on('error', function(err) {
        console.error('Error in compress task', err.toString());
    })
        .pipe(concat('main.min.js'))
        .pipe(sourcemaps.write('maps'))
        .pipe(gulp.dest("public/js"));

    gulp.src([
        './assets/js/admin.js',
        './node_modules/select2/dist/js/select2.js',
        './node_modules/datatables.net/js/jquery.dataTables.js',
        './node_modules/datatables.net-bs4/js/dataTables.bootstrap4.js'
    ])
        .pipe(sourcemaps.init())
        .pipe(uglify()).on('error', function(err) {
        console.error('Error in compress task', err.toString());
    })
        .pipe(concat('fFjbJie29fkllf.min.js'))
        .pipe(sourcemaps.write('maps'))
        .pipe(gulp.dest("public/js"));



});

gulp.task('sass', function () {
    gulp.src(["assets/scss/main.scss","assets/scss/error.scss"])
        .pipe(sourcemaps.init())
        .pipe(sass({includePaths: ['./node_modules/bootstrap/scss/']}).on('error', sass.logError))

        // https://github.com/ai/browserslist
        .pipe(autoprefixer("last 2 version", "> 1%", "Explorer > 9", {
            cascade: true
        }))

        .pipe(minify_css({compatibility: 'ie9'}))
        .pipe(sourcemaps.write('maps'))
        .pipe(gulp.dest("public/newcss"));
});


//watch
gulp.task('live', function () {
    //watch .sass files
    gulp.watch("assets/scss/*.scss", ['sass']);
    gulp.watch("assets/js/*", ['myjs']);
});

gulp.task('default', ['files','sass','libjs', 'myjs','live']);