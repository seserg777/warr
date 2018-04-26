function deleteMessg(from) {
    var $message = $(from).parent().parent().parent();
    socket.emit('remove-main', $message.attr('id'));
    //$message.remove();

}
var postDeleteMessage = function(id) {
    if($('#'+id).length > 0) {
        $('#'+id).addClass('text-muted');
        $('#'+id).find('.adminDelete').remove();
    }
};

$(document).ready(function() {
    "use strict";

    if($("#delete-blog").length > 0 ) {
        $("#delete-blog").click(function () {
            swal({
                title: 'Удалить этот блог',
                text: "Точно удаляем эту новость?",
                type: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Так точно!',
                cancelButtonText: 'Отмена'
            }).then(function () {
                window.location.href = "/blog/del/"+$("#delete-blog").data('humanid');
            })
        })
    }
    if($('#summernote31').length > 0 && $('#summernote31').summernote)
        $('#summernote31').summernote({height: 200});


    if($('#users-table').length > 0) {
        // let's assume that the client page, once rendered, knows what room it wants to join

        socket.on('connect', function() {
            // Connected, let's sign-up for to receive messages for this room
            socket.emit('admin', "profit-stats");
        });


        var table = $('#users-table').DataTable({
            "processing": true,
            "serverSide": true,
            "ajax": {
                "url": location.pathname,
                "type": "POST",
                "data": {_csrf:$('meta[name="csrf-token"]').attr('content')}
            },
            "columns": [
                { "data": "username" },
                { "data": "email" },
                { "data": "updatedAt",
                    "render":
                        function( data, type, row, meta){
                            return  moment(new Date(data)).format("HH:mm DD.MM.YYYY");
                        }
                },
                { "data": "status" },
                { "data": "phone.number" },
                { "data": "balances.webmoney" },
                { "data": "balances.yandex" },
                { "data": "balances.qiwi" },
                { "data": "deals_count" },
                { "data": "saleSum" },
                { "data": "button" },
            ], "language": {
                "search": "Поиск: ",
                "paginate": {
                    "first": "Первая",
                    "last": "Последняя",
                    "next": "Следущая",
                    "previous": "Предыдущая"
                },
                "processing": "Загрузка данных",
                "loadingRecords": "Идёт загрузка данных...",
                "lengthMenu": "Показать _MENU_ записей",
                "info": "Показано с _START_ до _END_ из _TOTAL_ записей",
                'zeroRecords': "Не найдено подходящих записей"
            }

        } );
        /*
        table.on( 'draw', function () {
            $('.confirm-incoming').each(function(idx, elm) {
                $(elm).on('click', function(e) {
                    $.ajax({
                        url: location.pathname,
                        method: "POST",
                        dataType: 'json',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            page: 'main',
                            stat_id: $(elm).data('stat-id'),
                            _csrf: $('meta[name="csrf-token"]').attr('content'),
                        }),
                        success: function(data) {
                            if(data.errors === 0) {
                                $(elm).parent().text('Подтвержденно');
                            }
                        }
                    });

                });
            });
        } );

        table.on( 'xhr', function () {
            var json = table.ajax.json();
            $("#stat-count").text(json.data.length);
            $("#stat-incoming").text(json.counters.incoming.toFixed(2));
            $("#stat-outcoming").text(json.counters.outcoming.toFixed(2));
            $("#stat-avg").text(json.counters.avg.toFixed(2));
        } );
         */
        $('#date-range').on('apply.daterangepicker', function(ev, picker) {
            table.ajax.url( location.pathname+'?'+ $.param({range: $('#date-range').val()}) ).load();
        });

        socket.on('status', function(data) {
            if(data && data.updated) {
                table.ajax.reload();
            }
        });
    }


if($('#date-range').length > 0) {
        $('#date-range').daterangepicker({
            locale: {
                "format":  'DD.MM.YY',
                "separator": " - ",
                "applyLabel": "Применить",
                "cancelLabel": "Отмена",
                "fromLabel": "С",
                "toLabel": "До",
                "customRangeLabel": "Custom",
                "weekLabel": "Нед.",
                "daysOfWeek": [
                    "Вс",
                    "Пн",
                    "Вт",
                    "Ср",
                    "Чт",
                    "Пт",
                    "Сб"
                ],
                "monthNames": [
                    "Январь",
                    "Фефраль",
                    "Март",
                    "Апрель",
                    "Май",
                    "Июнь",
                    "Июль",
                    "Август",
                    "Сентябрь",
                    "Октябрь",
                    "Ноябрь",
                    "Декабрь"
                ],
                "firstDay": 1
            },
        });
    }
    var last_selected_user = "";
    if($('.operations').length>0) {
       var $ops = $('.operations');
       $ops.find('button').on('click', function(e) {
           $.ajax({
               url: location.href+"/add",
               type: 'POST',
               contentType: "application/json; charset=utf-8",
               dataType: "json",
               data: JSON.stringify({
                   ps: $ops.find('#ps').val(),
                   sum: $ops.find('#sum').val(),
                   type: $ops.find('#type').val(),
                   comment: $ops.find('#comment').val(),
                   _csrf: $('meta[name="csrf-token"]').attr('content')
               }),
               success: function(data, status, XHR) {
                   if(data.errors === 0) {
                       var ext='';
                       var clss = '';
                       if(data.operation.in_out === 'in') {
                           ext = 'plus';
                           clss='success';
                       }
                       else {
                           clss='danger';
                           ext = 'minus';
                       }
                       $('.operations-body').prepend(
                           '<tr class="'+clss+'">'+
                               '<td>'+data.operation.operation_id+'</td>'+
                               '<td>'+data.username+'</td>'+
                               '<td>'+data.operation.type+'</td>'+
                               '<td>'+data.operation.wallet+'</td>'+
                               '<td>'+'<i class="fa fa-' + ext +'"></i> '+data.operation.sum+'</td>'+
                               '<td>'+data.operation.comment+'</td>'+
                               '<td>'+data.date+'</td>'+
                           '</tr>'
                       )
                   }
               }
           })
       });
    }

    if($('#logs').length > 0) {
        // let's assume that the client page, once rendered, knows what room it wants to join
        //console.log('sadasd');
        socket.on('connect', function() {
            // Connected, let's sign-up for to receive messages for this room
            socket.emit('admin', "logs");
        });

        var table = $('#logs').DataTable({
            "processing": true,
            "serverSide": true,
            "ajax": {
                "url": "/admin1337/log",
                "type": "POST",
                "data": {_csrf:$('meta[name="csrf-token"]').attr('content')}
            },
            "columns": [
                { "data": "user.username" },
                { "data": "description" },
                { "data": "ip" },
                { "data": "updatedAt"},
                { "data": "ban"}

            ], "language": {
                "search": "Поиск: ",
                "paginate": {
                    "first": "Первая",
                    "last": "Последняя",
                    "next": "Следущая",
                    "previous": "Предыдущая"
                },
                "processing": "Загрузка данных",
                "loadingRecords": "Идёт загрузка данных...",
                "lengthMenu": "Показать _MENU_ записей",
                "info": "Показано с _START_ до _END_ из _TOTAL_ записей",
                'zeroRecords': "Не найдено подходящих записей"
            },
            "createdRow": function(row, data, index) {
                if(data.sClass) {
                    $(row).addClass(data.sClass);
                }
            },

        } );
        table.on( 'draw', function () {
            $('.banbtn').each(function (idx, elm) {
                $(elm);
            });
        });

        $('#date-range').on('apply.daterangepicker', function(ev, picker) {
            table.ajax.url( '/admin1337/log?'+ $.param({range: $('#date-range').val()}) ).load();
        });

        socket.on('status', function(data) {
            if(data && data.updated) {
                table.ajax.reload();
            }
        });
    }

    if($('#operations-main').length > 0) {
        // let's assume that the client page, once rendered, knows what room it wants to join

        socket.on('connect', function() {
            // Connected, let's sign-up for to receive messages for this room
            socket.emit('admin', "main-stats");
        });

        var table = $('#operations-main').DataTable({
            "processing": true,
            "serverSide": true,
            "ajax": {
                "url": "/stats",
                "type": "POST"
            },
            "columns": [
                { "data": "sum" },
                { "data": "main_stat_id" },
                { "data": "operation" },
                { "data": "order.order_id" },
                { "data": "user.username" },
                { "data": "updatedAt" },
                { "data": "ps.title" },
                { "data": "order.description" },
                { "data": "need_confirmation" },
            ], "language": {
                "search": "Поиск: ",
                "paginate": {
                    "first": "Первая",
                    "last": "Последняя",
                    "next": "Следущая",
                    "previous": "Предыдущая"
                },
                "processing": "Загрузка данных",
                "loadingRecords": "Идёт загрузка данных...",
                "lengthMenu": "Показать _MENU_ записей",
                "info": "Показано с _START_ до _END_ из _TOTAL_ записей",
                'zeroRecords': "Не найдено подходящих записей"
            }

        } );
        table.on( 'draw', function () {
            $('.confirm-incoming').each(function(idx, elm) {
                $(elm).on('click', function(e) {
                    swal({
                        title: 'Подтвердить действие',
                        text: "Подтвердить оплату пользователя",
                        type: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Да',
                        cancelButtonText: 'Нет'
                    }).then(function () {
                        $.ajax({
                            url: '/stats/confirm',
                            method: "POST",
                            dataType: 'json',
                            contentType: 'application/json',
                            data: JSON.stringify({
                                page: 'main',
                                stat_id: $(elm).data('stat-id'),
                                _csrf: $('meta[name="csrf-token"]').attr('content'),
                            }),
                            success: function(data) {
                                if(data.errors === 0) {
                                    $(elm).parent().text('Подтвержденно');
                                }
                            }
                        });
                    });


                });
            });
        } );

        table.on( 'xhr', function () {
            var json = table.ajax.json();
            $("#stat-count").text(json.data.length);
            $("#stat-incoming").text(json.counters.incoming.toFixed(2));
            $("#stat-outcoming").text(json.counters.outcoming.toFixed(2));
            $("#stat-avg").text(json.counters.avg.toFixed(2));
        } );

        $('#date-range').on('apply.daterangepicker', function(ev, picker) {
            table.ajax.url( '/stats?'+ $.param({range: $('#date-range').val()}) ).load();
        });

        socket.on('status', function(data) {
            if(data && data.updated) {
                table.ajax.reload();
            }
        });
    }

    if($('#operations-seller').length > 0) {
        // let's assume that the client page, once rendered, knows what room it wants to join

        socket.on('connect', function() {
            // Connected, let's sign-up for to receive messages for this room
            socket.emit('admin', "seller-stats");
        });

        var table = $('#operations-seller').DataTable({
            "processing": true,
            "serverSide": true,
            "ajax": {
                "url": "/stats/sellers",
                "type": "POST"
            },
            "columns": [
                { "data": "sum" },
                { "data": "seller_stat_id" },
                { "data": "operation" },
                { "data": "order.order_id" },
                { "data": "user.username" },
                { "data": "updatedAt" },
                { "data": "wallet" },
                { "data": "purse" },
                { "data": "order.description" },
                { "data": "need_confirmation" },
            ], "language": {
                "search": "Поиск: ",
                "paginate": {
                    "first": "Первая",
                    "last": "Последняя",
                    "next": "Следущая",
                    "previous": "Предыдущая"
                },
                "processing": "Загрузка данных",
                "loadingRecords": "Идёт загрузка данных...",
                "lengthMenu": "Показать _MENU_ записей",
                "info": "Показано с _START_ до _END_ из _TOTAL_ записей",
                'zeroRecords': "Не найдено подходящих записей"
            }

        } );
        table.on( 'draw', function () {
            $('.confirm-incoming').each(function(idx, elm) {
                $(elm).on('click', function(e) {
                    swal({
                        title: 'Подтвердить действие',
                        text: "Подтвердить вывод?",
                        type: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Да',
                        cancelButtonText: 'Нет'
                    }).then(function () {
                        $.ajax({
                            url: '/stats/confirm-withdraw',
                            method: "POST",
                            dataType: 'json',
                            contentType: 'application/json',
                            data: JSON.stringify({
                                page: 'main',
                                stat_id: $(elm).data('stat-id'),
                                _csrf: $('meta[name="csrf-token"]').attr('content'),
                            }),
                            success: function (data) {
                                if (data.errors === 0) {
                                    $(elm).parent().text('Подтвержденно');
                                }
                            }
                        });
                    });

                });
            });
        } );

        table.on( 'xhr', function () {
            var json = table.ajax.json();
            $("#stat-count").text(json.data.length);
            $("#stat-incoming").text(json.counters.incoming.toFixed(2));
            $("#stat-outcoming").text(json.counters.outcoming.toFixed(2));
            $("#stat-avg").text(json.counters.avg.toFixed(2));
        } );

        $('#date-range').on('apply.daterangepicker', function(ev, picker) {
            table.ajax.url( '/stats/sellers?'+ $.param({range: $('#date-range').val()}) ).load();
        });

        socket.on('status', function(data) {
            if(data && data.updated) {
                updateCounters();
                table.ajax.reload();
            }
        });
    }

    if($('#operations-referral').length > 0) {
        // let's assume that the client page, once rendered, knows what room it wants to join

        socket.on('connect', function() {
            // Connected, let's sign-up for to receive messages for this room
            socket.emit('admin', "ref-stats");
        });

        var table = $('#operations-referral').DataTable({
            "processing": true,
            "serverSide": true,
            "ajax": {
                "url": "/stats/referral",
                "type": "POST"
            },
            "columns": [
                { "data": "sum" },
                { "data": "ref_stat_id" },
                { "data": "operation" },
                { "data": "order.order_id" },
                { "data": "user.username" },
                { "data": "updatedAt" },
                { "data": "purse" },
                { "data": "order.description" },
                { "data": "need_confirmation" },
            ], "language": {
                "search": "Поиск: ",
                "paginate": {
                    "first": "Первая",
                    "last": "Последняя",
                    "next": "Следущая",
                    "previous": "Предыдущая"
                },
                "processing": "Загрузка данных",
                "loadingRecords": "Идёт загрузка данных...",
                "lengthMenu": "Показать _MENU_ записей",
                "info": "Показано с _START_ до _END_ из _TOTAL_ записей",
                'zeroRecords': "Не найдено подходящих записей"
            }

        } );
        table.on( 'draw', function () {
            $('.confirm-incoming').each(function(idx, elm) {
                $(elm).on('click', function(e) {
                    swal({
                        title: 'Подтвердить действие',
                        text: "Подтвердить вывод реферальных средств?",
                        type: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Да',
                        cancelButtonText: 'Нет'
                    }).then(function () {
                        $.ajax({
                            url: '/stats/confirm-referral',
                            method: "POST",
                            dataType: 'json',
                            contentType: 'application/json',
                            data: JSON.stringify({
                                page: 'main',
                                stat_id: $(elm).data('stat-id'),
                                _csrf: $('meta[name="csrf-token"]').attr('content'),
                            }),
                            success: function (data) {
                                if (data.errors === 0) {
                                    $(elm).parent().text('Подтвержденно');
                                }
                            }
                        });
                    });
                });
            });
        } );

        table.on( 'xhr', function () {
            var json = table.ajax.json();
            $("#stat-count").text(json.data.length);
            $("#stat-incoming").text(json.counters.incoming.toFixed(2));
            $("#stat-outcoming").text(json.counters.outcoming.toFixed(2));
            $("#stat-avg").text(json.counters.avg.toFixed(2));
        } );

        $('#date-range').on('apply.daterangepicker', function(ev, picker) {
            table.ajax.url( '/stats/referral?'+ $.param({range: $('#date-range').val()}) ).load();
        });

        socket.on('status', function(data) {
            if(data && data.updated) {
                table.ajax.reload();
            }
        });
    }



    if($('#operations-profit').length > 0) {
        // let's assume that the client page, once rendered, knows what room it wants to join

        socket.on('connect', function() {
            // Connected, let's sign-up for to receive messages for this room
            socket.emit('admin', "profit-stats");
        });

        var table = $('#operations-profit').DataTable({
            "processing": true,
            "serverSide": true,
            "ajax": {
                "url": "/stats/profit",
                "type": "POST"
            },
            "columns": [
                { "data": "sum" },
                { "data": "profit_stat_id" },
                { "data": "operation" },
                { "data": "order.order_id" },
                { "data": "user.username" },
                { "data": "updatedAt" },
                { "data": "wallet" },
                { "data": "order.description" },
                { "data": "need_confirmation" },
            ], "language": {
                "search": "Поиск: ",
                "paginate": {
                    "first": "Первая",
                    "last": "Последняя",
                    "next": "Следущая",
                    "previous": "Предыдущая"
                },
                "processing": "Загрузка данных",
                "loadingRecords": "Идёт загрузка данных...",
                "lengthMenu": "Показать _MENU_ записей",
                "info": "Показано с _START_ до _END_ из _TOTAL_ записей",
                'zeroRecords': "Не найдено подходящих записей"
            }

        } );
        table.on( 'draw', function () {
            $('.confirm-incoming').each(function(idx, elm) {
                $(elm).on('click', function(e) {
                    $.ajax({
                        url: '/stats/confirm-profit',
                        method: "POST",
                        dataType: 'json',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            page: 'main',
                            stat_id: $(elm).data('stat-id'),
                            _csrf: $('meta[name="csrf-token"]').attr('content'),
                        }),
                        success: function(data) {
                            if(data.errors === 0) {
                                $(elm).parent().text('Подтвержденно');
                            }
                        }
                    });

                });
            });
        } );

        table.on( 'xhr', function () {
            var json = table.ajax.json();
            $("#stat-count").text(json.data.length);
            $("#stat-incoming").text(json.counters.incoming.toFixed(2));
            $("#stat-outcoming").text(json.counters.outcoming.toFixed(2));
            $("#stat-avg").text(json.counters.avg.toFixed(2));
        } );

        $('#date-range').on('apply.daterangepicker', function(ev, picker) {
            table.ajax.url( '/stats/profit?'+ $.param({range: $('#date-range').val()}) ).load();
        });

        socket.on('status', function(data) {
            if(data && data.updated) {
                table.ajax.reload();
            }
        });
    }
    if($('#operations-refund').length > 0) {
        // let's assume that the client page, once rendered, knows what room it wants to join

        socket.on('connect', function() {
            // Connected, let's sign-up for to receive messages for this room
            socket.emit('admin', "refund-stats");
        });

        var table = $('#operations-refund').DataTable({
            "processing": true,
            "serverSide": true,
            "ajax": {
                "url": "/stats/refund",
                "type": "POST"
            },
            "columns": [
                { "data": "sum" },
                { "data": "refund_stat_id" },
                { "data": "operation" },
                { "data": "order.order_id" },
                { "data": "user.username" },
                { "data": "updatedAt" },
                { "data": "purse" },
                { "data": "order.description" },
                { "data": "need_confirmation" },
            ], "language": {
                "search": "Поиск: ",
                "paginate": {
                    "first": "Первая",
                    "last": "Последняя",
                    "next": "Следущая",
                    "previous": "Предыдущая"
                },
                "processing": "Загрузка данных",
                "loadingRecords": "Идёт загрузка данных...",
                "lengthMenu": "Показать _MENU_ записей",
                "info": "Показано с _START_ до _END_ из _TOTAL_ записей",
                'zeroRecords': "Не найдено подходящих записей"
            }

        } );
        table.on( 'draw', function () {
            $('.confirm-incoming').each(function(idx, elm) {
                $(elm).on('click', function(e) {
                    $.ajax({
                        url: '/stats/confirm-refund',
                        method: "POST",
                        dataType: 'json',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            page: 'main',
                            stat_id: $(elm).data('stat-id'),
                            _csrf: $('meta[name="csrf-token"]').attr('content'),
                        }),
                        success: function(data) {
                            if(data.errors === 0) {
                                $(elm).parent().text('Подтвержденно');
                            }
                        }
                    });

                });
            });
        } );

        table.on( 'xhr', function () {
            var json = table.ajax.json();
            $("#stat-count").text(json.data.length);
            $("#stat-incoming").text(json.counters.incoming.toFixed(2));
            $("#stat-outcoming").text(json.counters.outcoming.toFixed(2));
            $("#stat-avg").text(json.counters.avg.toFixed(2));
        } );

        $('#date-range').on('apply.daterangepicker', function(ev, picker) {
            table.ajax.url( '/stats/refund?'+ $.param({range: $('#date-range').val()}) ).load();
        });

        socket.on('status', function(data) {
            if(data && data.updated) {
                table.ajax.reload();
            }
        });
    }
});
var ban = function(handle) {
    $.ajax({
        type: 'POST',
        url: '/admin/ban-user',
        data: {stat_id: last_selected_user, _csrf: $('meta[name="csrf-token"]').attr('content')},
        success: function (data) {
            if(data.errors && data.errors > 0) {
                sweetAlert("Опа...", data.message, "error");
            } else {
                $('.modal').modal('toggle');
                sweetAlert("Успех!", "Пользователь забанен!", "success");
            }
        }
    });
};

