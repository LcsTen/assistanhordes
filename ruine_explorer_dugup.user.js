// ==UserScript==
// @name     Ruine Explorer: Dug-Up
// @version  0.3
// @author   LcsTen
// @grant    GM_getValue
// @grant    GM_setValue
// @grant    GM_addValueChangeListener
// @match    https://myhordes.de/*
// @match    https://myhordes.eu/*
// @match    https://armageddhordes.adri-web.dev/*
// @match    https://bbh.fred26.fr/*pg=ruins*
// @match    https://gest-hordes2.eragaming.fr/*
// @match    https://codeberg.org/LcsTen/assistanhordes/raw/master/ruine_explorer_free_drive.html
// ==/UserScript==

"use strict";

console.log("[REDU] Starting...");

const EMPTY = 0;
const NORTH = 1 << 0;
const EAST = 1 << 1;
const SOUTH = 1 << 2;
const WEST = 1 << 3;

function deltaToDirection(deltaX, deltaY){
	if(deltaX === 0 && deltaY === -1){
		return NORTH;
	}else if(deltaX === 1 && deltaY === 0){
		return EAST;
	}else if(deltaX === 0 && deltaY === 1){
		return SOUTH;
	}else if(deltaX === -1 && deltaY === 0){
		return WEST;
	}
	return EMPTY;
}

const DIRECTION_TO_DELTA = {
	NORTH: [0, -1],
	EAST: [1, 0],
	SOUTH: [0, 1],
	WEST: [-1, 0]
};

const NOTHING = 0;
const OPEN = 1;
const LOCKED_UNKNOWN = 2;
const LOCKED_MAGNETIC = 3;
const LOCKED_BUMP = 4;
const LOCKED_CLASSIC = 5;
const STAIRS = 6;
const ENTRANCE = 7;

const MAP_WIDTH = 13;
const MAP_HEIGHT = 14;
const ENTRANCE_X_POSITION = 7;

function spanFrom(txt){
	let res = document.createElement("span");
	res.style = "position: absolute; top: 0; z-index: 1; width: 100%; text-align: center; color: black";
	res.textContent = txt;
	return res;
}

function svgFrom(code){
	let res = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	res.setAttribute("viewBox", "0 0 100 100");
	res.style.display = "block";
	res.innerHTML = code;
	return res;
}

function withStyle(node, style){
	let res = node.cloneNode(true);
	res.style = res.style.cssText + ';' + style;
	return res;
}

const DIRECTIONS_IMG = {};
DIRECTIONS_IMG[NORTH] = svgFrom("<path stroke='black' d='M 10,0 v 90 h 80 v -90' stroke-width='5'>");
DIRECTIONS_IMG[EAST] = withStyle(DIRECTIONS_IMG[NORTH], "transform: rotate(90deg)");
DIRECTIONS_IMG[SOUTH] = withStyle(DIRECTIONS_IMG[NORTH], "transform: rotate(180deg)");
DIRECTIONS_IMG[WEST] = withStyle(DIRECTIONS_IMG[NORTH], "transform: rotate(270deg)");

DIRECTIONS_IMG[NORTH | EAST] = svgFrom("<path d='M 10,0 v 90 h 90 v -80 h -10 v -10'></path><path stroke='black' stroke-width='5' d='M 10,0 v 90 h 90 m 0,-80 h -10 v -10' fill='none'></path>");
DIRECTIONS_IMG[NORTH | SOUTH] = svgFrom("<path d='M 10,0 v 100 h 80 v -100'></path><path stroke='black' d='M 10,0 v 100 m 80,0 v -100' stroke-width='5'></path>");
DIRECTIONS_IMG[NORTH | WEST] = withStyle(DIRECTIONS_IMG[NORTH | EAST], "transform: rotate(270deg)");
DIRECTIONS_IMG[EAST | SOUTH] = withStyle(DIRECTIONS_IMG[NORTH | EAST], "transform: rotate(90deg)");

DIRECTIONS_IMG[EAST | SOUTH] = withStyle(DIRECTIONS_IMG[NORTH | EAST], "transform: rotate(90deg)");
DIRECTIONS_IMG[EAST | WEST] = withStyle(DIRECTIONS_IMG[NORTH | SOUTH], "transform: rotate(90deg)");

DIRECTIONS_IMG[SOUTH | WEST] = withStyle(DIRECTIONS_IMG[NORTH | EAST], "transform: rotate(180deg)");

DIRECTIONS_IMG[EAST | SOUTH | WEST] = svgFrom("<path d='M 0,10 h 100 v 80 h -10 v 10 h -80 v -10 h -10'></path><path stroke='black' d='M 0,10 h 100 m 0,80 h -10 v 10 m -80,0 v -10 h -10' fill='none' stroke-width='5'></path>");
DIRECTIONS_IMG[NORTH | SOUTH | WEST] = withStyle(DIRECTIONS_IMG[EAST | SOUTH | WEST], "transform: rotate(90deg)");
DIRECTIONS_IMG[NORTH | EAST | WEST] = withStyle(DIRECTIONS_IMG[EAST | SOUTH | WEST], "transform: rotate(180deg)");
DIRECTIONS_IMG[NORTH | EAST | SOUTH] = withStyle(DIRECTIONS_IMG[EAST | SOUTH | WEST], "transform: rotate(270deg)");

