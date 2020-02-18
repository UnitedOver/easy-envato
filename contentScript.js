'use strict';

let cardElem = null;
let show_details = 1;
let currentCode = 0;
let current_icon = 'default';

document.addEventListener("mouseup", function (e) {

    var selection = getSelectionText();

    if (!selection.length) {
        setDefaultIcon();
        return;
    }

    var purchase_code_pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

    selection = selection.trim();

    var length = selection.length;
    if (!purchase_code_pattern.test(selection)) {
        if (length > 26 && length < 40) {
            setInvalidIcon();
        }
        return;
    }

    if (currentCode == selection) return;

    currentCode = selection;
    checkPurchaseCode(currentCode);

});

function setInvalidIcon() {
    setIcon('invalid');
}

function setDefaultIcon() {
    setIcon('default');
}

function setExpiredIcon() {
    setIcon('expired');
}

function setActiveIcon() {
    setIcon('active');
}


function setIcon(icon) {
    if (current_icon === icon) {
        return;
    }
    current_icon = icon;
    if (typeof chrome.app.isInstalled !== 'undefined') {
        chrome.runtime.sendMessage({
            action: 'updateIcon',
            icon: icon
        });
    }
}

document.addEventListener("mousedown", function (e) {
    removeCard();

    var selection = getSelectionText();

    if (selection.length) {
        return;
    }

    if (e.target.classList.contains('purchase-copy')) {
        e.preventDefault();
        copyText(e.target);
        return;
    }

    currentCode = 0;
    setDefaultIcon();
});

function removeCard() {
    if (cardElem != null) {
        cardElem.remove();
        cardElem = null;
    }
}

function copyText(elemToCopy) {
    if (elemToCopy.getAttribute('data-copied') === 1) return;
    var contents = elemToCopy.textContent;
    elemToCopy.textContent = 'Copied!';
    elemToCopy.setAttribute('data-content', contents);
    elemToCopy.setAttribute('data-copied', 1);
    const el = document.createElement('textarea');
    el.value = contents;
    document.body.append(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    restoreContent(elemToCopy);

}

function restoreContent(elem) {
    setTimeout(function () {
        elem.textContent = elem.getAttribute('data-content');
        elem.removeAttribute('data-copied');
    }, 300);
}

function updatePurchaseDetails(details) {
    if (details.error) {
        setInvalidIcon();
    } else {
        var support_until = new Date(details.support_until);
        if ((Date.now() < support_until.getTime())) {
            details['support_status'] = 'font-color-active';
            setActiveIcon();
        } else {
            details['support_status'] = 'font-color-expired';
            setExpiredIcon();
        }
        details['support_until'] = formatDate(support_until);
    }

    if (show_details == 1)
        updatePurchaseInfoCard(details);
}

function updatePurchaseInfoCard(details) {
    removeCard();

    var card = document.createElement('div');
    card.setAttribute("id", "purchase-details-card");

    card.classList.add("purchase-details-card");
    var wrapper = document.createElement('div');
    wrapper.classList.add("purchase-details-wrapper");

    var details_container = document.createElement('div');
    details_container.classList.add("purchase-details-container");

    var purchase_details = document.createElement('div');
    purchase_details.classList.add("purchase-details");

    var item_info = document.createElement('div');
    item_info.classList.add('purchased-item-info');

    if (details.error) {
        wrapper.classList.add('purchase-center_align');
        item_info.innerHTML = '<div class="purchase-invalid">' + details.error + '</div>';
        setInvalidIcon();
    } else {
        item_info.innerHTML = '<div class="purchased-item-details">' +
            '<div class="purchased-item-icon_preview purchase-center_align"><img src="' + details.icon + '" /></div>' +
            '<div class="purchased-item-name-id purchase-flexgrow_max">' +
            '<div class="purchase-hcenter_align">' +
            '<div class="purchased-item-name truncate font-color-primary">' + details.name + '</div>' +
            '<div class="purchased-item-id truncate font-color-secondary">' + details.code + '</div>' +
            '</div>' +
            '</div>';

        item_info.innerHTML += '<div class="purchase-clear"></div>';

        item_info.innerHTML += '<div class="purchased-item-buyer truncate purchase-font-italic"><span class="font-color-secondary">' + details.buyer + '</span></div>';

        item_info.innerHTML += '<div class="purchased-item-sold_at"><span class="font-color-secondary">Purchase: </span><span class="font-color-primary purchase-copy">' + formatDate(details.sold_at) + '</span></div>';

        item_info.innerHTML += '<div class="purchased-item-support_until"><span class="font-color-secondary">Support End: </span><span class="purchase-copy ' + details.support_status + '">' + details.support_until + '</span></div>';
    }

    purchase_details.appendChild(item_info);

    details_container.appendChild(purchase_details);
    wrapper.appendChild(details_container);
    card.appendChild(wrapper);
    document.body.appendChild(card);

    cardElem = document.querySelector("#purchase-details-card");
}

function formatDate(time) {
    var options = {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    };

    if (!(time instanceof Date)) {
        time = new Date(time);
    }
    return time.toLocaleDateString("en-US", options);
}

function checkPurchaseCode(code) {
    setDefaultIcon();

    chrome.storage.local.get('data', function (data) {

        if (data.data == undefined) return;

        var token = data.data.token;
        show_details = data.data.show_details;

        if (token == undefined) return;

        processPurchaseCode(token, code);
    });
}

function processPurchaseCode(token, code) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', encodeURI('https://api.envato.com/v3/market/author/sale?code=' + code), true);
    xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onreadystatechange = function (e) {
        if (this.readyState === 4) {

            var response = JSON.parse(this.responseText);
            if (this.status === 200) {
                updatePurchaseDetails(parseResponse(response, code));
            } else {
                var details = {};

                if (this.status === 404) {
                    details['error'] = "Invalid Purchase Code";
                } else {

                    details['error'] = response.error;
                }

                updatePurchaseDetails(details);
            }
        }
    };
    xhr.send();

}

function parseResponse(response, code) {
    var item = response.item;

    var purchase_details = {};
    purchase_details['code'] = code;
    purchase_details['id'] = item.id;
    purchase_details['name'] = item.name;
    purchase_details['icon'] = item.previews.icon_preview.icon_url;

    purchase_details['buyer'] = response.buyer;
    purchase_details['sold_at'] = response.sold_at;
    purchase_details['support_until'] = response.supported_until;

    return purchase_details;
}

function getSelectionText() {
    return window.getSelection ? window.getSelection().toString() : "";
}
