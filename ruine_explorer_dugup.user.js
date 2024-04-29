// ==UserScript==
// @name     Ruine Explorer: Dug-Up
// @version  0.11
// @author   LcsTen
// @grant    GM_getValue
// @grant    GM_setValue
// @grant    GM_addValueChangeListener
// @match    https://myhordes.de/*
// @match    https://myhordes.eu/*
// @match    https://myhord.es/*
// @match    https://armageddhordes.adri-web.dev/*
// @match    https://bbh.fred26.fr/*pg=ruins*
// @match    https://gest-hordes2.eragaming.fr/*
// @match    https://codeberg.org/LcsTen/assistanhordes/raw/master/ruine_explorer_free_drive.html
// ==/UserScript==

"use strict";

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
DIRECTIONS_IMG[NORTH] = svgFrom("<path d='M 10,0 v 90 h 80 v -90'>");
DIRECTIONS_IMG[EAST] = withStyle(DIRECTIONS_IMG[NORTH], "transform: rotate(90deg)");
DIRECTIONS_IMG[SOUTH] = withStyle(DIRECTIONS_IMG[NORTH], "transform: rotate(180deg)");
DIRECTIONS_IMG[WEST] = withStyle(DIRECTIONS_IMG[NORTH], "transform: rotate(270deg)");

DIRECTIONS_IMG[NORTH | EAST] = svgFrom("<path d='M 10,0 v 90 h 90 v -80 h -10 v -10' stroke='none'></path><path d='M 10,0 v 90 h 90 m 0,-80 h -10 v -10' fill='none'></path>");
DIRECTIONS_IMG[NORTH | SOUTH] = svgFrom("<path d='M 10,0 v 100 h 80 v -100' stroke='none'></path><path d='M 10,0 v 100 m 80,0 v -100'></path>");
DIRECTIONS_IMG[NORTH | WEST] = withStyle(DIRECTIONS_IMG[NORTH | EAST], "transform: rotate(270deg)");
DIRECTIONS_IMG[EAST | SOUTH] = withStyle(DIRECTIONS_IMG[NORTH | EAST], "transform: rotate(90deg)");

DIRECTIONS_IMG[EAST | SOUTH] = withStyle(DIRECTIONS_IMG[NORTH | EAST], "transform: rotate(90deg)");
DIRECTIONS_IMG[EAST | WEST] = withStyle(DIRECTIONS_IMG[NORTH | SOUTH], "transform: rotate(90deg)");

DIRECTIONS_IMG[SOUTH | WEST] = withStyle(DIRECTIONS_IMG[NORTH | EAST], "transform: rotate(180deg)");

DIRECTIONS_IMG[EAST | SOUTH | WEST] = svgFrom("<path d='M 0,10 h 100 v 80 h -10 v 10 h -80 v -10 h -10' stroke='none'></path><path d='M 0,10 h 100 m 0,80 h -10 v 10 m -80,0 v -10 h -10' fill='none'></path>");
DIRECTIONS_IMG[NORTH | SOUTH | WEST] = withStyle(DIRECTIONS_IMG[EAST | SOUTH | WEST], "transform: rotate(90deg)");
DIRECTIONS_IMG[NORTH | EAST | WEST] = withStyle(DIRECTIONS_IMG[EAST | SOUTH | WEST], "transform: rotate(180deg)");
DIRECTIONS_IMG[NORTH | EAST | SOUTH] = withStyle(DIRECTIONS_IMG[EAST | SOUTH | WEST], "transform: rotate(270deg)");

DIRECTIONS_IMG[NORTH | EAST | SOUTH | WEST] = svgFrom("<path d='M 10,0 v 10 h -10 v 80 h 10 v 10 h 80 v -10 h 10 v -80 h -10 v -10' stroke='none'></path><path d='M 10,0 v 10 h -10 m 0,80 h 10 v 10 m 80,0 v -10 h 10 m 0,-80 h -10 v -10'></path>");

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
	0: EMPTY,
	2: NORTH,
	4: EAST,
	8: SOUTH,
	1: WEST,
	6: NORTH | EAST,
	10: NORTH | SOUTH,
	3: NORTH | WEST,
	12: EAST | SOUTH,
	5: EAST | WEST,
	9: SOUTH | WEST,
	13: EAST | SOUTH | WEST,
	11: NORTH | SOUTH | WEST,
	7: NORTH | EAST | WEST,
	14: NORTH | EAST | SOUTH,
	15: NORTH | EAST | SOUTH | WEST
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

