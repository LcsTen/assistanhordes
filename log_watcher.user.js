// ==UserScript==
// @name     Log Watcher
// @version  0.2
// @author   LcsTen
// @grant    GM_getValue
// @grant    GM_setValue
// @grant    GM_addValueChangeListener
// @grant    unsafeWindow
// @match    https://myhordes.de/*
// @match    https://myhordes.eu/*
// @match    https://armageddhordes.adri-web.dev/*
// ==/UserScript==

let token = null;
let originalFetch = fetch;
unsafeWindow.fetch = function() {
	let toaster = arguments[1]?.headers?.["X-Toaster"];
	if(toaster){
		token = toaster;
		unsafeWindow.fetch = originalFetch;
	}
	return originalFetch(...arguments);
}

let myHordesNotifierBc = new BroadcastChannel("MyHordesNotifier");

function updateTitle(text){
	let match = document.title.match(/{.*\} .*/);
	if(match !== null){
		document.title = document.title.replace(/\{.*\} /, text == "" ? "" : `{${text}} `);
	}else if(text != ""){
		document.title = `{${text}} `+document.title;
	}
}

function generateTitleText(){
	let t = [];
	if(GM_getValue("unreadBeyondLog")){
		t.push("L");
	}
	if(GM_getValue("unreadShoutbox")){
		t.push("C");
	}
	if(GM_getValue("unreadTownForum")){
		t.push("F");
	}
	return t.join('/');
}

function getBeyondLog(param){
	if(token === null){
		return Promise.reject("The token isn't stolen yet.");
	}
	return fetch("https://myhordes.eu/rest/v1/game/log/beyond" + (param !== "" ? "?" + param : ""),
		     {credentials: "same-origin", headers: {"X-Toaster": token, "Accept": "application/json"}})
		.then(res => res.json());
}

function getCoalitionShoutbox(){
	return fetch("https://myhordes.eu/jx/soul/shoutbox",
		     {headers: {"X-Requested-With": "XMLHttpRequest"}})
		.then(res => {
			if(!res.ok){
				throw "The user isn't connected";
			}
			return res.text();
		});
}

function getTownForum(){
	return fetch("https://myhordes.eu/jx/forum/town",
		     {headers: {"X-Requested-With": "XMLHttpRequest"}})
		.then(res => res.text());
}

function getLastBeyondLogId(){
	return getBeyondLog("limit=1").then(res => res.entries[0].id);
}

function checkNewBeyondLog(){
	if(!GM_getValue("lastReadBeyondLogId")){
		return Promise.resolve(false);
	}else if(GM_getValue("unreadBeyondLog")){
		return Promise.resolve(true);
	}
	return getBeyondLog(`above=${GM_getValue("lastReadBeyondLogId")}`).then(res => res.entries.length !== 0);
}

function checkNewCoalitionShoutboxMsg(){
	if(!GM_getValue("lastReadShoutboxMsg")){
		return Promise.resolve(false);
	}else if(GM_getValue("unreadShoutbox")){
		return Promise.resolve(true);
	}
	return getCoalitionShoutbox().then(res => {
		let div = document.createElement("div");
		div.innerHTML = res;
		let shout = div.querySelector("div:not(.shout-separator)");
		if(!shout){
			return false;
		}
		return shout.textContent !== GM_getValue("lastReadShoutboxMsg");
	});
}

function checkNewTownForumMsg(){
	if(!GM_getValue("incarnated", true)){
		return Promise.resolve(false);
	}
	return getTownForum().then(res => {
		let div = document.createElement("div");
		div.innerHTML = res;
		return div.querySelector(".forum-thread-unread") !== null;
	});
}

