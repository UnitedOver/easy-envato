'use strict';

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action === "updateIcon") {
            chrome.browserAction.setIcon({
                path: "/images/" + request.icon + ".png",
                tabId: sender.tab.id
            });
        }
    }
);