const LOCATION_MH = 0;
const LOCATION_BBH = 1;
const LOCATION_GH = 2;
const LOCATION_TEST_PAGE = 3;

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

let location;
if(window.location.host == "myhordes.de" || window.location.host == "myhordes.eu" || window.location.host == "myhord.es" ||  window.location.host == "armageddhordes.adri-web.dev"){
	location = LOCATION_MH;
}else if(window.location.host == "bbh.fred26.fr"){
	location = LOCATION_BBH;
}else if(window.location.host == "gest-hordes2.eragaming.fr"){
	location = LOCATION_GH;
}else if(window.location.pathname.endsWith("/ruine_explorer_free_drive.html")){
	location = LOCATION_TEST_PAGE;
}
let ruineExplorerPosition;
let visibleFloor;
let ruineExplorerFloorTxt;
let mapGrid;
let directionMappingButtons;
let ruineExplorerMenu;
let ruineExplorerMappingBtns;

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
			currentDiv.classList = "";
			currentDiv.classList.add("z" + currentTile.zombies, "t" + currentTile.trust ?? 0);
			if(currentTile.door !== NOTHING){
				currentDiv.appendChild(DOORS_IMG[currentTile.door].cloneNode(true));
			}
			if(currentTile.directions !== EMPTY){
				let directions = DIRECTIONS_IMG[currentTile.directions].cloneNode(true);
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
	map[0][0][ENTRANCE_X_POSITION].trust = 1;
	return map;
}

function importMap(){
	if(location === LOCATION_BBH){
		let oldMap = GM_getValue("map", blankMap());
		let map = blankMap();
		let ruinsPlan = document.querySelectorAll(".ruins_plan");
		let stairLocation = null;
		for(let i = 0; i < 2; i++){
			let shift = [0, 0];
			if(i === 1 && stairLocation !== null){
				for(let j = 0; j < MAP_HEIGHT; j++){
					for(let k = 0; k < MAP_WIDTH; k++){
						let td = ruinsPlan[i].children[0].children[j + 2].children[k + 8];
						if(td.querySelector(".p9")){
							shift = [j - stairLocation[0], k - stairLocation[1]];
						}
					}
				}
			}
			for(let j = 0; j < MAP_HEIGHT; j++){
				for(let k = 0; k < MAP_WIDTH; k++){
					let td = ruinsPlan[i].children[0].children[j + 2 + shift[0]].children[k + 8 + shift[1]];
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
					if(td.querySelector(".p9")){
						stairLocation = [j, k];
					}
					for(let zombiesClass in BBH_TO_REDU_ZOMBIES){
						if(td.querySelector(".z" + zombiesClass)){
							map[i][j][k].zombies = BBH_TO_REDU_ZOMBIES[zombiesClass];
							break;
						}
					}
					map[i][j][k].trust = +((oldMap[i][j][k].trust ?? 0) && map[i][j][k].directions === oldMap[i][j][k].directions);
				}
			}
		}
		GM_setValue("map", map);
	}else if(location === LOCATION_GH){
		if(!document.querySelector("#carteRuine")){
			return;
		}
		let oldMap = GM_getValue("map", blankMap());
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
					map[i][j][k].trust = +((oldMap[i][j][k].trust ?? 0) && map[i][j][k].directions === oldMap[i][j][k].directions);
				}
			}
		}
		GM_setValue("map", map);
	}
}

