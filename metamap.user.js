// ==UserScript==
// @name     MetaMap
// @version  0.1
// @author   LcsTen
// @grant    GM_getValue
// @grant    GM_setValue
// @grant    GM_addValueChangeListener
// @match    https://bbh.fred26.fr/*
// @match    https://gest-hordes2.eragaming.fr/*
// @match    https://fatamorgana.md26.eu/map
// ==/UserScript==

"use strict";

const LOCATION_BBH = 0;
const LOCATION_GH = 1;
const LOCATION_FM = 2;

let location;
if(window.location.host == "bbh.fred26.fr"){
	location = LOCATION_BBH;
}else if(window.location.host == "gest-hordes2.eragaming.fr"){
	location = LOCATION_GH;
}else if(window.location.host === "fatamorgana.md26.eu"){
	location = LOCATION_FM;
}

function waitFor(sel, parent = document.body, subtree = false){
	let element = parent.querySelector(sel);
	if(element !== null){
		return Promise.resolve(element);
	}else{
		return new Promise(ok => {
			new MutationObserver((_, observer) => {
				let elem = document.querySelector(sel);
				if(elem !== null){
					observer.disconnect();
					ok(elem);
				}
			}).observe(parent, {childList: true, subtree});
		});
	}
}

function pad(number){
	return number < 10 ? '0' + number : number;
}

let currentDay;

function getInfosFromBbh(doc){
	let scriptContent = doc.querySelector("script:not([src])").textContent;
	let aCases = JSON.parse(scriptContent.match(/var a_cases = ([^;]*);/s)[1].replace(/new Array\((([^()]|\(.\))*)\)/g, "[$1]").replace(/new Array\((([^()]|\(.\))*)\)/g, "[$1]"));
	let aItems = JSON.parse(scriptContent.match(/var a_items = ([^;]*);/s)[1].replace(/new Array\((([^()]|\(.\))*)\)/g, "[$1]").replace(/\\/g, ""));
	let now = new Date();
	let infos = [];
	for(let aCase of aCases){
		if(aCase.i_j.length === 0){
			infos.push({});
			continue;
		}
		let tile = {};
		let daysAgo = aCase.i_j - currentDay;
		let hourMinuteSecond = aCase.i_h.match(/(..):(..):(..)/);
		tile.lastUpdateDate = +new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, hourMinuteSecond[1] - 2, hourMinuteSecond[2], hourMinuteSecond[3]));
		tile.lastUpdateAuthor = aCase.i_n;
		tile.lastUpdateDay = +aCase.i_j;
		tile.zombies = +aCase.i_z;
		if(aCase.i_dr == 1){
			tile.depleted = true;
		}
		if(aCase.i_b_v == 1){
			tile.empty = true;
		}
		if(aCase.i_b_c == 1){
			tile.camped = true;
		}
		tile.items = [];
		for(let aCaseI of aCase.i_i){
			let item = {};
			item.type = aItems[aCaseI[0]].img;
			item.count = aCaseI[1];
			if(aItems[aCaseI[0]].broken == 1){
				item.broken = true;
			}
			tile.items.push(item);
		}
		infos.push(tile);
	}
	return infos;
}

function updateBbh(townId, force = false){
	if(force || !GM_getValue("bbhUpdateInProgress", false)){
		GM_setValue("bbhUpdateInProgress", true);
		return fetch("https://bbh.fred26.fr/?cid=5-" + townId, {redirect: "error"})
		.then(res => res.text())
		.then(res => {
			GM_setValue("bbh", {infos: getInfosFromBbh(new DOMParser().parseFromString(res, "text/html")), lastUpdate: Date.now()});
		})
		.finally(() => GM_setValue("bbhUpdateInProgress", false));
	}
	return Promise.reject();
}

function getInfosFromGh(json){
	let now = new Date();
	let infos = [];
	for(let i in json.carte.ville.zones){
		let zone = json.carte.ville.zones[i];
		let day = zone.day ?? zone.marqueur_maj_day;
		if(day === null){
			infos.push({});
			continue;
		}
		let tile = {};
		let heureMaj = zone.heure_maj ?? zone.marqueur_maj_heure;
		let daysAgo = day - currentDay;
		let hourMinuteSecond = heureMaj.match(/(..):(..):(..)/);
		tile.lastUpdateDate = +new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, hourMinuteSecond[1] - 2, hourMinuteSecond[2], hourMinuteSecond[3]));
		tile.lastUpdateAuthor = zone.citoyen?.pseudo ?? zone.marqueur_maj_by?.pseudo;
		tile.lastUpdateDay = day;
		tile.zombies = zone.zombie ?? (zone.zombie_min + zone.zombie_max)/2;
		if(zone.dried){
			tile.depleted = true;
		}
		if(zone.empty){
			tile.empty = true;
		}
		if(zone.camped){
			tile.camped = true;
		}
		tile.items = [];
		for(let zoneItem of zone.items){
			let item = {};
			item.type = zoneItem.item.icon;
			item.count = zoneItem.nombre;
			if(zoneItem.broked){
				item.broken = true;
			}
			tile.items.push(item);
		}
		infos.push(tile);
	}
	return infos;
}

