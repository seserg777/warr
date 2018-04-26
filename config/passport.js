const _ = require('lodash');
const passport = require('passport');
const request = require('request');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
const VKontakteStrategy = require('../modules/passport-vkontakte/index').Strategy;
const SteamStrategy = require('passport-steam').Strategy;

const User = require('../models/User');
module.users = {};
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
   // if(!module.users[id]) {
    User.findById(id, (err, user) => {
        //module.users[id]=user;
        done(err, user);
    });
 /*   } else {
        done(null, module.users[id]);
    }*/
});

/**
 * Sign in using Email and Password.
 */
passport.use(new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
    User.findOne({ email: email.toLowerCase() }, (err, user) => {
        if (!user) {
            return done(null, false, { msg: `Неверный email или пароль.` });
        }
        if(user.banned)
            return done(null, false, { msg: 'Вы были заблокированы на этом сайте. Для уточнения информации о причине блокировки вы можете обращаться на почту: support@play4play.ru или в онлайн чат.' });
        if(!user.activated)
                return done(null, false, { msg: 'Почта не подтверждена. Перейдите по ссылке в присланом вам после регистрации письме. <a href="/resend-email">Не пришло письмо?</a>' });
        user.comparePassword(password, (err, isMatch) => {
            if (isMatch) {
                return done(null, user);
            }

            return done(null, false, { msg: 'Неверный email или пароль.', user:user });
        });
    });
}));

/**
 * OAuth Strategy Overview
 *
 * - User is already logged in.
 *     - Check if there is an existing account with a provider id.
 *         - If there is, return an error message. (Account merging not supported)
 *         - Else link new OAuth account with currently logged-in user.
 * - User is not logged in.
 *     - Check if it's a returning user.
 *         - If returning user, sign in and we are done.
 *         - Else check if there is an existing account with user's email.
 *             - If there is, return an error message.
 *             - Else create a new account.
 */

/**
 * Sign in with Facebook.

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_ID,
    clientSecret: process.env.FACEBOOK_SECRET,
    callbackURL: '/auth/facebook/callback',
    profileFields: ['name', 'email', 'link', 'locale', 'timezone'],
    passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
    if (req.user) {
        User.findOne({ facebook: profile.id }, (err, existingUser) => {
            if (existingUser) {
                req.flash('errors', { msg: 'There is already a Facebook account that belongs to you. Sign in with that account or delete it, then link it with your current account.' });
                done(err);
            } else {
                User.findById(req.user.id, (err, user) => {
                    user.facebook = profile.id;
                    user.tokens.push({ kind: 'facebook', accessToken });
                    user.profile.name = user.profile.name || profile.name.givenName + ' ' + profile.name.familyName;
                    user.profile.gender = user.profile.gender || profile._json.gender;
                    user.profile.picture = user.profile.picture || `https://graph.facebook.com/${profile.id}/picture?type=large`;
                    user.save((err) => {
                        req.flash('info', { msg: 'Facebook account has been linked.' });
                        done(err, user);
                    });
                });
            }
        });
    } else {
        User.findOne({ facebook: profile.id }, (err, existingUser) => {
            if (existingUser) {
                return done(null, existingUser);
            }
            User.findOne({ email: profile._json.email }, (err, existingEmailUser) => {
                if (existingEmailUser) {
                    req.flash('errors', { msg: 'There is already an account using this email address. Sign in to that account and link it with Facebook manually from Account Settings.' });
                    done(err);
                } else {
                    const user = new User();
                    user.email = profile._json.email;
                    user.facebook = profile.id;
                    user.tokens.push({ kind: 'facebook', accessToken });
                    user.profile.name = profile.name.givenName + ' ' + profile.name.familyName;
                    user.profile.gender = profile._json.gender;
                    user.profile.picture = `https://graph.facebook.com/${profile.id}/picture?type=large`;
                    user.profile.location = (profile._json.location) ? profile._json.location.name : '';
                    user.save((err) => {
                        done(err, user);
                    });
                }
            });
        });
    }
}));
 */

/**
 * Sign in with Google.
 */
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_ID,
    clientSecret: process.env.GOOGLE_SECRET,
    callbackURL: '/auth/google/callback',
    passReqToCallback: true
}, (req, accessToken, refreshToken, profile, done) => {
    if (req.user) {
        User.findOne({ google: profile.id }, (err, existingUser) => {
            if (existingUser) {
                req.flash('errors', { msg: 'В системе уже существует аккаунт подключённый к этому Google.' });
                done(err);
            } else {
                User.findById(req.user.id, (err, user) => {
                    user.google = profile.id;
                    user.tokens.push({ kind: 'google', accessToken });
                    user.profile.name = user.profile.name || profile.displayName;
                    user.profile.gender = user.profile.gender || profile._json.gender;
                    user.profile.picture = user.profile.picture || profile._json.image.url;
                    user.save((err) => {
                        req.flash('info', { msg: 'Google аккаунт полдключен.' });
                        done(err, user);
                    });
                });
            }
        });
    } else {
        User.findOne({ google: profile.id }, (err, existingUser) => {
            if (existingUser) {
                return done(null, existingUser);
            }
            User.findOne({ email: profile.emails[0].value }, (err, existingEmailUser) => {
                if (existingEmailUser) {
                    req.flash('errors', { msg: 'В системе существует аккаунт с такиим email. Для возможности входа через Google подключите эту возможность в настройках аккаунта.' });
                    done(err);
                } else {
                    req.session.socialReg = true;
                    req.session.accessToken = accessToken;
                    req.session.profileId= profile.id;
                    req.session.profileEmail = profile.emails[0].value;
                    req.session.profileLink = profile._json.url;
                    req.session.profilePhoto = profile._json.image.url || '';
                    req.session.profileName = profile._json.nickname || profile.displayName;
                    req.session.profileProvider = 'google';
                    done(null,false);
                }
            });
        });
    }
}));