function exportMap(replace){
	// TODO: Support GH
	if(location === LOCATION_BBH){
		let map = GM_getValue("map");
		for(let i = 0; i < 2; i++){
			for(let j = 0; j < MAP_HEIGHT; j++){
				for(let k = 0; k < MAP_WIDTH; k++){
					let tile = map[i][j][k];
					if(tile.door === ENTRANCE){
						continue;
					}
					sel_case(i*464 + j*29 + k + 37);
					if(replace || tile.directions !== EMPTY){
						mod_case("m", -1)
					}
					if(tile.directions === EMPTY){
						continue;
					}
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

	ruineExplorerMenu = document.createElement("div");
	ruineExplorerMenu.id = "ruineExplorerMenu";
	ruineExplorerMenu.classList = "folded";
	let title = document.createElement("div");
	title.textContent = "Ruine Explorer";
	title.addEventListener("click", () => ruineExplorerMenu.classList.toggle("folded"));
	ruineExplorerMenu.appendChild(title);

	let floorHeader = document.createElement("div");
	ruineExplorerFloorTxt = document.createElement("span");
	ruineExplorerFloorTxt.textContent = `Étage ${visibleFloor}`;
	floorHeader.appendChild(ruineExplorerFloorTxt);
	let floorChangeBtn = document.createElement("button");
	floorChangeBtn.classList = "inline";
	floorChangeBtn.textContent = "↕";
	floorChangeBtn.addEventListener("click", () => {
		visibleFloor = (visibleFloor + 1) % 2;
		writeMap();
	});
	floorHeader.appendChild(floorChangeBtn);
	ruineExplorerMenu.appendChild(floorHeader);

	let optionsSection = document.createElement("div");
	let phoneModeOption = GM_getValue("phoneModeOption", false);

	if(location === LOCATION_MH || location === LOCATION_TEST_PAGE){
		ruineExplorerMappingBtns = document.createElement("div");
		ruineExplorerMappingBtns.id = "ruineExplorerMappingBtns";

		let notDirectionsBtnGrp = document.createElement("div");
		let doorsBtnGrp = document.createElement("span");
		let openBtn = document.createElement("button");
		openBtn.classList = "inline";
		openBtn.title = "Ajouter une porte ouverte";
		let openImg = document.createElement("img");
		openImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/small_enter.gif";
		openImg.alt = "O";
		openImg.style.margin = "0";
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
		zombiesBtnGrp.classList = "no-wrap";
		let zombiesMinusBtn = document.createElement("button");
		zombiesMinusBtn.classList = "inline";
		let zombiesMinusTxt = document.createElement("div");
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
		zombiesBtnGrp.appendChild(zombieIcon);
		let zombiesPlusBtn = document.createElement("button");
		zombiesPlusBtn.classList = "inline";
		let zombiesPlusTxt = document.createElement("div");
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
		let resetBtn = document.createElement("button");
		resetBtn.id = "ruineExplorerClearBtn";
		resetBtn.classList = "inline";
		resetBtn.title = "Supprimer la carte";
		let resetImg = document.createElement("img");
		resetImg.src = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/small_arma.gif";
		resetImg.alt = "Reset";
		resetImg.style.margin = "0";
		resetBtn.appendChild(resetImg);
		let resetTxt = document.createElement("span");
		resetTxt.textContent = "Supprimer la carte";
		resetBtn.appendChild(resetTxt);
		resetBtn.addEventListener("click", () => {
			if(confirm("Supprimer la carte ?")){
				GM_setValue("map", undefined);
			}
		});
		resetBtnGrp.appendChild(resetBtn);
		notDirectionsBtnGrp.appendChild(resetBtnGrp);
		ruineExplorerMappingBtns.appendChild(notDirectionsBtnGrp);

		directionMappingButtons = {};
		let directionsFlexElt = document.createElement("div");
		let directionsBtnGrp = document.createElement("div");
		directionsBtnGrp.appendChild(document.createElement("div"));
		let northBtn = document.createElement("button");
		directionMappingButtons[NORTH] = northBtn;
		northBtn.classList = "inline";
		let northTxt = document.createElement("div");
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
		let allDirectionsTxt = document.createElement("div");
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
		let eastTxt = document.createElement("div");
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
		let southTxt = document.createElement("div");
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
		ruineExplorerMappingBtns.appendChild(directionsFlexElt);
		
		if(location === LOCATION_TEST_PAGE || !phoneModeOption){
			ruineExplorerMenu.appendChild(ruineExplorerMappingBtns);
		}
		if(location === LOCATION_MH){
			GM_addValueChangeListener("phoneModeOption", (_a, _b, newValue) => {
				if(newValue){
					let map = document.querySelector(".ruin_map_area .map");
					if(map !== null){
						map.appendChild(mapGrid);
					}else if(mapGrid.parentElement !== null){
						mapGrid.parentElement.removeChild(mapGrid);
					}
					let ruinMapArea = document.querySelector(".ruin_map_area");
					if(ruinMapArea !== null){
						ruinMapArea.parentElement.parentElement.after(ruineExplorerMappingBtns);
					}
				}else{
					optionsSection.before(ruineExplorerMappingBtns);
					optionsSection.before(mapGrid);
				}
			});
		}

		document.body.addEventListener("keydown", e => {
			if(document.querySelector(".zone-plane-ui") === null){
				// Do nothing if we're not in the ruin
				return;
			}
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
	}else if(location === LOCATION_BBH || location === LOCATION_GH){
		let importExportBtns = document.createElement("div");
		let importBtn = document.createElement("button");
		importBtn.textContent = "Importer";
		importBtn.addEventListener("click", () => {
			if(confirm("Cela va écraser la carte de Ruine Explorer: Dug par celle de " + (location === LOCATION_BBH ? "BigBroth'Hordes" : "Gest'Hordes") + ". Êtes-vous sûr ?")){
				importMap();
			}
		});
		importExportBtns.appendChild(importBtn);
		if(location === LOCATION_BBH){
			let exportReplaceBtn = document.createElement("button");
			exportReplaceBtn.textContent = "Exporter (remplacer)";
			exportReplaceBtn.addEventListener("click", () => exportMap(true));
			importExportBtns.appendChild(exportReplaceBtn);
			let exportCompleteBtn = document.createElement("button");
			exportCompleteBtn.textContent = "Exporter (compléter)";
			exportCompleteBtn.addEventListener("click", () => exportMap(false));
			importExportBtns.appendChild(exportCompleteBtn);
		}
		ruineExplorerMenu.appendChild(importExportBtns);
	}

	mapGrid = document.createElement("div");
	mapGrid.id = "ruineExplorerMapGrid";
	for(let i = 0; i < MAP_WIDTH*MAP_HEIGHT; i++){
		let div = document.createElement("div");
		mapGrid.appendChild(div);
	}
	writeMap();
	if(!(location === LOCATION_MH && phoneModeOption)){
		ruineExplorerMenu.appendChild(mapGrid);
	}

	let phoneModeLbl = document.createElement("label");
	phoneModeLbl.textContent = "Mode téléphone";
	phoneModeLbl.htmlFor = "ruineExplorerPhoneModeChb";
	optionsSection.appendChild(phoneModeLbl);
	let phoneModeChb = document.createElement("input");
	phoneModeChb.id = "ruineExplorerPhoneModeChb";
	phoneModeChb.type = "checkbox";
	phoneModeChb.checked = phoneModeOption;
	phoneModeChb.addEventListener("change", () => {
		GM_setValue("phoneModeOption", phoneModeChb.checked);
	});
	optionsSection.appendChild(phoneModeChb);
	ruineExplorerMenu.appendChild(optionsSection);

	document.body.appendChild(ruineExplorerMenu);

	let stylesheet = document.createElement("style");
	stylesheet.type = "text/css";
	stylesheet.innerText = `
		#ruineExplorerMenu {
			position: fixed;
			left: 2%;
			background-color: rgb(205, 159, 110);
			border-radius: 10px 10px 0px 0px;
			transition: transform 0.5s linear 0s;
			width: calc((100% - 950px)/2 - 4%);
			max-width: ${MAP_WIDTH*22}px;
			min-width: ${MAP_WIDTH*11}px;
			bottom: 0;
		}

		#ruineExplorerMenu.folded {
			transform: translateY(calc(100% - 2em));
		}

		#ruineExplorerMenu > div:not(:first-child):not(:last-child) {
			border-bottom: 1px solid black;
		}

		#ruineExplorerMenu > div:first-child {
			color: white;
			background-color: #714526;
			padding: 5px;
			border-radius: 10px 10px 0px 0px;
			text-align: center;
			cursor: pointer;
		}

		#ruineExplorerMenu > div:nth-child(2) {
			text-align: center;
		}

		#ruineExplorerMenu > div:nth-child(2) button {
			float: right;
		}

		#ruineExplorerMappingBtns {
			display: flex;
			width: 100%;
		}

		#ruineExplorerClearBtn span {
			display: none;
		}

		.all-invisible-except-clear-btn #ruineExplorerClearBtn span {
			display: inline;
		}

		#ruineExplorerMappingBtns.all-invisible-except-clear-btn {
			display: block;
		}

		.all-invisible-except-clear-btn :not(:has(#ruineExplorerClearBtn)):not(#ruineExplorerClearBtn):not(#ruineExplorerClearBtn *) {
			display: none !important;
		}

		#ruineExplorerMappingBtns button > div {
			text-align: center;
			width: 16px;
			height: 16px;
		}

		.manual-background #ruineExplorerMappingBtns {
			background-color: #7e4d2a;
			border: 1px solid #efdba8;
			border-radius: 8px;
			margin: 3px;
			width: unset;
		}

		#ruineExplorerMappingBtns > div:first-child {
			display: flex;
			flex-wrap: wrap;
		}

		#ruineExplorerMappingBtns > div:first-child > * {
			margin-left: 1%;
			margin-right: 1%;
		}

		#ruineExplorerMappingBtns > div:last-child > div {
			display: grid;
			grid-template-columns: 1fr 1fr 1fr;
			grid-template-rows: 1fr 1fr 1fr;
			position: relative; top: 50%;
			transform: translateY(-50%);
		}

		#ruineExplorerMappingBtns > div:last-child button {
			margin-top: 0;
		}

		.no-wrap {
			white-space: nowrap;
		}

		#ruineExplorerMapGrid {
			display: grid;
			grid-template-columns: repeat(${MAP_WIDTH}, 1fr);
			grid-template-rows: repeat(${MAP_HEIGHT}, 1fr);
			aspect-ratio: ${MAP_WIDTH} / ${MAP_HEIGHT};
			column-gap: 0;
			row-gap: 0;
			width: 100%;
		}

		#ruineExplorerMapGrid div {
			position: relative;
		}

		:where(.ruin_map_area, hordes-map) #ruineExplorerMapGrid {
			position: absolute;
			z-index: 2;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			width: 66%;
		}

		#ruineExplorerMenu svg {
			fill: white;
			stroke: black;
			stroke-width: 5;
		}

		:where(.ruin_map_area, hordes-map) #ruineExplorerMapGrid svg {
			fill: rgba(0, 0, 0, 0.5);
			stroke: white;
			stroke-width: 10;
		}

		#ruineExplorerMapGrid .z1 svg {
			fill: yellow;
		}

		#ruineExplorerMapGrid .z2 svg {
			fill: orange;
		}

		#ruineExplorerMapGrid .z3 svg {
			fill: red;
		}

		#ruineExplorerMapGrid .z4 svg {
			fill: violet;
		}

		#ruineExplorerMapGrid .t0 svg {
			stroke: red;
		}

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
	if(location === LOCATION_MH && GM_getValue("phoneModeOption", false)){
		let map = document.querySelector(".ruin_map_area .map");
		if(map !== null && map.children.namedItem("ruineExplorerMapGrid") === null){
			map.appendChild(mapGrid);
		}
		let ruinMapArea = document.querySelector(".ruin_map_area");
		if(ruinMapArea !== null && ruinMapArea.parentElement.parentElement.parentElement.children.namedItem("ruineExplorerMappingBtns") === null){
			ruinMapArea.parentElement.parentElement.after(ruineExplorerMappingBtns);
		}
	}
	let zonePlaneUi = document.querySelector(".zone-plane-ui");
	if(ruineExplorerMappingBtns !== null){
		if(zonePlaneUi === null){
			ruineExplorerMappingBtns.classList.add("all-invisible-except-clear-btn");
		}else{
			ruineExplorerMappingBtns.classList.remove("all-invisible-except-clear-btn");
		}
	}
	if(zonePlaneUi === null){
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
	}
	for(let actionMove of document.querySelectorAll(".zone-plane-controls > .action-move:not(.redu-listened)")){
		let deltaX = actionMove.getAttribute("x-direction-x");
		let deltaY = actionMove.getAttribute("x-direction-y"); // Y axis is reversed between MyHordes and REDU (In MyHordes +1 is North, while it's South in REDU)
		if(deltaX === null || deltaY === null){
			continue;
		}
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
			map[position[2]][position[1]][position[0]].trust = 1;
			GM_setValue("position", position);
			GM_setValue("map", map);
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
	let enterRoomBtn = document.querySelector("#shift_button:not(.redu-listened)");
	if(enterRoomBtn !== null){
		enterRoomBtn.addEventListener("click", () => {
			let position = GM_getValue("position", [ENTRANCE_X_POSITION, 0, 0]);
			let map = GM_getValue("map");
			map[position[2]][position[1]][position[0]].door = OPEN;
			GM_setValue("map", map);
		});
		enterRoomBtn.classList.add("redu-listened");
	}
	let unlockRoomBtn = document.querySelector("#unlock_button:not(.redu-listened)");
	if(unlockRoomBtn !== null){
		unlockRoomBtn.addEventListener("click", () => {
			let position = GM_getValue("position", [ENTRANCE_X_POSITION, 0, 0]);
			let map = GM_getValue("map");
			if(map[position[2]][position[1]][position[0]].door === NOTHING){
				map[position[2]][position[1]][position[0]].door = LOCKED_UNKNOWN;
				GM_setValue("map", map);
			}
		});
		unlockRoomBtn.classList.add("redu-listened");
	}
}

GM_addValueChangeListener("position", writeMap);
GM_addValueChangeListener("position", updatePosition);
GM_addValueChangeListener("map", writeMap);

main();

new MutationObserver(main).observe(document.body, {childList: true, subtree: true}); // TODO: Optimize this
