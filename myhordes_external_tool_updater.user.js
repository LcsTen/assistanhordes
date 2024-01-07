// ==UserScript==
// @name     MyHordes External Tool Updater
// @version  1.0
// @grant    GM_getValue
// @grant    GM_setValue
// @grant    GM_addValueChangeListener
// @match    https://myhordes.de/jx/*
// @match    https://myhordes.eu/jx/*
// @match    https://bbh.fred26.fr/*
// @match    https://gest-hordes2.eragaming.fr/*
// @match    https://fatamorgana.md26.eu/map
// ==/UserScript==

"use strict";

if(window.location.toString().match("https://myhordes.de/") || window.location.toString().match("https://myhordes.eu/")){
	let button;

	function updateButtonText(){
		if(button){
			let bbh = GM_getValue("bbh", 0);
			let gh = GM_getValue("gh", 0);
			let fm = GM_getValue("fm", 0);
			button.innerHTML = `Mettre à jour <img style='opacity: ${fm > 0 ? 1 : 0.5}' class='right' src='https://fatamorgana.md26.eu/img/favicon.ico' alt='FM'> <img style='opacity: ${gh > 0 ? 1 : 0.5}' class='right' src='https://gest-hordes2.eragaming.fr/build/img/favicon.86f57e4e.gif' alt='GH'> <img style='opacity: ${bbh > 0 ? 1 : 0.5}' class='right' src='https://bbh.fred26.fr/favicon.ico' alt='BBH'>`;
			button.disabled = (bbh + gh + fm == 0);
		}
	}

	function refresh(){
		button = document.createElement("button");
		updateButtonText();
		button.style = "margin-top: 10px";
		button.addEventListener("click", () => GM_setValue("update", GM_getValue("update", 0) + 1));
		document.querySelector("div.row-flex.v-center").after(button);
	}

	new MutationObserver(() => {
		refresh();
		let node;
		if(node = document.querySelector("#beyond_desert_content")){
			new MutationObserver(refresh).observe(node, {childList: true});
		}
	}).observe(document.querySelector("#content"), {childList: true});

	GM_addValueChangeListener("bbh", updateButtonText);
	GM_addValueChangeListener("gh", updateButtonText);
	GM_addValueChangeListener("fm", updateButtonText);
}else{
	let site;
	if(window.location.toString().match("https://bbh.fred26.fr/")){
		site = "bbh";
	}else if(window.location.toString().match("https://gest-hordes2.eragaming.fr/")){
		site = "gh";
	}else if(window.location.toString().match("https://fatamorgana.md26.eu/")){
		site = "fm";
	}else{
		// What the hell?
	}

	function update(){
		if(site == "bbh"){
			document.querySelector("#f_maj .inline_button").click();
		}else if(site == "gh"){
			document.querySelector("#groupMenuMaj .bouton_chargement_maj").click();
		}else if(site == "fm"){
			document.querySelector("#update-myzone-button").click();
		}
	}

	window.addEventListener("beforeunload", e => {
		GM_setValue(site, GM_getValue(site, 0) - 1);
	});
	GM_setValue(site, GM_getValue(site, 0) + 1);
	GM_addValueChangeListener("update", update);
}
