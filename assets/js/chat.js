var status = 0;
function showMessage(messageId, userId,userName, message, date, time, deleted) {
    var div_message = document.createElement('div');
    div_message.id = messageId;
    div_message.className = "message";
    if(deleted)
        div_message.className = "message text-muted";
    var div_0 = document.createElement('div');
    div_0.className = "head";

    var div_1 = document.createElement('div');
    div_1.className = "user";

    var span_0 = document.createElement('span');
    span_0.className = "fa fa-user";
    div_1.appendChild( span_0 );


    var a_0 = document.createElement('a');
    a_0.href = "/users/"+userId+"/";
    a_0.appendChild( document.createTextNode(userName) );
    div_1.appendChild( a_0 );

    div_0.appendChild( div_1 );


    var div_2 = document.createElement('div');
    div_2.className = "time pull-right";
    div_2.title = date;
    div_2.appendChild( document.createTextNode(time) );
    div_0.appendChild( div_2 );

        div_message.appendChild(div_0);
    if(status === '1' && !deleted) {
        var div_33 = document.createElement('div');
        div_33.className = "adminDelete";
        div_33.title = "Удалить сообщение";
        div_33.innerHTML = '<button class="adminDelete" onclick="deleteMessg(this)" >&times;</button>';
        div_0.appendChild(div_33);
    }

    var div_3 = document.createElement('div');
    div_3.className = "body";
    div_3.innerHTML = "<p>"+message+"</p>";

    div_message.appendChild( div_3 );
    document.querySelector("#home-chat .messages").appendChild( div_message );
}


var socket = io.connect();
socket.emit('status', function(response) {
    status = response;
});
socket.on('removed-message', function(data) {
  //  console.log('removed', data);
    postDeleteMessage(data._id);
});

socket.on('you-are-online', function(data) {
  data('yes');
});
function goSend(){
    var message = $('#chat-text-input').val();
    socket.emit('message', {message:message, chat: 'home'},function(confirm){
        //console.log('confirm:',confirm);


        if(confirm) {
            $('#chat-text-input').val('');

        }

        $('#chat-send-btn').attr('disabled','disabled');
        setTimeout(function() {
            $('#chat-send-btn').removeAttr('disabled');

        }, 5000);


    });
}
var balances = false;
if($('.balances').length >0) {
    balances=true;
}