var banip = function(handle) {
    $.ajax({
        type: 'POST',
        url: '/admin/ban-ip',
        data: {stat_id: last_selected_user, _csrf: $('meta[name="csrf-token"]').attr('content')},
        success: function (data) {
            if(data.errors && data.errors > 0) {
                sweetAlert("Опа...", data.message, "error");
            } else {
                $('.modal').modal('toggle');
                sweetAlert("Успех!", "Доступ с этого IP заблокирован в CloudFlare!", "success");
            }
        }
    });
};
editUser = function(handle) {
    var $this = $(handle);
    var banned = $this.data("banned") == "1" ? true : false ;
    var partner = $this.data("partner") == "1" ? true : false ;
   // console.log($this.data('uid'));
    $modalBan = $("#modal-ban");
    $modalPartner = $("#modal-partner");
    $modalEditProfile = $('#modal-edit-user');

    $modalBan.toggleClass( "btn-success" , banned);
    $modalBan.toggleClass( "btn-danger", !banned);
    $modalBan.text(banned ? "Разбанить" : "Забанить");
    $modalBan.data('uid', $this.data('uid'));


    $modalPartner.toggleClass( "btn-success" , !partner);
    $modalPartner.toggleClass( "btn-danger", partner);
    $modalPartner.text(partner ? "Выключить рефку" : "Включить рефку");
    $modalPartner.data('uid', $this.data('uid'));

    $('#modal-chat').data('uid', $this.data('uid'));
    $modalEditProfile.data('uid', $this.data('uid'));
};

