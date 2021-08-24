// ==UserScript==
// @name     Countdown Displayer
// @version  0.1
// @grant    none
// @match    https://myhordes.de/jx/*
// @match    https://myhordes.eu/jx/*
// @match    https://armageddhordes.adri-web.dev/jx/*
// ==/UserScript==

"use strict";

let toObserve = (document.title.includes("MyHordes") ? "span[x-countdown]" : "li[x-countdown]");

let observer = null;

function updateTitle(text){
	let match = document.title.match(/\[.*\] .*/);
	if(match !== null){
		document.title = document.title.replace(/\[.*\]/, `[${text}]`);
	}else{
		document.title = `[${text}] `+document.title;
	}
}

function main(observed){
	updateTitle(observed.innerText);
	observer = new MutationObserver(mutations => {
		for(let mutation of mutations){
			for(let node of mutation.addedNodes){
				updateTitle(node.textContent);
			}
		}
	});
	observer.observe(observed, {childList: true});
}

new MutationObserver(() => {
	let countdown = document.querySelector(toObserve);
	if(countdown !== null && !countdown.classList.contains("CDObserved")){
		observer?.disconnect();
		countdown.classList.add("CDObserved");
		main(countdown);
	}
}).observe(document.querySelector("#content"), {childList: true});

new MutationObserver(() => {
	let match = document.title.match(/\[.*\] .*/);
	if(match === null){
		let countdown = document.querySelector(toObserve);
		if(countdown !== null){
			document.title = `[${countdown.textContent}] `+document.title;
		}
	}
}).observe(document.querySelector("head title"), {childList: true});