function init(){
	let logWatcherContainer = document.createElement("div");
	logWatcherContainer.id = "logWatcherContainer";
	
	let coalitionMsgIndicator = document.createElement("a");
	coalitionMsgIndicator.id = "logWatcherCoalitionMsgIndicator";
	coalitionMsgIndicator.classList = !!GM_getValue("lastReadShoutboxMsg") ? "" : "invisible";
	coalitionMsgIndicator.href = "https://myhordes.eu/jx/soul/coalitions";
	coalitionMsgIndicator.target = "_self";
	let coalitionMsgIndicatorImg = document.createElement("img");
	coalitionMsgIndicatorImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/escort_on.gif";
	coalitionMsgIndicator.appendChild(coalitionMsgIndicatorImg);
	logWatcherContainer.appendChild(coalitionMsgIndicator);

	let logMsgIndicator = document.createElement("a");
	logMsgIndicator.id = "logWatcherLogMsgIndicator";
	logMsgIndicator.classList = (!!GM_getValue("lastReadBeyondLogId") && GM_getValue("incarnated", true)) ? "" : "invisible";
	logMsgIndicator.href = "https://myhordes.eu/jx/beyond/desert/cached#beyond_log_content";
	logMsgIndicator.target = "_self";
	let logMsgIndicatorImg = document.createElement("img");
	logMsgIndicatorImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/news.gif";
	logMsgIndicator.appendChild(logMsgIndicatorImg);
	logWatcherContainer.appendChild(logMsgIndicator);

	document.querySelector("#header").appendChild(logWatcherContainer);

	GM_addValueChangeListener("unreadBeyondLog", (_a, _b, newValue) => {
		if(newValue){
			logMsgIndicator.classList.add("new-messages");
			myHordesNotifierBc.postMessage("Des choses se sont passées dans votre zone...");
		}else{
			logMsgIndicator.classList.remove("new-messages");
		}
		updateTitle(generateTitleText());
	});
	GM_addValueChangeListener("unreadShoutbox", (_a, _b, newValue) => {
		if(newValue){
			coalitionMsgIndicator.classList.add("new-messages");
			myHordesNotifierBc.postMessage("Vous avez de nouveaux messages de coalition.");
		}else{
			coalitionMsgIndicator.classList.remove("new-messages");
		}
		updateTitle(generateTitleText());
	});
	GM_addValueChangeListener("unreadTownForum", (_a, _b, newValue) => {
		let forum = document.querySelector(".forum");
		let forumReloadButton = document.querySelector(".forum-reload-button");
		if(forum){
			if(newValue){
				forum.classList.add("new-messages");
				if(document.querySelector(".forum-thread-unread") === null){
					forumReloadButton?.classList.add("new-messages");
				}
				myHordesNotifierBc.postMessage("Il y a des nouveaux messages dans le Forum Ville.");
			}else{
				forum.classList.remove("new-messages");
				forumReloadButton?.classList.remove("new-messages");
			}
		}
		updateTitle(generateTitleText());
	});
	GM_addValueChangeListener("lastReadBeyondLogId", (_a, _b, newValue) => {
		if(newValue){
			logMsgIndicator.classList.remove("invisible");
		}else{
			logMsgIndicator.classList.add("invisible");
		}
	});
	GM_addValueChangeListener("lastReadShoutboxMsg", (_a, _b, newValue) => {
		if(newValue){
			coalitionMsgIndicator.classList.remove("invisible");
		}else{
			coalitionMsgIndicator.classList.add("invisible");
		}
	});

	checkNewTownForumMsg().then(res => GM_setValue("unreadTownForum", res));

	setInterval(() => {
		checkNewBeyondLog().then(res => GM_setValue("unreadBeyondLog", res));
		checkNewCoalitionShoutboxMsg().then(res => GM_setValue("unreadShoutbox", res));
		checkNewTownForumMsg().then(res => GM_setValue("unreadTownForum", res));
	}, 60*1000); // 1 minute

	let stylesheet = document.createElement("style");
	stylesheet.innerText = `
		#logWatcherContainer {
			position: absolute;
			right: 41px;
			top: 100px;
			z-index: 995;
			font-size: 10px;
		}

		 #postbox.new-messages + #logWatcherContainer {
			right: 48px;
		 }

		 #logWatcherContainer a {
			background-color: rgba(62,36,23,.75);
			border-radius: 6px;
			font-size: 10px;
			padding: 3px 5px;
			display: inline-block;
			margin-left: 5px;
		 }

		#logWatcherContainer a img {
			opacity: 0.5;
		 }

		#logWatcherContainer a.new-messages img {
			opacity: 1;
			animation: 1050ms new-messages-blink infinite;
		}

		.invisible {
			display: none !important;
		}

		div.game-menu-area > div.game-bar > ul.text-menu > li.forum.new-messages {
			color: #ffffca;
			animation: 1050ms new-messages-blink infinite;
		}

		.forum-reload-button.new-messages {
			animation: 1050ms new-messages-blink infinite;
		}

		@keyframes new-messages-blink {
			from, 30%, 50%, 70%, 90%, to {
				filter: brightness(100%);
			}
			40%, 60%, 80% {
				filter: brightness(140%);
			}
		}
	`;
	document.head.appendChild(stylesheet);
}

init();

new MutationObserver(() => {
	console.log("#content changed");
	if(document.querySelector(".town-news") === null){
		GM_setValue("incarnated", false);
	}else{
		GM_setValue("incarnated", true);
	}
	let forum = document.querySelector(".forum");
	if(GM_getValue("unreadTownForum")){
		forum.classList.add("new-messages");
	}
	if(location.href.includes("/jx/soul/coalitions")){
		let shoutboxContent = document.querySelector(".shout-content");
		if(shoutboxContent === null){
			GM_setValue("lastReadShoutboxMsg", null);
		}else{
			new MutationObserver(() => {
				GM_setValue("unreadShoutbox", false);
				GM_setValue("lastReadShoutboxMsg", shoutboxContent.querySelector("div:not(.shout-separator)")?.textContent);
			}).observe(shoutboxContent, {childList: true});
		}
	}else if(location.href.includes("/jx/beyond/desert/cached")){
		new MutationObserver((_, observer) => {
			observer.disconnect();
			let logContent = document.querySelector(".log-content");
			if(logContent){
				new MutationObserver(() => {
					GM_setValue("unreadBeyondLog", false);
					getLastBeyondLogId().then(res => GM_setValue("lastReadBeyondLogId", res));
				}).observe(logContent, {childList: true});
			}
		}).observe(document.querySelector("hordes-log"), {childList: true});
	}else if(location.href.includes("/jx/forum/")){
		if(document.querySelector('.tab.selected [x-ajax-href="/jx/forum/town"]') !== null){
			if(document.querySelector(".forum-thread-unread") === null){
				checkNewTownForumMsg().then(res => GM_setValue("unreadTownForum", res));
			}
			new MutationObserver(() => {
				if(document.querySelector(".forum-thread-unread") === null){
					checkNewTownForumMsg().then(res => GM_setValue("unreadTownForum", res));
				}
			}).observe(document.querySelector("#forum-content"), {childList: true});
		}
	}else if(location.href.includes("/jx/town")){
		GM_setValue("lastReadBeyondLogId", null);
	}
}).observe(document.querySelector("#content"), {childList: true});

new MutationObserver(() => {
	let text = generateTitleText();
	if(text != "" && !document.title.includes(`{${text}} `)){
		updateTitle(text);
	}
}).observe(document.querySelector("head title"), {childList: true});