operation = function(handle) {
    var $this = $(handle);
    $('#modal-pay').attr('data-id', $this.data('id'));
    $('#modal-reject').attr('data-id', $this.data('id'));
    $('#modal-refund').attr('data-id', $this.data('id'));

};

unBan = function(handle) {
    var $this = $(handle);
    $.ajax({
        url: '/admin/unban',
        data: { id: $this.data('uid')},
        method: "GET",
        success: function( data ) {
            $this.toggleClass( "btn-success" , data.status);
            $this.toggleClass( "btn-danger", !data.status);
            $this.text(data.status ? "Разбанить" : "Забанить");
        }
    });
};

enablePS = function(handle) {
    var $this = $(handle);
    //console.log($this.data('uid'));
    $.ajax({
        url: '/admin/enablePS',
        data: { id: $this.data('uid')},
        method: "GET",
        success: function( data ) {
            $this.toggleClass( "btn-success" , !data.status);
            $this.toggleClass( "btn-danger", data.status);
            $this.text(data.status ?  "Выключить рефку": "Включить рефку" );
        }
    });
};
editProfile = function(handle) {

    var $this = $(handle);
    console.log($this);
    $('#save-user-btn').attr('data-uid',$this.data('uid'));


    var $email = $('#edit-user-email');
    var $username = $('#edit-user-username');
    var $password = $('#edit-user-password');
    var $admin = $('#edit-user-admin');
    var $vk = $('#edit-user-disable-vk');
    var $google = $('#edit-user-disable-google');
    var $steam = $('#edit-user-disable-steam');

    $.ajax({
        url: '/admin/getuser/'+$this.data('uid'),
        method: "GET",
        success: function( data ) {
            $email.val(data.email);
            $username.val(data.username);
            $admin.prop('checked', data.admin);

        }
    });
};

generate_password = function(handle) {
    $(handle).parent().parent().find('input').val(Math.random().toString(36).slice(-8));
};

saveChanges = function(handle) {
    var $this = $(handle);
    var $email = $('#edit-user-email');
    var $username = $('#edit-user-username');
    var $password = $('#edit-user-password');
    var $admin = $('#edit-user-admin');
    var $vk = $('#edit-user-disable-vk');
    var $google = $('#edit-user-disable-google');
    var $steam = $('#edit-user-disable-steam');
    $.ajax({
        url: '/admin/saveuser/' + $this.data('uid'),
        method: "POST",
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
            _csrf: $('meta[name="csrf-token"]').attr('content'),
            email: $email.val(),
            username: $username.val(),
            password: $password.val(),
            admin: $admin.prop( "checked" ),
            disable: {
                vk: $vk.prop( "checked" ),
                google: $google.prop( "checked" ),
                steam: $steam.prop( "checked" )
            }
        }),
        success: function (data) {
            if(data && data.success) {
                location.reload();
            }
            if(data && data.error) {
                alert(data.error);

            }
        }
    });

};