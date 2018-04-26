(function (d, w, c) {
    (w[c] = w[c] || []).push(function() {
        try {
            w.yaCounter46549293 = new Ya.Metrika({
                id:46549293,
                clickmap:true,
                trackLinks:true,
                accurateTrackBounce:true,
                webvisor:true
            });
        } catch(e) { }
    });

    var n = d.getElementsByTagName("script")[0],
        s = d.createElement("script"),
        f = function () { n.parentNode.insertBefore(s, n); };
    s.type = "text/javascript";
    s.async = true;
    s.src = "https://mc.yandex.ru/metrika/watch.js";

    if (w.opera == "[object Opera]") {
        d.addEventListener("DOMContentLoaded", f, false);
    } else { f(); }
})(document, window, "yandex_metrika_callbacks");

var Switchery = function(none){};
var $switch = $('.js-switch');

var postDeleteMessage = function(id) {
    if($('#'+id).length > 0) {
        $('#'+id).remove();
    }
};

if($switch.length>0) {
    $switch.each(function (x, elm) {
        new Switchery(elm)
    });
    $switch.each(function (x, elm) {
        $(elm).on('change', function (ev) {
            $(elm).parent().parent().find('input').each(function (j, input) {
                $(input).attr('required', $(elm).prop('checked'));
            });
        });
    });
}
var $pmswitch = $('.payment-accept-switch');
if($pmswitch.length>0) {
    $pmswitch.each(function (x, elm) {
        new Switchery(elm)
    });
    $pmswitch.each(function (x, elm) {
        $(elm).on('change', function (ev) {

            $.ajax({
                type: 'POST',
                url: '/account/balance/accept',
                dataType: 'json',
                contentType: 'application/json',
                data: JSON.stringify({for: $(this).attr('id'), status: $(elm).prop('checked'),  _csrf: $('meta[name="csrf-token"]').attr('content')}),
                success: function (data) {
                    if(data.errors && data.errors > 0) {
                        sweetAlert("Опа...", data.message, "error");
                    }

                }
            });
        });
    });
}
function confirmDelete(from) {
    swal({
        //title: 'Удалить?',
        text: "Вы уверены что хотите удалить это предложение?",
        type: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Удалить',
        cancelButtonText: 'Отмена'
    }).then(function () {
        $(from).parent().parent().submit();
    });
    console.log();
}
var phoneExt,phone;
var recaptcha;
function makeVerifySwal() {
    swal({
        title: 'Подтвердите что вы не робот!',
        html:
        '<form id="phoneForm" class="form-horizontal"><div class="form-group"><label class="col-xs-4 control-label">Ваш номер:</label><div class="col-xs-6"><input type="tel" class="form-control" name="phoneNumber" /></div></div>'+
        '<div id="recptcha2" class="g-recaptcha" data-sitekey="6Lcj6B8UAAAAABHzhbZwkiUEJT_TgkSf0FclMTMD"></div></form>',

        confirmButtonText: 'Подтверждаю!',
        cancelButtonText: 'Отмена',
        showCancelButton: false,
        showLoaderOnConfirm: true,
        preConfirm: function (data) {
            return new Promise(function (resolve, reject) {
                $.ajax({
                    type: 'POST',
                    url: '/rules',
                    dataType: 'json',
                    contentType: 'application/json',
                    data: JSON.stringify({
                        'g-recaptcha-response': $('textarea[id^="g-recaptcha-response"]').val(),
                        phone: $('[name="phoneNumber"]').intlTelInput("getNumber"),
                        _csrf: $('meta[name="csrf-token"]').attr('content')
                    }),
                    success: function (data) {
                        if (data.errors && data.errors > 0) {
                            reject('Попробуйте ещё раз.')
                        } else {
                            // location.href=result.redirect || "/";
                            recaptcha = $('#g-recaptcha-response').val();
                            phone = $('[name="phoneNumber"]').intlTelInput("getNumber");
                            resolve()
                        }
                    },
                    timeout: function (data) {
                        reject('Сервер не отвечает.')
                    }
                });
            })
        },
        onOpen: function() {
            phoneExt = $('#phoneForm')
                .find('[name="phoneNumber"]')
                .intlTelInput({
                    utilsScript: '/js/lib/utils.js',
                    autoPlaceholder: true,
                    formatOnDisplay: true,
                    nationalMode: false,
                    preferredCountries: ['ru', 'ua', 'by', 'kz', 'lt'],
                    customPlaceholder: function(selectedCountryPlaceholder, selectedCountryData) {
                        $('#phoneForm')
                            .find('[name="phoneNumber"]')
                            .mask(selectedCountryPlaceholder.replace( /\d/g, "9" ));
                        return selectedCountryPlaceholder;
                    }
                });
        },
        allowOutsideClick: false
    }).then(function() {
        swal({
            title: 'Введите код присланый вам в сообшении!',
            confirmButtonText: 'Отправить',
            cancelButtonText: 'Изменить номер',
            confirmButtonClass: 'btn btn-success',
            cancelButtonClass: 'btn btn-danger',
            showCancelButton: true,
            showLoaderOnConfirm: true,
            html: '<p>В течении 2х минут на указанный вами номер прийдет сообщение с кодом.</p><form id="smsCodeForm" class="form-horizontal"><div class="form-group"><label class="col-xs-4 control-label">Код:</label><div class="col-xs-6"><input type="number" class="form-control" name="smsCode" /></div></div></form>',
            preConfirm: function (data) {
                return new Promise(function (resolve, reject) {
                    $.ajax({
                        type: 'POST',
                        url: '/check-code',
                        dataType: 'json',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            'g-recaptcha-response': recaptcha,
                            phone: phone,
                            code: $('input[name="smsCode"]').val(),
                            _csrf: $('meta[name="csrf-token"]').attr('content')
                        }),
                        success: function (data) {
                            if (data.errors && data.errors > 0) {
                                if(data.goBack) {
                                    resolve();
                                    makeVerifySwal();
                                } else {
                                    reject(data.message)
                                }
                            } else {
                                location.href=data.redirect || "/";
                                resolve();
                            }
                        },
                        timeout: function (data) {
                            reject('Сервер не отвечает.')
                        }
                    });
                })
            },
        }).then(null, function (dismiss) {

            if (dismiss === 'cancel') {
                makeVerifySwal();

            }
        });


    });


    grecaptcha.render('recptcha2',{
        'sitekey' : '6Lcj6B8UAAAAABHzhbZwkiUEJT_TgkSf0FclMTMD'
    });

}