DIRECTIONS_IMG[NORTH | EAST | SOUTH | WEST] = svgFrom("<path d='M 10,0 v 10 h -10 v 80 h 10 v 10 h 80 v -10 h 10 v -80 h -10 v -10'></path><path stroke='black' stroke-width='5' d='M 10,0 v 10 h -10 m 0,80 h 10 v 10 m 80,0 v -10 h 10 m 0,-80 h -10 v -10'></path>");

function imgFrom(src){
	let res = document.createElement("img");
	res.style = "position: absolute; top: 18%; z-index: 1;height: 72%;width: 72%;left: 18%;";
	res.src = src;
	return res;
}

const DOORS_IMG = {};
DOORS_IMG[OPEN] = imgFrom("https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/small_enter.gif");
DOORS_IMG[LOCKED_UNKNOWN] = imgFrom("https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/lock.gif");
DOORS_IMG[LOCKED_MAGNETIC] = imgFrom("https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/item/item_magneticKey.gif");
DOORS_IMG[LOCKED_BUMP] = imgFrom("https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/item/item_bumpKey.gif");
DOORS_IMG[LOCKED_CLASSIC] = imgFrom("https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/item/item_classicKey.gif");
DOORS_IMG[STAIRS] = imgFrom("https://codeberg.org/LcsTen/assistanhordes/raw/master/stairs.png");
DOORS_IMG[ENTRANCE] = imgFrom("https://codeberg.org/LcsTen/assistanhordes/raw/master/exit.png");

const ZOMBIE_COLORS = ["white", "yellow", "orange", "red", "violet"];

const PLAYER_POSITION_IMG = withStyle(imgFrom("https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/small_middot.gif"), "z-index: 2; animation: 0.5s blink ease infinite; width: 100%; height: 100%; top: 0; left: 0");

function invertMap(map){
	let res = {};
	for(let key in map){
		res[map[key]] = key;
	}
	return res;
}

const BBH_TO_REDU_DIRECTIONS = {
	41: NORTH,
	44: EAST,
	43: SOUTH,
	42: WEST,
	31: NORTH | EAST,
	11: NORTH | SOUTH,
	32: NORTH | WEST,
	33: EAST | SOUTH,
	12: EAST | WEST,
	34: SOUTH | WEST,
	24: EAST | SOUTH | WEST,
	23: NORTH | SOUTH | WEST,
	22: NORTH | EAST | WEST,
	21: NORTH | EAST | SOUTH,
	13: NORTH | EAST | SOUTH | WEST
};
const REDU_TO_BBH_DIRECTIONS = invertMap(BBH_TO_REDU_DIRECTIONS);

const BBH_TO_REDU_DOORS = {
	1: OPEN,
	2: LOCKED_UNKNOWN,
	3: LOCKED_MAGNETIC,
	4: LOCKED_BUMP,
	5: LOCKED_CLASSIC,
	9: STAIRS
};
const REDU_TO_BBH_DOORS = invertMap(BBH_TO_REDU_DOORS);

const BBH_TO_REDU_ZOMBIES = {
	9: 0,
	1: 1,
	2: 2,
	3: 3,
	4: 4
};
const REDU_TO_BBH_ZOMBIES = invertMap(BBH_TO_REDU_ZOMBIES);

const GH_TO_REDU_DIRECTIONS = {
	19: EMPTY,
	12: NORTH,
	14: EAST,
	13: SOUTH,
	11: WEST,
	3: NORTH | EAST,
	0: NORTH | SOUTH,
	2: NORTH | WEST,
	5: EAST | SOUTH,
	1: EAST | WEST,
	4: SOUTH | WEST,
	10: EAST | SOUTH | WEST,
	8: NORTH | SOUTH | WEST,
	9: NORTH | EAST | WEST,
	7: NORTH | EAST | SOUTH,
	6: NORTH | EAST | SOUTH | WEST
};

const REDU_TO_GH_DIRECTIONS = {};
REDU_TO_GH_DIRECTIONS[NORTH] = "haut";
REDU_TO_GH_DIRECTIONS[EAST] = "droite";
REDU_TO_GH_DIRECTIONS[SOUTH] = "bas";
REDU_TO_GH_DIRECTIONS[WEST] = "gauche";

const GH_TO_REDU_DOORS = {
	"small_enter": OPEN,
	"item_lock": LOCKED_UNKNOWN,
	"item_magneticKey": LOCKED_MAGNETIC,
	"item_bumpKey": LOCKED_BUMP,
	"item_classicKey": LOCKED_CLASSIC
};

const REDU_TO_GH_DOORS = {};
REDU_TO_GH_DOORS[OPEN] = 1;
REDU_TO_GH_DOORS[LOCKED_UNKNOWN] = 2;
REDU_TO_GH_DOORS[LOCKED_MAGNETIC] = 5;
REDU_TO_GH_DOORS[LOCKED_BUMP] = 4;
REDU_TO_GH_DOORS[LOCKED_CLASSIC] = 3;