function getInfosFromFm(doc){
	let data = JSON.parse(doc.querySelector("#fm-content script").textContent.match(/var data = (.*);/)[1]);
	let width = data.width;
	let height = data.height;
	let infos = [];
	for(let i = 0; i < width * height; i++){
		infos.push({});
	}
	for(let y in data.map){
		for(let x in data.map[y]){
			let zone = data.map[y][x];
			if(zone.updatedOn === undefined){
				continue;
			}
			let tile = {};
			tile.lastUpdateDate = zone.updatedOn * 1000;
			tile.lastUpdateAuthor = zone.updatedBy;
			tile.lastUpdateDay = zone.updatedOnDay;
			tile.zombies = zone.z;
			if(zone.dried === 1){
				tile.depleted = true;
			}
			if(zone.building?.dried === 1){
				tile.empty = true;
			}
			if(zone.building?.blueprint === 1){
				tile.camped = true;
			}
			tile.items = [];
			for(let zoneItem of zone.items){
				let item = {};
				item.type = data.items[zoneItem.id].image.match(/item\/([^.]*)./)[1];
				item.count = zoneItem.count;
				if(zoneItem.broken === 1){
					item.broken = true;
				}
				tile.items.push(item);
			}
			infos[(+y.substring(1))*width + +x.substring(1)] = tile;
		}
	}
	return infos;
}

function updateFm(townId, force = false){
	if(force || !GM_getValue("fmUpdateInProgress", false)){
		GM_setValue("fmUpdateInProgress", true);
		return fetch("https://fatamorgana.md26.eu/spy/town/" + townId)
		.then(res => res.text())
		.then(res => {
			GM_setValue("fm", {infos: getInfosFromFm(new DOMParser().parseFromString(res, "text/html")), lastUpdate: Date.now()});
		})
		.finally(() => GM_setValue("fmUpdateInProgress", false));
	}
	return Promise.reject();
}

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = ONE_MINUTE * 60;
function timeToHsl(timestamp){
	if(timestamp === undefined){
		return 0;
	}
	let time = Date.now() - timestamp;
	if(time <= ONE_MINUTE){
		return 120 - Math.log(1 + time*(Math.E - 1)/ONE_MINUTE)*60;
	}else if(time <= ONE_HOUR){
		return 60 - Math.log(1 + time*(Math.E - 1)/ONE_HOUR)*60;
	}else{
		return 0;
	}
}

let townId = null;

