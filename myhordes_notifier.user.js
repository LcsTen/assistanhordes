// ==UserScript==
// @name     MyHordes Notifier
// @version  0.2
// @grant    none
// @match    https://myhordes.de/jx/*
// @match    https://myhordes.eu/jx/*
// @match    https://armageddhordes.adri-web.dev/jx/*
// ==/UserScript==

let iconUrl = document.querySelector("link[rel='icon'][sizes='48x48']").href;
let gameName = document.title;

let blacklist = localStorage.notifierBlacklist;
if(blacklist === undefined){
	blacklist = [];
}else{
	blacklist = JSON.parse(blacklist);
}

if(Notification.permission !== "granted"){
	let button = document.createElement("button");
	button.textContent = "Click here to grant MyHordes Notifier the permission to spam you with notifications.";
	button.style.position = "absolute";
	button.style.top = 0;
	button.style.width = "initial";
	button.addEventListener("click", () => {
		button.style.display = "none";
		Notification.requestPermission().then(permission => {
			if(permission !== "denied"){
				console.log("The permission is granted by the user.");
			}else{
				console.log("The permission is denied by the user. The script may not function properly.");
			}
		});
	});
	document.body.appendChild(button);
}

function containsBlacklistedWord(text){
	for(let word of blacklist){
		if(text.contains(word)){
			return true;
		}
	}
	return false;
}

new MutationObserver(mutations => {
	if(!document.hasFocus()){
		for(let mutation of mutations){
			for(let node of mutation.addedNodes){
				let body = "";
				for(let content of node.childNodes){
					if(!containsBlacklistedWord(content.textContent)){
						body += content.textContent+' ';
					}
				}
				new Notification(gameName, {body: node.textContent, icon: iconUrl});
			}
		}
	}
}).observe(document.querySelector("#notifications"), {childList: true});