let style = `
	bottom: 5px;
	color: #d7ff5b;
	font-family: visitor2;
	font-size: 1.25rem;
	letter-spacing: .1rem;
	position: absolute;
	text-shadow: 0 0 5px #d7ff5b;
	left: 16px;
`;

let ruineExplorerPosition;
let visibleFloor;
let ruineExplorerFloorTxt;
let mapGrid;
let directionMappingButtons;

function writeMap(){
	let map = GM_getValue("map");
	if(map === undefined || !Array.isArray(map) || map.length !== 2 || map[0].length != MAP_HEIGHT || map[0][0].length != MAP_WIDTH){
		map = blankMap();
		GM_setValue("map", map);
	}

	ruineExplorerFloorTxt.textContent = `Étage ${visibleFloor}`;

	for(let i = 0; i < MAP_HEIGHT; i++){
		for(let j = 0; j < MAP_WIDTH; j++){
			let currentDiv = mapGrid.children[i*MAP_WIDTH + j];
			let currentTile = map[visibleFloor][i][j];
			currentDiv.textContent = "";
			currentDiv.style.backgroundColor = null;
			if(currentTile.door !== NOTHING){
				currentDiv.appendChild(DOORS_IMG[currentTile.door].cloneNode(true));
			}
			if(currentTile.directions !== EMPTY){
				let directions = DIRECTIONS_IMG[currentTile.directions].cloneNode(true);
				directions.setAttribute("fill", ZOMBIE_COLORS[currentTile.zombies]);
				currentDiv.appendChild(directions);
			}
		}
	}
	let position = GM_getValue("position");
	if(position !== undefined && position[2] === visibleFloor){
		mapGrid.children[position[1]*MAP_WIDTH + position[0]].children[0].before(PLAYER_POSITION_IMG.cloneNode(true));
	}
}

function updatePosition(){
	if(ruineExplorerPosition !== undefined){
		let position = GM_getValue("position");
		ruineExplorerPosition.textContent = position ? `${position[0] - ENTRANCE_X_POSITION} / ${position[1]} / ${position[2]}` : "";
	}
}

function blankMap(){
	let map = [];
	for(let i = 0; i < 2; i++){
		let floor = [];
		for(let j = 0; j < MAP_HEIGHT; j++){
			let row = [];
			for(let k = 0; k < MAP_WIDTH; k++){
				row.push({directions: EMPTY, door: NOTHING, zombies: 0});
			}
			floor.push(row);
		}
		map.push(floor);
	}
	map[0][0][ENTRANCE_X_POSITION].door = ENTRANCE;
	map[0][0][ENTRANCE_X_POSITION].directions = SOUTH;
	return map;
}

