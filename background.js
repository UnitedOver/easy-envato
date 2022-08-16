'use strict';

const SALE_CHECK_DURATION_IN_MINS = 5;
chrome.alarms.create("check_new_sale", {
    delayInMinutes: SALE_CHECK_DURATION_IN_MINS,
    periodInMinutes: SALE_CHECK_DURATION_IN_MINS
});

chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name === "check_new_sale") {
        trigger_check_new_sale();
    }
});

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action === "updateIcon") {
            chrome.action.setIcon({
                path: "/images/" + request.icon + ".png",
                tabId: sender.tab.id
            });
        }
    }
);

function trigger_check_new_sale() {
    chrome.storage.local.get('data', function (data) {

        if (data.data === undefined) return;

        var token = data.data.token;
        if (token === undefined) return;

        check_new_sale(token);
    });
}

function check_new_sale(token) {
    var url = 'https://api.envato.com/v3/market/author/sales?page=1';
    var timer_start_date = new Date();
    timer_start_date.setMinutes(timer_start_date.getMinutes() - SALE_CHECK_DURATION_IN_MINS);

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onreadystatechange = function (e) {
        if (this.readyState === 4) {

            var response = JSON.parse(this.responseText);
            if (this.status === 200) {
                var data = []
                for (var i in response) {
                    var item_data = response[i];
                    var sold_date = new Date(item_data['sold_at']);
                    if (sold_date < timer_start_date) {
                        break;
                    }
                    data.push(parseItem(item_data));
                }
                process_sale_data(data);
            }
        }
    };
    xhr.send();
}

function process_sale_data(data) {
    for(var i in data) {
        var details = data[i]
        chrome.notifications.create(details['sold_at'], {
            type: 'basic',
            iconUrl: details['icon'],
            title: 'New Sale',
            message: details['name'],
            priority: 2
        })
    }
}


function parseItem(response) {
    var item = response.item;

    var purchase_details = {};

    purchase_details['id'] = item.id;
    purchase_details['name'] = item.name;
    purchase_details['icon'] = item.previews.icon_preview.icon_url;

    purchase_details['buyer'] = response.buyer;
    purchase_details['sold_at'] = response.sold_at;
    purchase_details['support_until'] = response.supported_until;
    purchase_details['license'] = response.license;

    return purchase_details;
}