$(document).ready(function() {

    if($('.wating-for-payment-system').length> 0) {
        setTimeout(function() {
            location.reload();
        },5000);
    }
    if($('#push-lots').length > 0) {
        var $pushLots = $('#push-lots');
        $pushLots.on('click',function() {

            $.ajax({
                type: 'POST',
                url: $pushLots.data('url'),
                data: {_csrf: $('meta[name="csrf-token"]').attr('content')},
                success: function (data) {
                    if(data.errors && data.errors > 0) {
                        sweetAlert("Опа...", data.message, "error");
                    } else {
                        sweetAlert(
                            'Успешно!',
                            data.message,
                            'success'
                        )
                    }
                }
            });
        });
    }
    if($('.comission-calc').length > 0) {
        var $calc =$('.comission-calc');
        $calc.each(function(idx, elm) {
            $(elm).on('click', function () {
                var price = parseFloat($(elm).parent().parent().find('.price').val().replace(',', ''));
                if(!isNaN(price)) {
                    $(".modal-body").load('/chips/'+$(elm).data('cp')+'/price?price='+price);
                }
                console.log(price);
            });
        });
    }
    if($('#btn-ref-widthraw').length > 0) {
        $('#btn-ref-widthraw').on('click', function () {
            if($('#ref-withdrawl-ps').val() === 'x') {
                swal( 'Стоп', 'Выберите кошелек для вывода.', 'error');
            } else {
                $.ajax({
                    type: 'GET',
                    url: '/account/partner/withdraw?ps='+$('#ref-withdrawl-ps').val(),
                    success: function (data) {
                        if(data && 'errors' in data && data.errors===0) {
                            swal( 'Успешно', 'Ваша заявка будет обработана в течении 24 часов.', 'success');
                            $('#ref-balance').text('0.00');
                        } else if(data && data.errors && data.message) {
                            swal( 'Ошибка', data.message, 'error');
                        }
                    }
                });
            }
        });
    }
    if($('.withdrawal-page').length >0) {
        $('[data-toggle="ajaxModal"]').on('click',
            function(e) {
                $('#ajaxModal').remove();
                e.preventDefault();
                var $this = $(this)
                    , $remote = $this.data('remote') || $this.attr('href')
                    , $modal = $('<div class="modal" id="ajaxModal"><div class="modal-body"></div></div>');
                $('body').append($modal);
                $modal.modal({backdrop: 'static', keyboard: false});
                $modal.load($remote);
            }
        );
    }

    $('.offer-row').click(function() {
        document.location = $(this).data('link');
    });

    if($("#play4play-balance-tooltip").length > 0) {
        $('#play4play-balance-tooltip').tooltip();
    }

    if($('#lot-results-table').length>0) {
        var params = {};
        var changed = function() {
            $.ajax({
                type: 'GET',
                url: window.location.pathname+'?'+$.param(params),
                success: function(data) {
                    $('#lot-results-table').parent().html(data).promise().done(function () {
                        $('.offer-row').click(function() {
                            document.location = $(this).data('link');
                        });
                    });
                }
            })
        };

        $('.sort-field').each(function(idx, element) {
            var $elm = $(element);
            $elm.change(function() {
               var $this = $(this);
               //console.log($this.attr('type'));
               if($this.attr('type') == "checkbox") {
                   if($this.prop('checked')) {
                       params[$this.data('name')] = "1";
                   } else {
                       delete params[$this.data('name')];
                   }
               } else {
                   if ($this.val() != "")
                       params[$this.data('name')] = $this.val();
                   else
                       delete params[$this.data('name')];
               }
               console.log($.param(params));
                changed();
               //console.log(params);
            });
        });
    }

    if($('#results-table').length>0) {
        $onlineOnly = $('#onlineOnly');
        $server = $('#server');
        $side = $('#side');
        $offerRow = $('.offer-row');
        
        var changed = function() {
            var onlineOnly = $onlineOnly.is(":checked") || false;
            var server = $server.val() || '';
            var side = $side.val() || '';

            $.ajax({
                type: 'GET',
                url: window.location.pathname+'?'+'server='+server+'&side='+side+'&onlineOnly='+onlineOnly,
                success: function(data) {
                    $('#results-table').parent().html(data).promise().done(function () {
                        $('.offer-row').click(function() {
                            document.location = $(this).data('link');
                        });
                    });

                }
            })
        };
        $offerRow.click(function() {
            document.location = $(this).data('link');
        });
        if($onlineOnly.length == 1 )
            $onlineOnly.change(function() {
                changed();
            });
        if($server.length == 1 )
            $server.change(function() {
                changed();
            });

        if($side.length == 1 )
            $side.change(function() {
                changed();
            });

    }

    if($('#smd').length > 0) {
        var $smd = $('#smd');
        $smd.on('click', function(){
            $.ajax({
                type: 'POST',
                url: $smd.data('post'),
                data: {message: $('#comment-text').val(), _csrf: $('meta[name="csrf-token"]').attr('content')},
                success: function (data) {
                    if(data.errors && data.errors > 0) {
                        sweetAlert("Опа...", data.message, "error");
                    } else {
                        sweetAlert(
                            'Спасибо!',
                            data.message,
                            'success'
                        )
                    }
                }
            });
        });

    }
    if($("#logout").length > 0 ) {
        $("#logout").click(function () {
            swal({
                title: 'Выход с сайта',
                text: "Вы уверены что хотите выйти с сайта?",
                type: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Да!',
                cancelButtonText: 'Отмена'
            }).then(function () {
                window.location.href = "/logout";
            })
        })
    }
    if($('#go-test').length>0) {
        $('#go-test').on('click', function(ev) {
            swal.setDefaults({
                input: 'text',
                confirmButtonText: 'Далее &rarr;',
                cancelButtonText: 'Отмена',
                showCancelButton: true,
                animation: false,
                progressSteps: ['1', '2', '3', '4']
            });
            var inputOptions1 = new Promise(function (resolve) {

                resolve({
                    '1': 'Никаких санкций не последует, действие разрешено.',
                    '2': 'Мой аккаунт Play4Pay будет заблокирован.',
                    '3': 'Никаких санкций не последует, потому что никто об этом не узнает.'
                })

            });
            var inputOptions2 = new Promise(function (resolve) {

                resolve({
                    '1': 'Никаких санкций не последует, действие разрешено.',
                    '2': 'Никаких санкций не последует, потому что никто об этом не узнает.',
                    '3': 'Мой аккаунт Play4Pay будет заблокирован.'
                })

            });
            var inputOptions3 = new Promise(function (resolve) {

                resolve({
                    '1': 'Выполню заказ как можно быстрее и обеспечу тем самым высокий уровень сервиса. Покупатель не должен ждать!',
                    '2': 'Открою раздел «Мои продажи» и проверю, действительно ли покупатель оплатил заказ. После этого приступлю к выполнению заказа.',
                    '3': 'Свяжусь со службой поддержки Play4Pay, сообщу консультанту о новом заказе и буду ждать дальнейших указаний.'
                })

            });
            var inputOptions4 = new Promise(function (resolve) {

                resolve({
                    '1': 'Никаких санкций не последует, действие разрешено.',
                    '2': 'Мой аккаунт Play4Pay будет заблокирован.',
                    '3': 'Удаление всех отзывов. Блокировка аккаунта при повторном нарушении.'
                })

            });

            var steps = [
                {
                    text: 'Покупателю было крайне неудобно общаться с вами в чате Play4Pay, и, исключительно для удобства, он предложил вам перейти в Skype. Вы согласились.',
                    input: 'radio',
                    width: 600,
                    inputOptions: inputOptions1,
                    inputValidator: function (result) {
                        return new Promise(function (resolve, reject) {
                            if (result && result === '2') {
                                resolve()
                            } else {
                                reject('Неверный ответ!')
                            }
                        })
                    }
                },
                {
                    text: 'Покупатель оплатил заказ через Play4Pay, вы его выполнили. В процессе выполнения заказа покупатель узнал ваш ник. Через некоторое время он написал вам и попросил продать что-либо или оказать услугу без проведения платежа через Play4Pay. Вы согласились.',
                    input: 'radio',
                    width: 600,
                    inputOptions: inputOptions2,
                    inputValidator: function (result) {
                        return new Promise(function (resolve, reject) {
                            if (result && result === '3') {
                                resolve()
                            } else {
                                reject('Неверный ответ!')
                            }
                        })
                    }
                },
                {
                    text: 'Вы увидели в чате сообщение о том, что покупатель оплатил заказ.',
                    input: 'radio',
                    width: 600,
                    inputOptions: inputOptions3,
                    inputValidator: function (result) {
                        return new Promise(function (resolve, reject) {
                            if (result && result === '2') {
                                resolve()
                            } else {
                                reject('Неверный ответ!')
                            }
                        })
                    }
                },
                {
                    text: 'Вы решили для быстрого привлечения покупателей накруть себе отзывы.',
                    input: 'radio',
                    width: 600,
                    inputOptions: inputOptions4,
                    inputValidator: function (result) {
                        return new Promise(function (resolve, reject) {
                            if (result && result === '3') {
                                resolve()
                            } else {
                                reject('Неверный ответ!')
                            }
                        })
                    }
                }
            ];

            swal.queue(steps).then(function (result) {
                swal.resetDefaults();

                makeVerifySwal();

            }, function () {

                swal.resetDefaults()
            })
        });
    }

    if($('#offer-form').length>0){
        $paymentSelect = $('#payment-method');
        $selectedPayment = $paymentSelect.find(':selected');
        $iPay = $('#ipay');
        $iRecive = $('#irecive');
        $vaultSufix = $('#vault-sufix');
        var price = $selectedPayment.data('price');
        var currency = $selectedPayment.data('currency');
        var lastchange = 'sum';
        $vaultSufix.text(currency);
        //console.log("hello world! price"+price);
        $paymentSelect.on('change', function() {
            $selectedPayment = $paymentSelect.find(':selected');
            price = $selectedPayment.data('price');
            currency = $selectedPayment.data('currency');

            if(lastchange == 'sum') {
                if($iPay.val().trim() !== "" && $iPay.val() !== '0.00' && $iPay.val() !== '0')
                    $iRecive.val((parseFloat($iPay.val()) / price).toFixed(2));

            } else {
                if($iRecive.val().trim() !== "" && $iRecive.val() !== '0.00')
                    $iPay.val((parseFloat($iRecive.val())  * price).toFixed(2));
            }
            $vaultSufix.text(currency);
        });
        $iRecive.val((parseFloat($iPay.val()) / price).toFixed(2));
        $iPay.on('keyup keydown change', function() {

            if($iPay.val().trim() !== "")
                $iRecive.val((parseFloat($iPay.val()) / price).toFixed(2));
            lastchange = 'sum';
        });

        $iRecive.on('keyup keydown change', function() {
            if($iRecive.val().trim() !== "")
                $iPay.val((parseFloat($iRecive.val())  * price).toFixed(2));
            lastchange = 'currency';
        });
    }

    $('.floatval').keypress(function(eve) {
        var element = $(this)
            element.data("oldValue", '')
            .bind("paste", function(e) {
                var validNumber = /^[-]?\d+(\.\d{1,2})?$/;
                element.data('oldValue', element.val())
                setTimeout(function() {
                    if (!validNumber.test(element.val()))
                        element.val(element.data('oldValue'));
                }, 0);
            });
        element
            .keypress(function(event) {
                var text = $(this).val();
                if ((event.which != 46 || text.indexOf('.') != -1) && //if the keypress is not a . or there is already a decimal point
                    ((event.which < 48 || event.which > 57) && //and you try to enter something that isn't a number
                    (event.which != 45 || (element[0].selectionStart != 0 || text.indexOf('-') != -1)) && //and the keypress is not a -, or the cursor is not at the beginning, or there is already a -
                    (event.which != 0 && event.which != 8))) { //and the keypress is not a backspace or arrow key (in FF)
                    event.preventDefault(); //cancel the keypress
                }

                if ((text.indexOf('.') != -1) && (text.substring(text.indexOf('.')).length > 2) && //if there is a decimal point, and there are more than two digits after the decimal point
                    ((element[0].selectionStart - element[0].selectionEnd) == 0) && //and no part of the input is selected
                    (element[0].selectionStart >= element.val().length - 2) && //and the cursor is to the right of the decimal point
                    (event.which != 45 || (element[0].selectionStart != 0 || text.indexOf('-') != -1)) && //and the keypress is not a -, or the cursor is not at the beginning, or there is already a -
                    (event.which != 0 && event.which != 8)) { //and the keypress is not a backspace or arrow key (in FF)
                    event.preventDefault(); //cancel the keypress
                }
            });
    });

    $('.number').number( true, 2 );
    $('.number-3').number( true, 3 );
        // allows 123. or .123 which are fine for entering on a MySQL decimal() or float() field

    if(typeof firebase !== "undefined") {
        var app = firebase.initializeApp({
            apiKey: 'AIzaSyDbZQtDXaZKDCFa0BIMxAoqbaqhnMDhWbQ',
            messagingSenderId: '579459198113'
        });
        var messaging = app.messaging();
        messaging.onTokenRefresh(function() {
            messaging.getToken()
                .then(function(refreshedToken) {
                    console.log('Token refreshed.');
                    // Indicate that the new Instance ID token has not yet been sent to the
                    // app server.
                    setTokenSentToServer(false);
                    // Send Instance ID token to app server.
                    sendTokenToServer(refreshedToken);
                    // [START_EXCLUDE]
                    // Display new Instance ID token and clear UI of all previous messages.
                    console.log(refreshedToken);
                    // [END_EXCLUDE]
                })
                .catch(function(err) {
                    console.log('Unable to retrieve refreshed token ', err);
                    showToken('Unable to retrieve refreshed token ', err);
                });
        });


        var $switch = $('.notify-switch');
        if($switch.length>0) {
            $switch.each(function (x, elm) {
                new Switchery(elm)
            });
            $switch.each(function (x, elm) {
                $(elm).on('change', function (ev) {

                    $.ajax({
                        type: 'POST',
                        url: '/account/notification-enable',
                        dataType: 'json',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            status: $(elm).prop('checked'),
                            property: $(elm).attr('id'),
                            _csrf: $('meta[name="csrf-token"]').attr('content')
                        }),
                        success: function (data) {
                            if (data.errors && data.errors > 0) {
                                sweetAlert("Опа...", data.message, "error");
                            }
                        }
                    });

                });
            });
        }

        var $addDevice = $('#add-device');
        $addDevice.on('click', function (x, elm) {
            messaging.requestPermission()
                .then(function () {
                    messaging.getToken().then(function (token) {
                        swal('Успешно добавлено');
                        $.ajax({
                            type: 'POST',
                            url: '/account/notification-add-device',
                            dataType: 'json',
                            contentType: 'application/json',
                            data: JSON.stringify({
                                token: token,
                                _csrf: $('meta[name="csrf-token"]').attr('content')
                            }),
                            success: function (data) {
                                if (data.errors && data.errors > 0) {
                                    sweetAlert("Опа...", data.message, "error");
                                }
                            }
                        });
                    }).catch(function (er) {
                        swal("Опа...", er.message, "error");
                        console.error(1111111,er);
                    });
                }).catch(function (er) {
                    swal("Опа...", "Вы заблокировали уведомления на этом сайте. Сначала вам следует убрать наш сайт из списка заблокированных в настройках браузера.", "error");
                    //console.error(er.message);
                });
        })
    }
});


$(".recive-confirm").submit(function (e) {
    e.preventDefault();
    swal({
        title: "Внимание!",
        text: "",
        type: "warning",
        showCancelButton: true,
        confirmButtonColor: "#19ab19",
        confirmButtonText: 'Я согласен, передать деньги',

        cancelButtonText: 'Отмена',
        html: "Отправлять деньги продавцу необходимо исключительно после выполнения продавцом всех обязательств по вашему заказу. <strong>Мы уже не сможем вернуть их!</strong>"
    }).then( function(){
        $(".recive-confirm").off("submit").submit();
    });
});