'use strict';

let update_details = document.getElementById('update_details');
let token_field = document.getElementById('envato_token');

update_details.addEventListener('click', function (e) {

    e.preventDefault();
    var data = {};

    var enable;

    var show_details = document.querySelector('input[name="show_details"]:checked');
    if (show_details != null) enable = show_details.value;

    data["token"] = token_field.value;
    data["show_details"] = enable;

    chrome.storage.local.set({'data': data});

});

chrome.storage.local.get('data', function (data) {
    var token, show_details;

    if (data.data == undefined) {
        show_details = 1;
    } else {
        token = data.data.token;
        show_details = data.data.show_details;
    }

    if (show_details == 1)
        document.forms["configure"]["show_details"].checked = true;

    if (token == undefined)
        return;

    token_field.value = token;
});
