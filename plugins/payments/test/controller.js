

exports.exec = (req, res, system) => {
    res.render(system.pay_system_setting_view,{
        title:"Настройки тестовые",
        adminPage:res.app.get('adminPage'),
        menuCode: 503,
        ps: system,
    });
};