function importMap(){
	if(window.location.href.match("https://bbh.fred26.fr/")){
		let map = blankMap();
		let ruinsPlan = document.querySelectorAll(".ruins_plan");
		for(let i = 0; i < 2; i++){
			for(let j = 0; j < MAP_HEIGHT; j++){
				for(let k = 0; k < MAP_WIDTH; k++){
					let td = ruinsPlan[i].children[0].children[j + 2].children[k + 8];
					for(let directionClass in BBH_TO_REDU_DIRECTIONS){
						if(td.querySelector(".m" + directionClass)){
							map[i][j][k].directions = BBH_TO_REDU_DIRECTIONS[directionClass];
							break;
						}
					}
					for(let doorClass in BBH_TO_REDU_DOORS){
						if(td.querySelector(".p" + doorClass)){
							map[i][j][k].door = BBH_TO_REDU_DOORS[doorClass];
							break;
						}
					}
					for(let zombiesClass in BBH_TO_REDU_ZOMBIES){
						if(td.querySelector(".z" + zombiesClass)){
							map[i][j][k].zombies = BBH_TO_REDU_ZOMBIES[zombiesClass];
							break;
						}
					}
				}
			}
		}
		GM_setValue("map", map);
	}else if(window.location.href.match("https://gest-hordes2.eragaming.fr/")){
		if(!document.querySelector("#carteRuine")){
			return;
		}
		let map = blankMap();
		let ghMaps = document.querySelectorAll("#carteRuine table");
		for(let i = 0; i < Math.min(2, ghMaps.length); i++){
			for(let j = 0; j < MAP_HEIGHT; j++){
				for(let k = 0; k < MAP_WIDTH; k++) {
					if(map[i][j][k].door === ENTRANCE){
						continue;
					}
					let td = ghMaps[i].children[0].children[j + 1].children[k + 1];
					let directionsNb = td.querySelector(".ruineCarte use").getAttribute("xlink:href").match(/#.*_(.*)$/)[1];
					map[i][j][k].directions = GH_TO_REDU_DIRECTIONS[directionsNb] ?? EMPTY;
					let doorUse = td.querySelector(".ruineCarte_porte use");
					if(doorUse !== null){
						let doorId = doorUse.getAttribute("href").match(/#(.*)$/)[1];
						map[i][j][k].door = GH_TO_REDU_DOORS[doorId];
					}else if(td.querySelector(".ruineCarte_escalier") !== null){
						map[i][j][k].door = STAIRS;
					}
					let zombiesDiv = td.querySelector(".ruineCarte_zomb");
					if(zombiesDiv !== null){
						let zombiesNbClass = zombiesDiv.classList[1];
						let zombiesNb = zombiesNbClass[zombiesNbClass.length - 1];
						map[i][j][k].zombies = +zombiesNb;
					}
				}
			}
		}
		GM_setValue("map", map);
	}
}

function exportMap(){
	// TODO: Support GH
	if(window.location.href.match("https://bbh.fred26.fr/")){
		let map = GM_getValue("map");
		for(let i = 0; i < 2; i++){
			for(let j = 0; j < MAP_HEIGHT; j++){
				for(let k = 0; k < MAP_WIDTH; k++){
					let tile = map[i][j][k];
					if(tile.door === ENTRANCE){
						continue;
					}
					sel_case(i*464 + j*29 + k + 37);
					mod_case("m", -1);
					mod_case("m", REDU_TO_BBH_DIRECTIONS[tile.directions]);
					if(tile.door != NOTHING){
						mod_case("p", REDU_TO_BBH_DOORS[tile.door]);
					}
					if(tile.zombies > 0){
						mod_case("z", REDU_TO_BBH_ZOMBIES[tile.zombies]);
					}
				}
			}
		}
	}
}

function init(){
	let position = GM_getValue("position");
	visibleFloor = position === undefined ? 0 : position[2];

	let menu = document.createElement("div");
	menu.style = `position: fixed; left: 2%; background-color: rgb(205, 159, 110); border-radius: 10px 10px 0px 0px; transition: bottom 0.5s linear 0s; width: calc((100% - 950px)/2 - 4%); max-width: calc(${MAP_WIDTH}*22px);min-width: calc(${MAP_WIDTH}*11px);`;
	let title = document.createElement("div");
	title.style = "color: white; background-color: #714526; padding: 5px; border-radius: 10px 10px 0px 0px; text-align: center; cursor: pointer";
	title.textContent = "Ruine Explorer";
	title.addEventListener("click", () => menu.style.bottom = menu.style.bottom == "0px" ? (title.offsetHeight - menu.offsetHeight) + "px" : 0);
	menu.appendChild(title);

	let floorHeader = document.createElement("div");
	floorHeader.style = "text-align: center; border-bottom: 1px solid black";
	ruineExplorerFloorTxt = document.createElement("span");
	ruineExplorerFloorTxt.textContent = `Étage ${visibleFloor}`;
	floorHeader.appendChild(ruineExplorerFloorTxt);
	let floorChangeBtn = document.createElement("button");
	floorChangeBtn.classList = "inline";
	floorChangeBtn.style = "float: right";
	floorChangeBtn.textContent = "↕";
	floorChangeBtn.addEventListener("click", () => {
		visibleFloor = (visibleFloor + 1) % 2;
		writeMap();
	});
	floorHeader.appendChild(floorChangeBtn);
	menu.appendChild(floorHeader);

	function resetMenuBottom(){
		menu.classList.add("no-transition");
		menu.style.bottom = (title.offsetHeight - Math.max(265, menu.offsetHeight)) + "px";
		menu.classList.remove("no-transition");
	}

	if(window.location.href.match("https://myhordes.de/") || window.location.href.match("https://myhordes.eu/") || window.location.href.match("https://armageddhordes.adri-web.dev") || window.location.href.match("ruine_explorer_free_drive.html")){
		let mappingBtns = document.createElement("div");
		mappingBtns.style = "border-bottom: 1px solid black; display: flex; width: 100%";

		let notDirectionsBtnGrp = document.createElement("div");
		notDirectionsBtnGrp.style = "display: flex; flex-wrap: wrap";
		let doorsBtnGrp = document.createElement("span");
		doorsBtnGrp.style = "margin-left: 1%; margin-right: 1%";
		let openBtn = document.createElement("button");
		openBtn.classList = "inline";
		openBtn.title = "Ajouter une porte ouverte";
		let openImg = document.createElement("img");
		openImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/small_enter.gif";
		openImg.alt = "O";
		openImg.style.margin = "0";
		openImg.addEventListener("load", resetMenuBottom);
		openBtn.appendChild(openImg);
		openBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			if(map[position[2]][position[1]][position[0]].door !== ENTRANCE){
				map[position[2]][position[1]][position[0]].door = OPEN;
				GM_setValue("map", map);
			}
		});
		doorsBtnGrp.appendChild(openBtn);
		let lockedUnknownBtn = document.createElement("button");
		lockedUnknownBtn.classList = "inline";
		lockedUnknownBtn.title = "Ajouter une porte verrouillée";
		let lockedUnknownImg = document.createElement("img");
		lockedUnknownImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/lock.gif";
		lockedUnknownImg.alt = "L";
		lockedUnknownImg.style.margin = "0";
		lockedUnknownImg.addEventListener("load", resetMenuBottom);
		lockedUnknownBtn.appendChild(lockedUnknownImg);
		lockedUnknownBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			if(map[position[2]][position[1]][position[0]].door !== ENTRANCE){
				map[position[2]][position[1]][position[0]].door = LOCKED_UNKNOWN;
				GM_setValue("map", map);
			}
		});
		doorsBtnGrp.appendChild(lockedUnknownBtn);
		let lockedMagneticBtn = document.createElement("button");
		lockedMagneticBtn.classList = "inline";
		lockedMagneticBtn.title = "Ajouter une porte verrouillée à ouvrir avec une clé magnétique";
		let lockedMagneticImg = document.createElement("img");
		lockedMagneticImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/item/item_magneticKey.gif";
		lockedMagneticImg.alt = "M";
		lockedMagneticImg.style.margin = "0";
		lockedMagneticImg.addEventListener("load", resetMenuBottom);
		lockedMagneticBtn.appendChild(lockedMagneticImg);
		lockedMagneticBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			if(map[position[2]][position[1]][position[0]].door !== ENTRANCE){
				map[position[2]][position[1]][position[0]].door = LOCKED_MAGNETIC;
				GM_setValue("map", map);
			}
		});
		doorsBtnGrp.appendChild(lockedMagneticBtn);
		let lockedBumpBtn = document.createElement("button");
		lockedBumpBtn.classList = "inline";
		lockedBumpBtn.title = "Ajouter une porte verrouillée à ouvrir avec une clé à percussion";
		let lockedBumpImg = document.createElement("img");
		lockedBumpImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/item/item_bumpKey.gif";
		lockedBumpImg.alt = "B";
		lockedBumpImg.style.margin = "0";
		lockedBumpImg.addEventListener("load", resetMenuBottom);
		lockedBumpBtn.appendChild(lockedBumpImg);
		lockedBumpBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			if(map[position[2]][position[1]][position[0]].door !== ENTRANCE){
				map[position[2]][position[1]][position[0]].door = LOCKED_BUMP;
				GM_setValue("map", map);
			}
		});
		doorsBtnGrp.appendChild(lockedBumpBtn);
		let lockedClassicBtn = document.createElement("button");
		lockedClassicBtn.classList = "inline";
		lockedClassicBtn.title = "Ajouter une porte verrouillée à ouvrir avec un décapsuleur";
		let lockedClassicImg = document.createElement("img");
		lockedClassicImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/item/item_classicKey.gif";
		lockedClassicImg.alt = "C";
		lockedClassicImg.style.margin = "0";
		lockedClassicImg.addEventListener("load", resetMenuBottom);
		lockedClassicBtn.appendChild(lockedClassicImg);
		lockedClassicBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			if(map[position[2]][position[1]][position[0]].door !== ENTRANCE){
				map[position[2]][position[1]][position[0]].door = LOCKED_CLASSIC;
				GM_setValue("map", map);
			}
		});
		doorsBtnGrp.appendChild(lockedClassicBtn);
		let stairsBtn = document.createElement("button");
		stairsBtn.classList = "inline";
		stairsBtn.title = "Ajouter les escaliers";
		let stairsImg = document.createElement("img");
		stairsImg.src = "https://codeberg.org/LcsTen/assistanhordes/raw/master/stairs.png";
		stairsImg.alt = "S";
		stairsImg.style.margin = "0";
		stairsImg.addEventListener("load", resetMenuBottom);
		stairsBtn.appendChild(stairsImg);
		stairsBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			if(map[position[2]][position[1]][position[0]].door !== ENTRANCE){
				map[position[2]][position[1]][position[0]].door = STAIRS;
				map[(position[2] + 1) % 2][position[1]][position[0]].door = STAIRS;
				GM_setValue("map", map);
			}
		});
		doorsBtnGrp.appendChild(stairsBtn);
		let removeBtn = document.createElement("button");
		removeBtn.classList = "inline";
		removeBtn.title = "Supprimer une porte";
		let removeImg = document.createElement("img");
		removeImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/small_remove.gif";
		removeImg.alt = "X";
		removeImg.style.margin = "0";
		removeImg.addEventListener("load", resetMenuBottom);
		removeBtn.appendChild(removeImg);
		removeBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			if(map[position[2]][position[1]][position[0]].door === STAIRS && map[(position[2] + 1) % 2][position[1]][position[0]].door === STAIRS){
				map[(position[2] + 1) % 2][position[1]][position[0]].door = NOTHING;
			}
			if(map[position[2]][position[1]][position[0]].door !== ENTRANCE){
				map[position[2]][position[1]][position[0]].door = NOTHING;
				GM_setValue("map", map);
			}
		});
		doorsBtnGrp.appendChild(removeBtn);
		notDirectionsBtnGrp.appendChild(doorsBtnGrp);

		let zombiesBtnGrp = document.createElement("span");
		zombiesBtnGrp.style = "white-space: nowrap; margin-left: 1%; margin-right: 1%";
		let zombiesMinusBtn = document.createElement("button");
		zombiesMinusBtn.classList = "inline";
		let zombiesMinusTxt = document.createElement("div");
		zombiesMinusTxt.style = "text-align: center; width: 16px; height: 16px";
		zombiesMinusTxt.textContent = "-";
		zombiesMinusBtn.appendChild(zombiesMinusTxt);
		zombiesMinusBtn.title = "Supprimer un zombie";
		zombiesMinusBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			map[position[2]][position[1]][position[0]].zombies = Math.max(0, map[position[2]][position[1]][position[0]].zombies - 1);
			GM_setValue("map", map);
		});
		zombiesBtnGrp.appendChild(zombiesMinusBtn);
		let zombieIcon = document.createElement("img");
		zombieIcon.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/small_zombie.gif";
		zombieIcon.addEventListener("load", resetMenuBottom);
		zombiesBtnGrp.appendChild(zombieIcon);
		let zombiesPlusBtn = document.createElement("button");
		zombiesPlusBtn.classList = "inline";
		let zombiesPlusTxt = document.createElement("div");
		zombiesPlusTxt.style = "text-align: center; width: 16px; height: 16px";
		zombiesPlusTxt.textContent = "+";
		zombiesPlusBtn.appendChild(zombiesPlusTxt);
		zombiesPlusBtn.title = "Ajouter un zombie";
		zombiesPlusBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			map[position[2]][position[1]][position[0]].zombies = Math.min(4, map[position[2]][position[1]][position[0]].zombies + 1);
			GM_setValue("map", map);
		});
		zombiesBtnGrp.appendChild(zombiesPlusBtn);
		notDirectionsBtnGrp.appendChild(zombiesBtnGrp);

		let resetBtnGrp = document.createElement("div");
		resetBtnGrp.style = "margin-left: 1%; margin-right: 1%";
		let resetBtn = document.createElement("button");
		resetBtn.classList = "inline";
		resetBtn.style = "margin-left: 1%; margin-right: 1%";
		resetBtn.title = "Supprimer la carte";
		let resetImg = document.createElement("img");
		resetImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/small_arma.gif";
		resetImg.alt = "Reset";
		resetImg.style.margin = "0";
		resetImg.addEventListener("load", resetMenuBottom);
		resetBtn.appendChild(resetImg);
		resetBtn.addEventListener("click", () => {
			if(confirm("Supprimer la carte ?")){
				GM_setValue("map", undefined);
			}
		});
		resetBtnGrp.appendChild(resetBtn);
		notDirectionsBtnGrp.appendChild(resetBtnGrp);
		mappingBtns.appendChild(notDirectionsBtnGrp);

		directionMappingButtons = {};
		let directionsFlexElt = document.createElement("div");
		let directionsBtnGrp = document.createElement("div");
		directionsBtnGrp.style = "display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr 1fr; position: relative; top: 50%; transform: translateY(-50%)";
		directionsBtnGrp.appendChild(document.createElement("div"));
		let northBtn = document.createElement("button");
		directionMappingButtons[NORTH] = northBtn;
		northBtn.classList = "inline";
		let northTxt = document.createElement("div");
		northTxt.style = "text-align: center; width: 16px; height: 16px";
		northTxt.textContent = "↑";
		northBtn.appendChild(northTxt);
		northBtn.title = "Ajouter/supprimer un passage vers le nord";
		northBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			map[position[2]][position[1]][position[0]].directions ^= NORTH;
			GM_setValue("map", map);
		});
		directionsBtnGrp.appendChild(northBtn);
		directionsBtnGrp.appendChild(document.createElement("div"));

		let westBtn = document.createElement("button");
		directionMappingButtons[WEST] = westBtn;
		westBtn.classList = "inline";
		let westTxt = document.createElement("div");
		westTxt.style = "text-align: center; width: 16px; height: 16px";
		westTxt.textContent = "←";
		westBtn.appendChild(westTxt);
		westBtn.title = "Ajouter/supprimer un passage vers l'ouest";
		westBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			map[position[2]][position[1]][position[0]].directions ^= WEST;
			GM_setValue("map", map);
		});
		directionsBtnGrp.appendChild(westBtn);

		let allDirectionsBtn = document.createElement("button");
		allDirectionsBtn.classList = "inline";
		allDirectionsBtn.style.marginTop = 0;
		let allDirectionsTxt = document.createElement("div");
		allDirectionsTxt.style = "text-align: center; width: 16px; height: 16px";
		allDirectionsTxt.textContent = "╬";
		allDirectionsBtn.appendChild(allDirectionsTxt);
		allDirectionsBtn.title = "Ajouter des passages dans toutes les directions";
		allDirectionsBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			if(map[position[2]][position[1]][position[0]].directions === (NORTH | EAST | SOUTH | WEST)){
				map[position[2]][position[1]][position[0]].directions = EMPTY;
				if(position[1] > 0 && map[position[2]][position[1] - 1][position[0]].directions != EMPTY){
					map[position[2]][position[1]][position[0]].directions |= NORTH;
					map[position[2]][position[1] - 1][position[0]].directions |= SOUTH;
				}
				if(position[0] < MAP_WIDTH - 1 && map[position[2]][position[1]][position[0] + 1].directions != EMPTY){
					map[position[2]][position[1]][position[0]].directions |= EAST;
					map[position[2]][position[1]][position[0] + 1].directions |= WEST;
				}
				if(position[1] < MAP_HEIGHT - 1 && map[position[2]][position[1] + 1][position[0]].directions != EMPTY){
					map[position[2]][position[1]][position[0]].directions |= SOUTH;
					map[position[2]][position[1] + 1][position[0]].directions |= NORTH;
				}
				if(position[0] > 0 && map[position[2]][position[1]][position[0] - 1].directions != EMPTY){
					map[position[2]][position[1]][position[0]].directions |= WEST;
					map[position[2]][position[1]][position[0] - 1].directions |= EAST;
				}
			}else{
				map[position[2]][position[1]][position[0]].directions = NORTH | EAST | SOUTH | WEST;
			}
			GM_setValue("map", map);
		});
		directionsBtnGrp.appendChild(allDirectionsBtn);

		let eastBtn = document.createElement("button");
		directionMappingButtons[EAST] = eastBtn;
		eastBtn.classList = "inline";
		eastBtn.style.marginTop = 0;
		let eastTxt = document.createElement("div");
		eastTxt.style = "text-align: center; width: 16px; height: 16px";
		eastTxt.textContent = "→";
		eastBtn.appendChild(eastTxt);
		eastBtn.title = "Ajouter/supprimer un passage vers l'est";
		eastBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			map[position[2]][position[1]][position[0]].directions ^= EAST;
			GM_setValue("map", map);
		});
		directionsBtnGrp.appendChild(eastBtn);

		directionsBtnGrp.appendChild(document.createElement("div"));
		let southBtn = document.createElement("button");
		directionMappingButtons[SOUTH] = southBtn;
		southBtn.classList = "inline";
		southBtn.style.textAlign = "center";
		let southTxt = document.createElement("div");
		southTxt.style = "text-align: center; width: 16px; height: 16px";
		southTxt.textContent = "↓";
		southBtn.appendChild(southTxt);
		southBtn.title = "Ajouter/supprimer un passage vers le sud";
		southBtn.addEventListener("click", () => {
			let map = GM_getValue("map");
			let position = GM_getValue("position");
			map[position[2]][position[1]][position[0]].directions ^= SOUTH;
			GM_setValue("map", map);
		});
		directionsBtnGrp.appendChild(southBtn);
		directionsBtnGrp.appendChild(document.createElement("div"));
		directionsFlexElt.appendChild(directionsBtnGrp);
		mappingBtns.appendChild(directionsFlexElt);
		
		menu.appendChild(mappingBtns);

		document.body.addEventListener("keydown", e => {
			if(e.key == "2"){
				southBtn.click();
			}else if(e.key == "4"){
				westBtn.click();
			}else if(e.key == "6"){
				eastBtn.click();
			}else if(e.key == "8"){
				northBtn.click();
			}else if(e.key == "1"){
				let map = GM_getValue("map");
				let position = GM_getValue("position");
				map[position[2]][position[1]][position[0]].directions |= NORTH | EAST;
				GM_setValue("map", map);
			}else if(e.key == "3"){
				let map = GM_getValue("map");
				let position = GM_getValue("position");
				map[position[2]][position[1]][position[0]].directions |= NORTH | WEST;
				GM_setValue("map", map);
			}else if(e.key == "7"){
				let map = GM_getValue("map");
				let position = GM_getValue("position");
				map[position[2]][position[1]][position[0]].directions |= EAST | SOUTH;
				GM_setValue("map", map);
			}else if(e.key == "9"){
				let map = GM_getValue("map");
				let position = GM_getValue("position");
				map[position[2]][position[1]][position[0]].directions |= SOUTH | WEST;
				GM_setValue("map", map);
			}else if(e.key == "5"){
				allDirectionsBtn.click();
			}else if(e.key == "+"){
				let map = GM_getValue("map");
				let position = GM_getValue("position");
				map[position[2]][position[1]][position[0]].zombies = (map[position[2]][position[1]][position[0]].zombies + 1) % 5;
				GM_setValue("map", map);
			}else if(e.key == "Enter"){
				if(document.querySelector(".zone-plane-ui")){
					e.preventDefault();
				}
				let map = GM_getValue("map");
				let position = GM_getValue("position");
				if(map[position[2]][position[1]][position[0]].door !== ENTRANCE){
					map[position[2]][position[1]][position[0]].door = (map[position[2]][position[1]][position[0]].door + 1) % STAIRS;
					GM_setValue("map", map);
				}
			}
		});
	}else if(window.location.href.match("https://bbh.fred26.fr/") || window.location.href.match("https://gest-hordes2.eragaming.fr/")){
		let importExportBtns = document.createElement("div");
		importExportBtns.style = "border-bottom: 1px solid black";
		let importBtn = document.createElement("button");
		importBtn.textContent = "Importer";
		importBtn.addEventListener("click", importMap);
		importExportBtns.appendChild(importBtn);
		if(window.location.href.match("https://bbh.fred26.fr/")){
			let exportBtn = document.createElement("button");
			exportBtn.textContent = "Exporter";
			exportBtn.addEventListener("click", exportMap);
			importExportBtns.appendChild(exportBtn);
		}
		menu.appendChild(importExportBtns);
	}

	mapGrid = document.createElement("div");
	mapGrid.style = `display: grid; grid-template-columns: repeat(${MAP_WIDTH}, 1fr); grid-template-rows: repeat(${MAP_HEIGHT}, 1fr); aspect-ratio: ${MAP_WIDTH} / ${MAP_HEIGHT}; width: 100%; column-gap: 0; row-gap: 0`;
	for(let i = 0; i < MAP_WIDTH*MAP_HEIGHT; i++){
		let div = document.createElement("div");
		div.style.position = "relative";
		mapGrid.appendChild(div);
	}
	writeMap();
	menu.appendChild(mapGrid);
	document.body.appendChild(menu);
	menu.style.bottom = (title.offsetHeight - menu.offsetHeight) + "px";

	let stylesheet = document.createElement("style");
	stylesheet.type = "text/css";
	stylesheet.innerText = `
		@keyframes blink {
			from, to {
				opacity: 1;
			}
			50% {
				opacity: 0;
			}
		}

		.no-transition {
			transition: none !important;
		}
	`;
	document.head.appendChild(stylesheet);
}

