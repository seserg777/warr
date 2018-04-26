const User = require('../../../models/User');



exports.pay = (res, req, next, order) => {


    req.flash('errors',{msg: "Недостаточно средств на счету Play4Pay!"});
    res.redirect('/');
};