/**
 * Sign in with VK.
 */
passport.use(new VKontakteStrategy({
            clientID:         process.env.VK_CLIENT_ID, // VK.com docs call it 'API ID', 'app_id', 'api_id', 'client_id' or 'apiId'
            clientSecret: process.env.VK_APP_SECRET,
            callbackURL:    "/auth/vkontakte/callback",

            passReqToCallback: true
        },
        function(req, accessToken, refreshToken, params, profile, done) {

            req.session.ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            if (req.user) {
                User.findOne({ vkontakte: profile.id }, (err, existingUser) => {
                    if (existingUser) {
                        req.flash('errors', { msg: 'В системе уже существует аккаунт подключенный к этой страницы VK.' });
                        done(err);
                    } else {
                        User.findById(req.user.id, (err, user) => {
                            user.vkontakte = profile.id;
                            user.tokens.push({ kind: 'vkontakte', accessToken });
                            user.profile.name = user.profile.name || profile.displayName;
                            user.profile.gender = user.profile.gender || profile.gender;
                            user.profile.picture = user.profile.picture || profile._json.photo;
                            user.save((err) => {
                                req.flash('info', { msg: 'Вход через VK подключён к вашему аккаунту.' });
                                done(err, user);
                            });
                        });
                    }
                });
            } else {
                User.findOne({ vkontakte: profile.id }, (err, existingUser) => {
                    if (existingUser) {

                        if(existingUser.banned) {
                            req.flash('errors', {msg: 'Вы были заблокированы на этом сайте. Для уточнения информации о причине блокировки вы можете обращаться на почту: support@play4play.ru или в онлайн чат.'});
                            return done(null, false, {msg: 'Вы были заблокированы на этом сайте.'});
                        }
                        if(existingUser.otp.enabled) {
                            req.session.needOTP = true;
                            req.session.userOTP = existingUser._id;
                            return done(null, false, {msg: 'Вам нужно ввести код сайта.'});
                        }

                        return done(null, existingUser);

                    } else {
                        if (params.email) {
                            User.findOne({email: params.email}, (err, existingEmailUser) => {
                                if (existingEmailUser) {
                                    req.flash('errors', {msg: 'В системе существует аккаунт с такиим email. Для возможности входа через VK подключите эту возможность в настройках аккаунта.'});
                                    done(err);
                                } else {
                                    req.session.socialReg = true;
                                    req.session.accessToken = accessToken;
                                    req.session.profileId = profile.id;
                                    req.session.profileEmail = params.email;
                                    req.session.profileLink = profile.profileUrl;
                                    req.session.profilePhoto = profile._json.photo || '';
                                    req.session.profileName = profile.displayName;
                                    req.session.profileProvider = 'vkontakte';
                                    done(null, false);

                                }
                            });
                        } else {
                            req.session.socialReg = true;
                            req.session.accessToken = accessToken;
                            req.session.profileId = profile.id;
                            req.session.profileEmail = "";
                            req.session.profileLink = profile.profileUrl;
                            req.session.profilePhoto = profile._json.photo || '';
                            req.session.profileName = profile.displayName;
                            req.session.profileProvider = 'vkontakte';
                            done(null, false);
                        }
                    }
                });

            }



        }
));

/**
 * Steam API OpenID.
 */
passport.use(new SteamStrategy({
    apiKey: process.env.STEAM_KEY,
    returnURL: 'http://localhost:3000/auth/steam/callback',
    realm: 'http://localhost:3000/',
    stateless: true ,
    passReqToCallback: true
}, (req, identifier, profile, done) => {
    User.findOne({ steam: profile._json.steamid }, (err, existingUser) => {
        if (existingUser) return done(err, existingUser);

                req.session.socialReg = true;
                req.session.accessToken = profile._json.steamid;
                req.session.profileId= profile._json.steamid;
                req.session.profileEmail = "";
                req.session.profileLink =    profile._json.profileurl;
                req.session.profilePhoto = profile._json.avatarmedium || '';
                req.session.profileName = profile._json.personaname;
                req.session.profileProvider = 'steam';
                done(null,false);

    });

}));

/**
 * Login Required middleware.
 */
exports.isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
};

/**
 * Login Required middleware.
 */
exports.isAdmin = (req, res, next) => {
    if(req.isAuthenticated() && req.user.isAdmin) {
        return next();
    }
    res.redirect('/');
};


exports.partnerEnabled = (req, res, next) => {
        if(req.isAuthenticated() && req.user.referral.enabled) {
                return next();
        }
        res.redirect('/');
};

/**
 * Authorization Required middleware.
 */
exports.isAuthorized = (req, res, next) => {
    const provider = req.path.split('/').slice(-1)[0];

    if (_.find(req.user.tokens, { kind: provider })) {
        next();
    } else {
        res.redirect(`/auth/${provider}`);
    }
};