init();

let sawEntrance = false;
function main(){
	console.log("[REDU] Entering main function");
	let zonePlaneUi = document.querySelector(".zone-plane-ui");
	if(zonePlaneUi === null){
		console.log("[REDU] .zone-plane-ui isn't found, aborting.");
		return;
	}
	if(document.querySelector(".plane-type-exit") !== null){
		if(!sawEntrance){
			GM_setValue("position",  [ENTRANCE_X_POSITION, 0, 0]);
			if(visibleFloor !== 0){
				visibleFloor = 0;
				writeMap();
			}
			sawEntrance = true;
		}
	}
	if(zonePlaneUi.querySelector("#ruine_explorer_position") === null){
		ruineExplorerPosition = document.createElement("div");
		ruineExplorerPosition.id = "ruine_explorer_position";
		ruineExplorerPosition.style = style;
		updatePosition();
		zonePlaneUi.appendChild(ruineExplorerPosition);
	}else{
		console.log("[REDU] #ruine_explorer_position already exists.");
	}
	for(let actionMove of document.querySelectorAll(".zone-plane-controls > .action-move:not(.redu-listened)")){
		let deltaX = actionMove.getAttribute("x-direction-x");
		let deltaY = actionMove.getAttribute("x-direction-y"); // Y axis is reversed between MyHordes and REDU (In MyHordes +1 is North, while it's South in REDU)
		if(deltaX === null || deltaY === null){
			console.log(`[REDU] actionMove with classList "${actionMove.classList.value}" doesn't have attributes x-direction-x or x-direction-y, ignoring.`);
			continue;
		}
		console.log(`[REDU] Infecting actionMove with classList "${actionMove.classList.value}" and attributes x-direction-x "${deltaX} and x-direction-y "${deltaY}"`);
		actionMove.addEventListener("click", () => {
			let position = GM_getValue("position", [ENTRANCE_X_POSITION, 0, 0]);
			let map = GM_getValue("map");
			position[0] += +deltaX;
			position[1] += -deltaY;
			let direction = deltaToDirection(-deltaX, +deltaY);
			for(let d of [NORTH, EAST, SOUTH, WEST]){
				directionMappingButtons[d].disabled = (d === direction);
			}
			map[position[2]][position[1]][position[0]].directions |= direction;
			if(position[1] > 0 && map[position[2]][position[1] - 1][position[0]].directions != EMPTY){
				map[position[2]][position[1]][position[0]].directions |= NORTH;
				map[position[2]][position[1] - 1][position[0]].directions |= SOUTH;
			}
			if(position[0] < MAP_WIDTH - 1 && map[position[2]][position[1]][position[0] + 1].directions != EMPTY){
				map[position[2]][position[1]][position[0]].directions |= EAST;
				map[position[2]][position[1]][position[0] + 1].directions |= WEST;
			}
			if(position[1] < MAP_HEIGHT - 1 && map[position[2]][position[1] + 1][position[0]].directions != EMPTY){
				map[position[2]][position[1]][position[0]].directions |= SOUTH;
				map[position[2]][position[1] + 1][position[0]].directions |= NORTH;
			}
			if(position[0] > 0 && map[position[2]][position[1]][position[0] - 1].directions != EMPTY){
				map[position[2]][position[1]][position[0]].directions |= WEST;
				map[position[2]][position[1]][position[0] - 1].directions |= EAST;
			}
			GM_setValue("position", position);
			GM_setValue("map", map);
			console.log(`[REDU] actionMove with classList "${actionMove.classList.value}" clicked, moved to ${position[0]} / ${position[1]}`);
		});
		actionMove.classList.add("redu-listened");
	}
	let useStairsBtn = document.querySelector("#stairs_button:not(.redu-listened");
	if(useStairsBtn !== null){
		useStairsBtn.addEventListener("click", () => {
			let position = GM_getValue("position", [ENTRANCE_X_POSITION, 0, 0]);
			let map = GM_getValue("map");
			map[position[2]][position[1]][position[0]].door = STAIRS;
			position[2] = (position[2] + 1) % 2;
			visibleFloor = position[2];
			map[position[2]][position[1]][position[0]].door = STAIRS;
			GM_setValue("position", position);
			GM_setValue("map", map);
			for(let d of [NORTH, EAST, SOUTH, WEST]){
				directionMappingButtons[d].disabled = false;
			}
		});
		useStairsBtn.classList.add("redu-listened");
	}
}

GM_addValueChangeListener("position", writeMap);
GM_addValueChangeListener("position", updatePosition);
GM_addValueChangeListener("map", writeMap);

console.log("[REDU] Up and running.");

main();

console.log("[REDU] Launching the mutation observer.");

new MutationObserver(main).observe(document.body, {childList: true, subtree: true}); // TODO: Optimize this
