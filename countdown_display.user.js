// ==UserScript==
// @name     Countdown Displayer
// @version  0.3
// @author   LcsTen
// @grant    none
// @match    https://myhordes.de/*
// @match    https://myhordes.eu/*
// @match    https://armageddhordes.adri-web.dev/*
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

function observe(countdown){
	updateTitle(countdown.innerText);
	observer = new MutationObserver(mutations => {
		for(let mutation of mutations){
			for(let node of mutation.addedNodes){
				updateTitle(node.textContent);
			}
		}
	});
	observer.observe(countdown, {childList: true});
}

function main(){
	let countdown = document.querySelector(toObserve);
	if(countdown !== null && !countdown.classList.contains("CDObserved")){
		observer?.disconnect();
		countdown.classList.add("CDObserved");
		observe(countdown);
	}
}

new MutationObserver(() => {
	main();
	let node;
	if(node = document.querySelector("#beyond_desert_content")){
		new MutationObserver(main).observe(node, {childList: true});
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