function init(){
	let stylesheet = document.createElement("style");
	stylesheet.innerText = `
		@keyframes rotate {
			from {
				transform: rotate(0deg);
			}
			to {
				transform: rotate(360deg);
			}
		}

		@keyframes shake {
			from, 50% {
				transform: translateX(0);
			}
			25% {
				transform: translateX(-10%);
			}
			75% {
				transform: translateX(10%);
			}
		}

		.loading {
			animation: 1s linear 0s infinite rotate;
		}

		.error {
			animation: 0.1s linear 0s 5 shake;
		}

		#metamapMenu {
			position: fixed;
			right: 0px;
			top: 80px;
			padding: 5px;
			border-radius: 10px 0px 0px 10px;
			writing-mode: vertical-lr;
		}

		#metamapMenu > :first-child {
			writing-mode: sideways-lr;
			background-color: rgb(113, 69, 38);
			border-radius: 10px 0px 0px 10px;
			text-align: center;
			color: white;
		}

		#metamapMenu button {
			padding: 5px;
			border: none;
			cursor: pointer;
		}

		#metamapMenu button img {
			height: 16px;
		}`;
	document.head.appendChild(stylesheet);

	let metamapMenu = document.createElement("div");
	metamapMenu.id = "metamapMenu";
	let metamapTitle = document.createElement("div");
	metamapTitle.textContent = "MetaMap";
	metamapMenu.appendChild(metamapTitle);
	let sources = document.createElement("div");
	sources.classList = "source";
	let bbhBtn = document.createElement("button");
	bbhBtn.style.background = `hsl(${timeToHsl(GM_getValue("bbh")?.lastUpdate)}deg 100% 50%)`;
	bbhBtn.addEventListener("click", e => {
		updateBbh(townId, e.ctrlKey)
		.catch(() => {
			console.log("error");
			bbhImg.classList.add("error");
			setTimeout(() => bbhImg.classList.remove("error"), 500);
		});
	});
	let bbhImg = document.createElement("img");
	if(GM_getValue("bbhUpdateInProgress") === true){
		bbhImg.classList = "loading";
	}
	bbhImg.alt = "BBH";
	bbhImg.src = "https://bbh.fred26.fr/favicon.ico";
	bbhBtn.appendChild(bbhImg);
	sources.appendChild(bbhBtn);
	let ghBtn = document.createElement("button");
	ghBtn.style.background = `hsl(${timeToHsl(GM_getValue("gh")?.lastUpdate)}deg 100% 50%)`;
	ghBtn.addEventListener("click", e => GM_setValue("ghAskUpdate", ((GM_getValue("ghAskUpdate", 0) + 1) % 2)));
	let ghImg = document.createElement("img");
	if(GM_getValue("ghUpdateInProgress") === true){
		ghImg.classList = "loading";
	}
	ghImg.alt = "GH";
	ghImg.src = "https://gest-hordes2.eragaming.fr/build/img/favicon.86f57e4e.gif";
	ghBtn.appendChild(ghImg);
	sources.appendChild(ghBtn);
	let fmBtn = document.createElement("button");
	if(GM_getValue("fmUpdateInProgress") === true){
		fmImg.classList = "loading";
	}
	fmBtn.style.background = `hsl(${timeToHsl(GM_getValue("fm")?.lastUpdate)}deg 100% 50%)`;
	fmBtn.addEventListener("click", e => {
		updateFm(townId, e.ctrlKey)
		.catch(() => {
			fmImg.classList.add("error");
			setTimeout(() => fmImg.classList.remove("error"));
		});
	});
	let fmImg = document.createElement("img");
	fmImg.alt = "FM";
	fmImg.src = "https://fatamorgana.md26.eu/img/favicon.ico";
	fmBtn.appendChild(fmImg);
	sources.appendChild(fmBtn);
	metamapMenu.appendChild(sources);
	document.body.appendChild(metamapMenu);

	setInterval(() => {
		bbhBtn.style.background = `hsl(${timeToHsl(GM_getValue("bbh")?.lastUpdate)}deg 100% 50%)`;
		ghBtn.style.background = `hsl(${timeToHsl(GM_getValue("gh")?.lastUpdate)}deg 100% 50%)`;
		fmBtn.style.background = `hsl(${timeToHsl(GM_getValue("fm")?.lastUpdate)}deg 100% 50%)`;
	}, 1000);

	GM_addValueChangeListener("bbh", () => bbhBtn.style.background = `hsl(${timeToHsl(GM_getValue("bbh")?.lastUpdate)}deg 100% 50%)`);
	GM_addValueChangeListener("gh", () => ghBtn.style.background = `hsl(${timeToHsl(GM_getValue("gh")?.lastUpdate)}deg 100% 50%)`);
	GM_addValueChangeListener("fm", () => fmBtn.style.background = `hsl(${timeToHsl(GM_getValue("fm")?.lastUpdate)}deg 100% 50%)`);

	GM_addValueChangeListener("bbhUpdateInProgress", (_1, _2, value) => {
		if(value){
			bbhImg.classList.add("loading");
		}else{
			bbhImg.classList.remove("loading");
		}
	});
	GM_addValueChangeListener("ghUpdateInProgress", (_1, _2, value) => {
		if(value){
			ghImg.classList.add("loading");
		}else{
			ghImg.classList.remove("loading");
		}
	});
	GM_addValueChangeListener("fmUpdateInProgress", (_1, _2, value) => {
		if(value){
			fmImg.classList.add("loading");
		}else{
			fmImg.classList.remove("loading");
		}
	});
}

init();