if($('#home-chat').length) { // if chatnox init main chat
    socket.emit('get_last',{chat:"home",count:20});


    $('#chat-send-btn').on('click',function () {
        goSend();

    });

    $('#chat-text-input').keyup(function (event) {
        if (event.keyCode == 13) {
            goSend()
        }
    });

    socket.on('message', function (data) {
        showMessage(data.id, data.userId, data.userName, data.message, data.date, data.time, data.deleted);
        $('.messages').stop().animate({scrollTop: 999999});
    });
}
function updateCounters() {
    socket.emit('my-counters' ,function (counters) {
        var $messageCounter = $('#messages-counter');
        var $myOrdersCounter = $('#myorders-counter');
        var $payOrdersCounter = $('#payorders-counter');
        //console.log(counters);

        if(counters.messages > 0) {
            $messageCounter.removeClass('d-none');
            $messageCounter.text(counters.messages);
        } else {
            $messageCounter.addClass('d-none');
        }
        if(counters.payorders > 0) {
            $payOrdersCounter.removeClass('d-none');
            $payOrdersCounter.text(counters.payorders);
        } else {
            $payOrdersCounter.addClass('d-none');
        }

        if(counters.myorders > 0) {
            $myOrdersCounter.removeClass('d-none');
            $myOrdersCounter.text(counters.myorders);
        } else {
            $myOrdersCounter.addClass('d-none');
        }
        if(balances && counters.balances) {
            $('.balances .wmr-balance').text(" " + counters.balances.webmoney.toFixed(2));
            $('.balances .qiwi-balance').text(" " + counters.balances.qiwi.toFixed(2));
            $('.balances .yandex-balance').text(" " + counters.balances.yandex.toFixed(2));
            $('.balances .play4play-balance').text(" " + counters.balances.play4play.toFixed(2));
        }
    });
}
socket.on('private-message', function (data, callback) {
    var audio = new Audio('/sounds/expect-good-news.ogg');
    audio.volume = 0.7;
    audio.play();


    chat.addMessage(data, function(result) {
        if(result && result.readed && result.chat_id) {
            socket.emit('readed', {chat_id: result.chat_id});
        }
        //callback(result);
        updateCounters();
    });

});
socket.on('order-status', function(oid) {
    if($('[name="oid"]').length > 0 ) {
        if($('[name="oid"]').val() === oid) {
            location.reload();
        }
    }
});
updateCounters();
var lastmessage = new Date().getTime();
//setInterval(updateCounters,5000);
var chat = {
    addMessage: function(data, callback) {
        /*if(data.is_new) {
         var owner = false;
         if($chatboard.data('id'))
         owner = true;
         if(owner)
         $chatboard.attr('id', 'chat-' + data.chat);
         var $bookmarks = $(".bookmarks");
         if(owner)
         $bookmarks.find(".active").removeClass('active');
         var active = owner?"active":"";
         $bookmarks.prepend('<li class="'+active+'"><a href="/chat?user='+data.sender_id+'"><span class="name">'+data.sender_name+'</span></a></li>');
         }
         */

        if($('#chat-'+data.chat).length > 0) {

            var $chatboard = $('.messages.personal');
            var extend="",link="",name="", suffix="";

            if(data.system) {
                extend = " system-message";
                name = "Play4Pay";
                link = "/";
                suffix = '&nbsp;<span class="badge badge-info">оповещение</span>';
            } else if (data.admin) {
                link = "/users/" + data.sender_id;
                name = data.sender_name;
                suffix = '&nbsp;<span class="badge badge-primary">сотрудник</span>';
            } else {
                link = "/users/" + data.sender_id;
                name = data.sender_name;

            }
            $chatboard.append( '<div class="message"><div class="head"><div class="user"><span class="fa fa-user"></span><a href="'+link+'">'+name+'</a>'+suffix+'</div><div class="time pull-right">'+data.time+'</div></div><div class="body'+extend+'">'+data.message+'</div></div>' );
            $chatboard.stop().animate({scrollTop: 999999});
            callback({readed:true, chat_id:data.chat});
        } else {
            callback({readed:false});
        }
    },
    send : function (handler) {
        var _now = new Date().getTime();
        if(_now - lastmessage < 1500) {return false;} else {
            lastmessage = _now;
            var $this = $(handler);
            var $chatboard = $('.messages.personal');
            var $textbox;
            if ($this.is("button")) {
                $textbox = $this.parent().find('textarea');

            } else if ($this.is("textarea")) {
                $textbox = $this;
            } else {
                return false;
            }
            if ($textbox.val().trim() === "") {
                return false;
            }
            var params = {message: $textbox.val(), from: 'me', to: $textbox.data('id')};
            if ($chatboard.data('chat') && $chatboard.data('chat') !== "") {

                delete params.to;
                params['chat'] = $chatboard.data('chat');
            }
            socket.emit('chat', params, function (data) {
                if(!data.errors) {
                    if (data.is_new) {
                        $chatboard.attr('id', 'chat-' + data.chat);
                        var $bookmarks = $(".bookmarks");
                        $bookmarks.find(".active").removeClass('active');
                        $bookmarks.prepend('<li class="active"><a href="/chat?user=' + $chatboard.data('id') + '"><span class="name">' + $chatboard.data('name') + '</span></a></li>');
                    }
                    chat.addMessage(data, function (result) {
                    });
                    $textbox.val("");
                    $chatboard.stop().animate({scrollTop: 999999});
                } else {
                    swal("Не спишите...", data.message, "error");
                }
            });
        }
    }
};

$(document).ready(function() {
    var $chatArea = $('.messages.personal');
    var $chatInput = $('#chat-message');
    if($chatArea.length > 0)
        $chatArea.stop().animate({scrollTop: 999999});

    if($chatInput.length > 0)
        $chatInput.on('keydown', function(event) {
            if (event.keyCode == 13)
                if (!event.shiftKey) { event.preventDefault(); chat.send(this); }
        });



});