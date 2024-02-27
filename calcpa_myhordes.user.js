// ==UserScript==
// @name     CalcPA for MyHordes
// @version  0.7
// @author   LcsTen
// @grant    none
// @match    https://myhordes.de/*
// @match    https://myhordes.eu/*
// @match    https://armageddhordes.adri-web.dev/*
// ==/UserScript==

"use strict";

const FOOD6 = ["food_chick", "food_tarte", "can_open", "food_bar3", "food_sandw", "omg_this_will_kill_you", "vegetable", "food_bar2", "food_noodles",
	       "bone_meat", "food_bar1", "food_biscuit", "food_pims", "dish", "fruit", "hmeat", "undef", "bretz"];
const FOOD7 = ["dish_tasty", "cadaver", "chama_tasty", "vegetable_tasty", "food_noodles_hot", "egg", "food_candies", "apple", "meat", "woodsteak"];
const WATER = ["water_can_1", "water_can_2", "water_can_3", "water_cup", "potion", "water"];
const RANDOM_DRUG = ["beta_drug_bad", "drug_random", "lsd"];
const ALCOHOL = ["hmbrew", "vodka", "rhum", "fest", "guiness", "vodka_de"];
const RANDOM_GAME = ["dice", "cards"];

let armageddhordes = document.title.includes("Armagedd'Hordes");
let itemSrcPrefix = "/build/images/item/item_";
let apMultiplier = 1 + armageddhordes;
let apImg = '<img src="https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/icons/ap_small_fr.gif" alt="AP">';

function getImgOf(item){
	return `<img src="${itemSrcPrefix}${item.name}.${item.key}.gif" alt="${item.name}">`;
}

function intersect(a, b){
	let res = [];
	for(let i = 0;i < a.length;i++){
		if(b.includes(a[i].name)){
			res.push(a[i]);
		}
	}
	return res;
}

function unique(array){
	let res = [];
	for(let i = 0;i < array.length;i++){
		let alreadyHere = false;
		for(let j = 0;j < i && !alreadyHere;j++){
			alreadyHere = (array[i] === array[j]);
		}
		if(!alreadyHere){
			res.push(array[i]);
		}
	}
	return res;
}

function main(){
	let inventory = [];
	document.querySelectorAll("#gma .rucksack li span img").forEach(item => {
		let match = item.src.match(/item_([^.]*)\.([^.]*)/);
		inventory.push({
			name: match[1],
			key: match[2]
		});
	});
	let states = [];
	document.querySelectorAll("#gma ul.status li img").forEach(item => {
		let match = item.src.match(/status_([^.]*)\.([^.]*)/);
		states.push({
			name: match[1],
			key: match[2]
		});
	});
	let currentAP = +document.querySelector(".ap li b").textContent;
	let canEat = (intersect(states, ["haseaten"]).length === 0);
	let food6 = intersect(inventory, FOOD6);
	let food7 = intersect(inventory, FOOD7);
	let willGetAPFromDrink = (intersect(states, ["hasdrunk", "thirst2", "ghoul"]).length === 0);
	let water = intersect(inventory, WATER);
	let canDrinkAlcohol = (intersect(states, ["drunk", "hungover"]).length === 0);
	let alcohol = intersect(inventory, ALCOHOL);
	let randomDrugs = intersect(inventory, RANDOM_DRUG);
	let randomGames = unique(intersect(inventory, RANDOM_GAME));
	let coffees = intersect(inventory, ["coffee"]);
	let isWounded = (intersect(states, ["wound1", "wound2", "wound3", "wound4", "wound5", "wound6"]).length !== 0);
	let sportElec = intersect(inventory, ["sport_elec"]);
	let stero = intersect(inventory, ["drug"]);
	let twinoid = intersect(inventory, ["drug_hero"]);
	let christmasChoco = intersect(inventory, ["christmas_candy"]);
	
	let div = document.querySelector("#calcpa");
	if(div === null){
		div = document.createElement("div");
		div.id = "calcpa";
		div.classList.add("note");
	}
	let summary = "";
	let minAP = 0;
	let maxAP = 0;
	let sources = [
		{canUse: canEat, ap: (7-isWounded)*apMultiplier, items: food7, multiple: false, random: false},
		{canUse: (canEat && food7.length === 0), ap: (6-isWounded)*apMultiplier, items: food6, multiple: false, random: false},
		{canUse: willGetAPFromDrink, ap: (6-isWounded)*apMultiplier, items: water, multiple: false, random: false},
		{canUse: canDrinkAlcohol, ap: (6-isWounded)*apMultiplier, items: alcohol, multiple: false, random: false},
		{canUse: true, ap: (7-isWounded)*apMultiplier, items: randomDrugs, multiple: true, random: true},
		{canUse: true, ap: 1*apMultiplier, items: randomGames, multiple: true, random: true},
		{canUse: true, ap: 4*apMultiplier, items: coffees, multiple: true, random: false},
		{canUse: !isWounded, ap: 5*apMultiplier, items: sportElec, multiple: false, random: false},
		{canUse: true, ap: (6-isWounded)*apMultiplier, items: stero, multiple: true, random: false},
		{canUse: true, ap: (8-isWounded)*apMultiplier, items: twinoid, multiple: true, random: false},
		{canUse: true, ap: 8*apMultiplier, items: christmasChoco, multiple: true, random: false}
	];
	if(currentAP > 0){
		summary += `${apImg} (${currentAP})`;
		minAP += currentAP;
		maxAP += currentAP;
	}
	for(let source of sources){
		if(source.canUse && source.items.length > 0){
			if(summary !== ""){
				summary += " + ";
			}
			let totalAP;
			if(source.items.length > 1 && source.multiple){
				summary += source.items.length+'*';
				totalAP = source.items.length*source.ap;
			}else{
				totalAP = source.ap;
			}
			summary += getImgOf(source.items[0]);
			if(source.random){
				summary += `(0-${totalAP})`;
			}else{
				summary += `(${totalAP})`;
				minAP += totalAP;
			}
			maxAP += totalAP;
		}
	}
	if(minAP !== maxAP){
		div.innerHTML = `Vous possédez de <strong>${minAP}</strong> à <strong>${maxAP}</strong> ${apImg} potentiels.`;
	}else{
		div.innerHTML = `Vous possédez <strong>${minAP}</strong> ${apImg} potentiels.`;
	}
	div.innerHTML += "<br>"+summary;
	document.querySelector(".padded.cell.rw-8 .row .cell.rw-12").after(div);
}

new MutationObserver(() => {
	main();
	let node;
	if(node = document.querySelector("#beyond_desert_content")){
		new MutationObserver(main).observe(node, {childList: true});
	}
	if(node = document.querySelector("#header-rucksack-items")){
		new MutationObserver(main).observe(node, {childList: true});
	}
	if(node = document.querySelector("#inventory_partial_html")){
		new MutationObserver(main).observe(node, {childList: true});
	}
}).observe(document.querySelector("#content"), {childList: true});