if(location === LOCATION_BBH){
	function updateMap(){
		let bbh = GM_getValue("bbh");
		let gh = GM_getValue("gh");
		let fm = GM_getValue("fm");
		for(let i in bbh?.infos ?? gh?.infos ?? fm?.infos){
			let tileInfos = [bbh?.infos[i] ?? {}, gh?.infos[i] ?? {}, fm?.infos[i] ?? {}];
			tileInfos[0].source = "bbh";
			tileInfos[1].source = "gh";
			tileInfos[2].source = "fm";
			let tile = tileInfos.toSorted((a, b) => (a.lastUpdateDate ?? 0) < (b.lastUpdateDate ?? 0))[0];
			if(tile.lastUpdateDate === undefined){
				continue;
			}
			let divs = document.querySelector(`#cases td[onmouseover*='(${i})'] .divs`);
			let mark = divs.querySelector(".mark1") || divs.querySelector(".mark2") || divs.querySelector(".mark3");
			if(mark === null){
				mark = document.createElement("div");
				divs.querySelector(".hover").before(mark);
			}
			if(tile.source == "bbh"){
				if(currentDay - tile.lastUpdateDay === 0){
					mark.classList = "mark1";
				}else if(currentDay - tile.lastUpdateDay === 1){
					mark.classList = "mark2";
				}else{
					mark.classList = "mark3";
				}
			}else if(tile.source == "gh"){
				mark.classList = "mark1";
				mark.style = "filter: hue-rotate(120deg)";
			}else if(tile.source == "fm"){
				mark.classList = "mark1";
				mark.style = "filter: hue-rotate(60deg)";
			}
			let d = new Date(tile.lastUpdateDate);
			a_cases[i].i_h = `${pad((d.getHours() + 2)%24)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
			a_cases[i].i_n = tile.lastUpdateAuthor;
			if(tile.source == "gh"){
				a_cases[i].i_n += " (via Gest'Hordes)";
			}else if(tile.source == "fm"){
				a_cases[i].i_n += " (via Fata Morgana)";
			}
			a_cases[i].i_j = tile.lastUpdateDay;
			if(tile.zombies === 0){
				let zombies = divs.querySelector(".zombies");
				if(zombies !== null){
					divs.removeChild(zombies);
				}
			}else{
				let zombies = divs.querySelector(".zombies");
				if(zombies === null){
					zombies = document.createElement("div");
					divs.querySelector(".hover").before(zombies);
				}
				let zClass = tile.zombies >= 100 ? "sp" : tile.zombies;
				zombies.classList = "zombies z_" + zClass;
			}
			a_cases[i].i_z = tile.zombies;
			if(tile.depleted){
				if(divs.querySelector(".praf") === null){
					let praf = document.createElement("div");
					praf.classList = "praf";
					divs.querySelector(".hover").before(praf);
				}
			}else{
				let praf = divs.querySelector(".praf");
				if(praf !== null){
					divs.removeChild(praf);
				}
			}
			a_cases[i].i_dr = tile.depleted ? "1" : "0";
			a_cases[i].i_b_v = tile.empty ? "1" : "0";
			a_cases[i].i_b_c = tile.camped ? "1" : "0";
			if(tile.empty || tile.camped){
				let building = null;
				for(let td of document.querySelectorAll("#list_3 tr")){
					if(td.querySelector(".c").textContent == `[${a_cases[i].x},${a_cases[i].y}]`){
						building = td;
						break;
					}
				}
				let imgs = building.querySelectorAll("img");
				if(tile.empty){
					imgs[0].classList.remove("small_empty_inv");
					imgs[0].classList.add("small_recycled");
				}else{
					imgs[0].classList.remove("small_recycled");
					imgs[0].classList.add("small_empty_inv");
				}
				if(tile.camped){
					imgs[0].classList.remove("small_empty_inv");
					imgs[0].classList.add("item_bplan");
				}else{
					imgs[0].classList.remove("item_bplan");
					imgs[0].classList.add("small_empty_inv");
				}
			}
			if(tile.items.length > 0){
				let items = divs.querySelector(".items");
				if(items === null){
					items = document.createElement("div");
					items.classList = "items";
					items.id = "item_" + i;
					divs.querySelector(".hover").before(items);
				}
				let itemsChild = items.children[0];
				if(itemsChild === undefined){
					itemsChild = document.createElement("img");
					itemsChild.src = "gfx/icons/small_empty.gif";
					itemsChild.alt = "";
					items.appendChild(itemsChild);
				}
				let sum = 0;
				for(let item of tile.items){
					sum += item.count;
				}
				itemsChild.classList = "i_count i_" + sum;
				a_cases[i].i_i = [];
				for(let item of tile.items){
					let index;
					for(index = 0; index < a_items.length; index++){
						if(a_items[index].img === item.type && ((a_items[index].broken == "1") === (item.broken ?? false))){
							break;
						}
					}
					if(index === a_items.length){
						let newAItem = {};
						newAItem.broken = item.broken ? "1" : "0";
						newAItem.count = "?";
						newAItem.img = item.type;
						newAItem.nom = item.type;
						newAItem.sort = item.type;
						newAItem.cases = [-1];
						a_items.push(newAItem);
					}
					if(!a_items[index].cases.includes(i)){
						a_items[index].cases.push(i);
					}
					a_cases[i].i_i.push([index, item.count]);
				}
			}else{
				let items = divs.querySelector(".items");
				if(items !== null){
					divs.removeChild(items);
				}
				a_cases[i].i_i = "";
				for(let item of a_items){
					item.cases = item.cases.filter(c => c != i);
				}
			}
		}
	}

	let stylesheet = document.createElement("style");
	stylesheet.type = "text/css";
	stylesheet.innerText = `
		.item_ranger {background-position: -416px -112px; border: 2px dashed blue;}
		.item_icollec {background-position: -160px -80px; border: 2px dashed blue;}
		.item_zombie {background-position: -512px -224px; border: 2px dashed blue;}
		.infos_items .item_shaman {border: 2px dashed blue;}
		.item_bat_inconnu {background-position: -496px -192px; border: 2px dashed blue;}
		.item_watchmen {background-position: -336px -224px; border: 2px dashed blue;}`;
	document.head.appendChild(stylesheet);

	currentDay = +document.querySelector("#date_ville strong").textContent.substring(1);
	townId = +document.querySelector("#nom_ville .mr").textContent.substring(2);
	GM_setValue("bbhUpdateInProgress", true);
	GM_setValue("bbh", {infos: getInfosFromBbh(document), lastUpdate: Date.now()});
	GM_setValue("bbhUpdateInProgress", false);
	GM_setValue("ghAskUpdate", (GM_getValue("ghAskUpdate", 0) + 1) % 2);
	updateFm(townId);
	updateMap();
	GM_addValueChangeListener("bbh", updateMap);
	GM_addValueChangeListener("gh", updateMap);
	GM_addValueChangeListener("fm", updateMap);
}else if(location === LOCATION_GH){
	function updateMap(){
		if(document.getElementById("zoneCarte") === null){
			return;
		}
		const spriteDiversUrl = document.querySelector("use[*|href*='sprite_divers']").getAttribute("xlink:href").match(/(.*)#/)[1];
		const spriteUrl = document.querySelector("use[*|href*='sprite.']").getAttribute("href").match(/(.*)#/)[1];
		let gh = GM_getValue("gh");
		let bbh = GM_getValue("bbh");
		let fm = GM_getValue("fm");
		let width = document.querySelector("#zoneCarte tr:not(:first-child)").querySelectorAll("td.caseCarte").length;
		for(let i in gh?.infos ?? bbh?.infos ?? fm?.infos){
			let tileInfos = [gh?.infos[i] ?? {}, bbh?.infos[i] ?? {}, fm?.infos[i] ?? {}];
			tileInfos[0].source = "gh";
			tileInfos[1].source = "bbh";
			tileInfos[2].source = "fm";
			let tile = tileInfos.toSorted((a, b) => (a.lastUpdateDate ?? 0) < (b.lastUpdateDate ?? 0))[0];
			let caseCarte = document.querySelector(`[id="${i%width}_${Math.floor(i/width)}"]`);
			if(tile.lastUpdateDate === undefined || tile.source == "gh"){
				let metamapInfos = caseCarte.querySelector(".metamapInfos");
				if(metamapInfos !== null){
					caseCarte.removeChild(metamapInfos);
				}
				continue;
			}
			if(!caseCarte.classList.contains("metamap-observed")){
				new MutationObserver(() => {
					let detailCase = caseCarte.querySelector(".detailCase");
					let metamapInfos = caseCarte.querySelector(".metamapInfos");
					if(metamapInfos === null || detailCase === null){
						return;
					}
					let infoCase = detailCase.querySelector(".infoCase");
					for(let childNode of infoCase.childNodes){
						if(childNode.nodeName === "#text"){
							infoCase.removeChild(childNode);
						}
					}
					let infoCaseDetail = infoCase.querySelector(".infoCaseDetail");
					if(infoCaseDetail === null){
						infoCaseDetail = document.createElement("div");
						infoCaseDetail.classList = "infoCaseDetail";
						infoCase.querySelector(".enteteInfoCase").after(infoCaseDetail);
					}
					infoCaseDetail.innerHTML = metamapInfos.querySelector(".infoCaseDetail").innerHTML;
					let objetSolCaseVille = infoCase.querySelector(".objetSolCaseVille");
					if(objetSolCaseVille === null){
						objetSolCaseVille = document.createElement("div");
						objetSolCaseVille.classList = "objetSolCaseVille";
						infoCase.querySelector(".infoMiseAJour").before(objetSolCaseVille);
					}
					objetSolCaseVille.innerHTML = metamapInfos.querySelector(".objetSolCaseVille").innerHTML;
					infoCase.querySelector(".phaseMaj").innerHTML = metamapInfos.querySelector(".phaseMaj").innerHTML;
				}).observe(caseCarte, {childList: true});
				caseCarte.classList.add("metamap-observed");
			}
			let caseCarteInfo = caseCarte.querySelector(".caseCarteInfo");
			let metamapInfos = caseCarte.querySelector(".metamapInfos");
			if(metamapInfos === null){
				metamapInfos = document.createElement("div");
				metamapInfos.classList = "metamapInfos";
				metamapInfos.style = "display: none";
				caseCarte.appendChild(metamapInfos);
			}else{
				metamapInfos.textContent = "";
			}
			let indicVisite = caseCarteInfo.querySelector(".indicVisite");
			if(indicVisite === null){
				indicVisite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				indicVisite.classList = "indicVisite gdCarte";
				let use = document.createElementNS("http://www.w3.org/2000/svg", "use");
				use.setAttributeNS("http://www.w3.org/1999/xlink", "href", spriteDiversUrl + "#indicateurVue");
				indicVisite.appendChild(use);
				caseCarteInfo.appendChild(indicVisite);
			}
			indicVisite.style.color = tile.source === "bbh" ? "grey": "green";
			let daysAgo = currentDay - tile.lastUpdateDay;
			let phaseMaj = document.createElement("div");
			phaseMaj.classList = "phaseMaj";
			let d = new Date(tile.lastUpdateDate);
			phaseMaj.textContent = `Zone mise à jour ${daysAgo === 0 ? "aujourd'hui" : daysAgo === 1 ? "hier" : `il y a ${daysAgo} jours`} par ${tile.lastUpdateAuthor} (via ${tile.source == "bbh" ? "BigBroth'Hordes" : tile.source == "fm" ? "Fata Morgana" : "Gest'Hordes"}) à ${pad((d.getHours() + 2)%24)}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
			metamapInfos.appendChild(phaseMaj);
			if(tile.zombies === 0){
				let zombie = caseCarteInfo.querySelector(".zombRange") || caseCarteInfo.querySelector(".zombie");
				if(zombie !== null){
					caseCarteInfo.removeChild(zombie);
				}
			}else{
				let zombRange = caseCarteInfo.querySelector(".zombRange");
				if(zombRange !== null){
					caseCarteInfo.removeChild(zombRange);
				}
				let zombie = caseCarteInfo.querySelector(".zombie");
				if(zombie === null){
					zombie = document.createElementNS("http://www.w3.org/2000/svg", "svg");
					zombie.classList = "zombReel zombie gdCarte";
					zombie.style.color = "rgb(0, 0, 0)";
					zombie.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "use"));
					caseCarteInfo.appendChild(zombie);
				}
				zombie.querySelector("use").setAttributeNS("http://www.w3.org/1999/xlink", "href", spriteDiversUrl + '#' + tile.zombies + 'z');
			}
			if(tile.depleted){
				if(caseCarteInfo.querySelector(".epuise") === null){
					let epuise = document.createElementNS("http://www.w3.org/2000/svg", "svg");
					epuise.classList = "epuise zone-epuise gdCarte";
					epuise.style.color = "rgba(0, 0, 0, 0.25)";
					let use = document.createElementNS("http://www.w3.org/2000/svg", "use");
					use.setAttributeNS("http://www.w3.org/1999/xlink", "href", spriteDiversUrl + "#hachureDroiteGauche");
					epuise.appendChild(use);
					caseCarteInfo.appendChild(epuise);
				}
			}else{
				let epuise = caseCarteInfo.querySelector(".epuise");
				if(epuise !== null){
					caseCarteInfo.removeChild(epuise);
				}
			}
			let infoCaseDetail = document.createElement("div");
			infoCaseDetail.classList = "infoCaseDetail";
			let firstSpan = document.createElement("span");
			firstSpan.innerHTML = `Contrôle de la case : <span class="zombInfoCase">?<svg class="itemHordes"><use href="${spriteUrl}#h_guard"></use></svg> / ${tile.zombies}<svg class="itemHordes"><use href="${spriteUrl}#h_zombie"></use></svg></span>`;
			infoCaseDetail.appendChild(firstSpan);
			let secondSpan = document.createElement("span");
			secondSpan.classList = "statutCaseDetailCaseVille";
			secondSpan.innerHTML = `Statut de la case :&nbsp;<span class="statutInfoCase">${tile.depleted ? 0 : 1}</span>${tile.depleted ? "Epuisée" : "Non-épuisée"}`;
			infoCaseDetail.appendChild(secondSpan);
			let thirdSpan = document.createElement("span");
			thirdSpan.classList = "statutCaseDetailCaseVille";
			thirdSpan.innerHTML = 'Balisage de la case :&nbsp;<span class="zombInfoCase">0</span>';
			infoCaseDetail.appendChild(thirdSpan);
			infoCaseDetail.appendChild(thirdSpan);
			metamapInfos.appendChild(infoCaseDetail);
			let objetSolCaseVille = document.createElement("div");
			objetSolCaseVille.classList = "objetSolCaseVille";
			if(tile.items.length > 0){
				let p = document.createElement("p");
				p.textContent = "Objets au sol :";
				objetSolCaseVille.appendChild(p);
				if(caseCarteInfo.querySelector(".objetSol") === null){
					let objetSol = document.createElementNS("http://www.w3.org/2000/svg", "svg");
					objetSol.classList = "objetSol gdCarte";
					let use = document.createElementNS("http://www.w3.org/2000/svg", "use");
					use.setAttributeNS("http://www.w3.org/1999/xlink", "href", spriteDiversUrl + "#presObjet");
					objetSol.appendChild(use);
					caseCarteInfo.appendChild(objetSol);
				}
				let listObjetSolCaseVille = document.createElement("div");
				listObjetSolCaseVille.classList = "listObjetSolCaseVille";
				for(let item of tile.items){
					let videItem = document.createElement("div");
					videItem.classList = "videItem";
					let nbrItems = document.createElement("span");
					nbrItems.classList = "nbrItems";
					nbrItems.textContent = item.count;
					videItem.appendChild(nbrItems);
					let videImg = document.createElement("span");
					videImg.classList = "videImg" + (item.broken ? "2" : "");
					let itemHordes = document.createElementNS("http://www.w3.org/2000/svg", "svg");
					itemHordes.classList = "itemHordes";
					let use = document.createElementNS("http://www.w3.org/2000/svg", "use");
					use.setAttributeNS("http://www.w3.org/1999/xlink", "href", spriteUrl + '#' + item.type);
					itemHordes.appendChild(use);
					videImg.appendChild(itemHordes);
					videItem.appendChild(videImg);
					listObjetSolCaseVille.appendChild(videItem);
				}
				objetSolCaseVille.appendChild(listObjetSolCaseVille);
			}else{
				let objetSol = caseCarteInfo.querySelector(".objetSol");
				if(objetSol !== null){
					caseCarteInfo.removeChild(objetSol);
				}
			}
			metamapInfos.appendChild(objetSolCaseVille);
		}
	}

	function update(){
		if(GM_getValue("ghUpdateInProgress", false) || townId === null){
			return Promise.reject();
		}
		GM_setValue("ghUpdateInProgress", true);
		return fetch("https://gest-hordes2.eragaming.fr/rest/v1/carte/" + townId, {
			"headers": {
				"Accept": "application/json",
			}
		}).then(res => res.json())
		.then(res => GM_setValue("gh", {infos: getInfosFromGh(res), lastUpdate: Date.now()}))
		.finally(() => GM_setValue("ghUpdateInProgress", false));
	}

	waitFor("#groupImgText a", document.body, true)
	.then(a => {
		currentDay = +document.querySelector("#jourVille").textContent;
		townId = +a.pathname.match(/\/([^/]*)$/)[1];
		updateBbh(townId);
		updateFm(townId);
		update();
	});
	GM_addValueChangeListener("ghAskUpdate", update);
	GM_addValueChangeListener("gh", updateMap);
	GM_addValueChangeListener("bbh", updateMap);
	GM_addValueChangeListener("fm", updateMap);
	waitFor("#corps", document.body, true)
	.then(corps => {
		new MutationObserver(() => {
			if(window.location.pathname == "/carte/" + townId && document.getElementById("zoneCarte") !== null){
				update();
			}
		}).observe(corps, {childList: true});
	});
}else if(location === LOCATION_FM){
	function updateMap(){
		let fm = GM_getValue("fm");
		let bbh = GM_getValue("bbh");
		let gh = GM_getValue("gh");
		let mapzones = document.querySelectorAll(".mapzone");
		const displayDriedZone = document.getElementById("options-display-driedzone").classList.contains("active-option");
		const displayFullZone = document.getElementById("options-display-fullzone").classList.contains("active-option");
		const displayZombies = document.getElementById("options-display-zombies").classList.contains("active-option");
		for(let i in fm?.infos ?? bbh?.infos ?? gh?.infos){
			let tileInfos = [fm?.infos[i] ?? {}, bbh?.infos[i] ?? {}, gh?.infos[i] ?? {}];
			tileInfos[0].source = "fm";
			tileInfos[1].source = "bbh";
			tileInfos[2].source = "gh";
			let tile = tileInfos.toSorted((a, b) => (a.lastUpdateDate ?? 0) < (b.lastUpdateDate ?? 0))[0];
			if(tile.lastUpdateDate === undefined){
				continue;
			}
			let mapzone = mapzones[i];
			let zoneUpdated = mapzone.querySelector(".zone-updated");
			if(zoneUpdated === null){
				zoneUpdated = document.createElement("div");
				zoneUpdated.classList = "zone-updated";
				mapzone.appendChild(zoneUpdated);
			}
			zoneUpdated.classList.remove("zone-updated-today", "zone-updated-yesterday", "zone-updated-b4yesterday", "zone-updated-longago");
			zoneUpdated.style = null;
			if(tile.source == "fm"){
				let daysAgo = currentDay - tile.day;
				zoneUpdated.title = "Mis à jour ";
				if(daysAgo === 0){
					zoneUpdated.classList.add("zone-updated-today");
					zoneUpdated.title += "aujourd'hui";
				}else if(daysAgo === 1){
					zoneUpdated.classList.add("zone-updated-yesterday");
					zoneUpdated.title += "hier";
				}else if(daysAgo === 2){
					zoneUpdated.classList.add("zone-updated-b4yesterday");
					zoneUpdated.title += "avant-hier";
				}else{
					zoneUpdated.classList.add("zone-updated-longago");
					zoneUpdated.title += "il y a longtemps";
				}
			}else if(tile.source == "bbh"){
				zoneUpdated.style.background = "url('https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/item/item_radius_mk2.gif') no-repeat";
				zoneUpdated.style.backgroundSize = "9px";
				zoneUpdated.title = "Mis à jour via BigBroth'Hordes";
			}else if(tile.source == "gh"){
				zoneUpdated.style.background = "url('https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/item/item_chkspk.gif') no-repeat";
				zoneUpdated.style.backgroundSize = "9px";
				zoneUpdated.title = "Mis à jour via Gest'Hordes";
			}
			let y = data.map["y" + mapzone.getAttribute("ay")];
			if(y === undefined){
				y = {};
				data.map["y" + mapzone.getAttribute("ay")];
			}
			let zone = y["x" + mapzone.getAttribute("ax")];
			if(zone === undefined){
				zone = {};
				data.map["x" + mapzone.getAttribute("ax")] = zone;
			}
			zone.updatedBy = tile.lastUpdateAuthor + (tile.source == "bbh" ? " (via BigBroth'Hordes)" : tile.source == "gh" ? " (via Gest'Hordes)" : "");
			zone.updatedOn = Math.floor(tile.lastUpdateDate / 1000);
			zone.updatedOnDay = tile.lastUpdateDay;
			if(tile.zombies > 0){
				let zombies = mapzone.querySelector(".zombies");
				if(zombies === null){
					zombies = document.createElement("div");
					zombies.classList = "zombies";
					if(!displayZombies){
						zombies.classList.add("hideme");
					}
					mapzone.appendChild(zombies);
				}
				zombies.classList.add("zombie-exact");
				zombies.style = null;
				let span = zombies.querySelector("span");
				if(span === null){
					span = document.createElement("span");
					zombies.appendChild(span);
				}
				span.textContent = tile.zombies;
				zombies.appendChild(span);
			}else{
				let zombies = mapzone.querySelector(".zombies");
				if(zombies !== null){
					mapzone.removeChild(zombies);
				}
			}
			zone.z = tile.zombies;
			zone.zm = tile.zombies;
			let scout = data.scout["y" + mapzone.getAttribute("ay") + "x" + mapzone.getAttribute("ax")];
			if(scout === undefined){
				scout = {};
				data.scout["y" + mapzone.getAttribute("ay") + "x" + mapzone.getAttribute("ax")] = scout;
			}
			scout.updatedBy = tile.lastUpdateAuthor + (tile.source == "bbh" ? " (via BigBroth'Hordes)" : tile.source == "gh" ? " (via Gest'Hordes)" : "");
			scout.updatedOn = Math.floor(tile.lastUpdateDate / 1000);
			scout.updatedOnDay = tile.lastUpdateDay;
			scout.zom = tile.zombies;
			if(tile.depleted){
				let zoneStatusFull = mapzone.querySelector(".zone-status-full");
				if(zoneStatusFull !== null){
					mapzone.removeChild(zoneStatusFull);
				}
				if(mapzone.querySelector(".zone-status-dried") === null){
					let zoneStatusDried = document.createElement("img");
					zoneStatusDried.classList = "zone-status-img zone-status-dried";
					if(!displayDriedZone){
						zoneStatusDried.classList.add("hideme");
					}
					zoneStatusDried.src = "/css/img/tag_5.gif";
					mapzone.appendChild(zoneStatusDried);
				}
			}else{
				let zoneStatusDried = mapzone.querySelector(".zone-status-dried");
				if(zoneStatusDried !== null){
					mapzone.removeChild(zoneStatusDried);
				}
				if(mapzone.querySelector(".zone-status-full") === null){
					let zoneStatusFull = document.createElement("img");
					zoneStatusFull.classList = "zone-status-img zone-status-full";
					if(!displayFullZone){
						zoneStatusFull.classList.add("hideme");
					}
					zoneStatusFull.src = "/css/img/small_gather.gif";
					mapzone.appendChild(zoneStatusFull);
				}
			}
			zone.dried = tile.depleted ? 1 : 0;
			if(zone.building){
				zone.building.dried = tile.empty ? 1 : 0;
				zone.building.blueprint = tile.camped ? 1 : 0;
			}
			zone.items = [];
			for(let item of tile.items){
				let zoneItem = {};
				zoneItem.count = item.count;
				zoneItem.broken = (item.broken === true);
				let id;
				for(id in data.items){
					if(data.items[id].image.match(/item\/([^.]*)./)[1] == item.type && ((data.items[id].broken === 1) === (item.broken === true))){
						break;
					}
				}
				zoneItem.id = +id;
				zone.items.push(zoneItem);
			}
		}
	}

	currentDay = +document.querySelector("#townDay").textContent.match(/[^ ]+ (.+)/)[1];
	townId = +document.querySelector("#townID").textContent.match(/ID: (.*)/)[1];
	GM_setValue("fmUpdateInProgress", true);
	GM_setValue("fm", {infos: getInfosFromFm(document), lastUpdate: Date.now()});
	GM_setValue("fmUpdateInProgress", false);
	GM_setValue("ghAskUpdate", (GM_getValue("ghAskUpdate", 0) + 1) % 2);
	updateBbh(townId);
	updateMap();
	GM_addValueChangeListener("bbh", updateMap);
	GM_addValueChangeListener("gh", updateMap);
	GM_addValueChangeListener("fm", updateMap);
}
