const User = require('../models/User');

module.users_last_activity = {};

module.exports.lastLogin = function(_id) {
    module.users_last_activity[_id] = new Date();
};

module.worker = function () {
    for(let _id in module.users_last_activity) {
        if(module.users_last_activity.hasOwnProperty(_id)) {

            User.findByIdAndUpdate({_id:_id},{
                lastActive: module.users_last_activity[_id]
            }, { new: false }).exec();
            if(module.users_last_activity[_id].getTime() < (new Date().getTime() + 30000))
                delete module.users_last_activity[_id];
        }
    }
};

setInterval(module.worker,30000);