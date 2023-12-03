// ==UserScript==
// @name     Infobulle++ for MyHordes
// @version  0.11113
// @grant    none
// @match    https://myhordes.de/*
// @match    https://myhordes.eu/*
// @grant    unsafeWindow
// ==/UserScript==

"use strict";

// Image retrievement related functions and constants

const GITLAB_IMG_BASE_URL = "https://gitlab.com/eternaltwin/myhordes/myhordes/-/raw/master/assets/img/";
const ITEM_IMG_BASE_URL = GITLAB_IMG_BASE_URL+"item/item_";
const ICON_IMG_BASE_URL = GITLAB_IMG_BASE_URL+"icons/";
const STATUS_IMG_BASE_URL = GITLAB_IMG_BASE_URL+"status/status_";

function imageOf(baseURL, thing){
	return `<img src="${baseURL}${thing}.gif" alt="${thing}" style="height: 15px; position: relative; bottom: 2px">`;
}

function imageOfIcon(icon){
	return imageOf(ICON_IMG_BASE_URL, icon);
}

function imageList(baseURL, list, separator){
	let res = "";
	for(let i = 0;i < list.length;i++){
		if(i !== 0){
			res += separator;
		}
		res += imageOf(baseURL, list[i]);
	}
	return res;
}

function itemList(items, separator = ", "){
	return imageList(ITEM_IMG_BASE_URL, items, separator);
}

function imageOfDefault(thing){
	let baseUrl;
	if(thing.startsWith("item_")){
		baseUrl = ITEM_IMG_BASE_URL;
		thing = thing.substring(5);
	}else if(thing.startsWith("status_")){
		baseUrl = STATUS_IMG_BASE_URL;
		thing = thing.substring(7);
	}else{
		baseUrl = ICON_IMG_BASE_URL;
	}
	return imageOf(baseUrl, thing);
}

function defaultList(list, separator = ", "){
	let res = "";
	for(let i = 0;i < list.length;i++){
		if(i !== 0){
			res += separator;
		}
		res += imageOfDefault(list[i]);
	}
	return res;
}

function statusList(statuses, separator = ", "){
	return imageList(STATUS_IMG_BASE_URL, statuses, separator);
}

function imageOfItem(item){
	return imageOf(ITEM_IMG_BASE_URL, item);
}

// Item information related classes, functions and constants

const NEVER = 0;
const EXISTING_TOOLTIP = 1;
const NEW_TOOLTIP = 2;
const ALWAYS = EXISTING_TOOLTIP | NEW_TOOLTIP;

class Info {
	style(){
		return [];
	}
	
	display(){
		return "";
	}
	
	when(){
		return ALWAYS;
	}
};

class SimpleInfo extends Info {
	constructor(style, display, when = ALWAYS){
		super();
		this._style = style;
		this._display = display;
		this._when = when;
	}
	
	style(){
		return this._style;
	}
	
	display(){
		return this._display;
	}
	
	when(){
		return this._when;
	}
};

class InfoHelp extends Info {
	style(){
		return ["item-tag-information", "item-tag-help"];
	}
};

class InfoMore extends Info {
	style(){
		return ["item-tag-information", "item-tag-more"];
	}
};

class Resource extends Info {
	constructor(nb){
		super();
		this.nb = nb;
	}
	
	style(){
		return "item-tag-resource";
	}
	
	display(){
		return `Ressource <em>(${this.nb} chantiers)</em>`;
	}
};

function resource(nb){
	return new Resource(nb);
}

class ApSource extends Info {
	constructor(nb){
		super();
		this.nb = nb;
	}
	
	style(){
		return "item-tag-ap-source";
	}
	
	display(){
		return `Source de PA <em>(+${this.nb} points)</em>`;
	}
};

function apSource(nb){
	return new ApSource(nb);
}

class PoisonableWith extends InfoHelp {
	constructor(items){
		super();
		this.items = items;
	}
	
	display(){
		return `S'empoisonne avec : ${itemList(this.items)}`;
	}
};

function poisonableWith(...items){
	return new PoisonableWith(items);
}

class Causes extends InfoHelp {
	constructor(statuses){
		super();
		this.statuses = statuses;
	}
	
	display(){
		return `Provoque : ${defaultList(this.statuses)}`;
	}
};

function causes(...statuses){
	return new Causes(statuses);
}

class UsedWith extends Info {
	constructor(items){
		super();
		this.items = items;
	}
	
	style(){
		return ["item-tag-information", "item-tag-help", "item-tag-long-lines"];
	}
	
	display(){
		return `S'utilise avec : ${itemList(this.items)}`;
	}
};

function usedWith(...items){
	return new UsedWith(items);
}

class OpenGives extends Info {
	constructor(itemGroups){
		super();
		this.itemGroups = itemGroups;
	}
	
	style(){
		return ["item-tag-information", "item-tag-more", "item-tag-long-lines"];
	}
	
	display(item){
		let res = `Ouvrir : ${imageOfItem(item)} = `;
		for(let i = 0;i < this.itemGroups.length;i++){
			let group = this.itemGroups[i];
			if(i !== 0){
				res += " + ";
			}
			res += itemList(group);
		}
		return res;
	}
};

function openGives(...itemGroups){
	for(let i = 0;i < itemGroups.length;i++){
		if(!Array.isArray(itemGroups[i])){
			itemGroups[i] = [itemGroups[i]];
		}
	}
	return new OpenGives(itemGroups);
}

class OpenWith extends InfoHelp {
	constructor(ways){
		super();
		this.ways = ways;
	}
	
	display(){
		return `S'ouvre avec : ${defaultList(this.ways)}`;
	}
};

function openWith(...ways){
	return new OpenWith(ways);
}

class WatchWeapon extends Info {
	constructor(nb){
		super();
		if(Number.isNaN(+nb) || nb > 0){
			nb = '+'+nb;
		}
		this.nb = nb;
	}
	
	style(){
		return "item-tag-weapon";
	}
	
	display(){
		return `Arme veilleur <em>(${this.nb} pts attaque)</em>`;
	}
	
	when(){
		return NEW_TOOLTIP;
	}
};

function watchWeapon(nb){
	return new WatchWeapon(nb);
}

class Weapon extends Info {
	constructor(nb, proba = null){
		super();
		this.nb = nb;
		this.proba = proba;
	}
	
	style(){
		return "item-tag-weapon";
	}
	
	display(){
		return `Arme <em>(${this.nb} ${imageOfIcon("small_zombie")}${this.proba !== null ? `, ${this.proba}%` : ""})</em>`;
	}
};

class Assemble extends InfoMore {
	constructor(others, results){
		super();
		this.others = others;
		this.results = results;
	}

	style(){
		return [...super.style(), "item-tag-long-lines"];
	}
	
	display(item){
		return `Assembler : ${imageOfItem(item)} + ${itemList(this.others, " + ")} = ${itemList(this.results)}`;
	}
};

function assemble(others, results){
	if(!Array.isArray(others)){
		others = [others];
	}
	if(!Array.isArray(results)){
		results = [results];
	}
	return new Assemble(others, results);
}

class Opens extends InfoHelp {
	constructor(items){
		super();
		this.items = items;
	}
	
	display(){
		return `Ouvre : ${itemList(this.items)}`;
	}
};

function opens(...items){
	return new Opens(items);
}

class BackpackExtension extends Info {
	constructor(nb){
		super();
		this.nb = nb;
	}
	
	style(){
		return "item-tag-backpack-extension";
	}
	
	display(){
		return `Extension de sac <em>(+${this.nb} emplacements)</em>`;
	}
};

function backpackExtension(nb){
	return new BackpackExtension(nb);
}

class Heals extends InfoMore {
	constructor(statuses){
		super();
		this.statuses = statuses;
	}
	
	display(){
		return `Soigne : ${statusList(this.statuses)}`;
	}
};

function heals(...statuses){
	return new Heals(statuses);
}

class Decoration extends Info {
	constructor(nb){
		super();
		this.nb = nb;
	}
	
	style(){
		return "item-tag-decoration";
	}
	
	display(){
		return `Objet de décoration <em>(+${this.nb} pts)</em>`;
	}
};

function decoration(nb){
	return new Decoration(nb);
}

class Butcher extends InfoMore {
	constructor(items){
		super();
		this.items = items;
	}
	
	display(item){
		return `Découper : ${imageOfItem(item)} = ${itemList(this.items, " + ")}`;
	}
};

function butcher(...items){
	return new Butcher(items);
}

class TransformInto extends InfoMore {
	constructor(items){
		super();
		this.items = items;
	}
	
	display(item){
		return `${imageOfItem(item)} + ${imageOfIcon("small_refine")} = ${itemList(this.items)}`;
	}
};

function transformInto(...items){
	return new TransformInto(items);
}

class MayCause extends Info {
	constructor(statusProba){
		super();
		this.statusProba = statusProba;
	}

	style(){
		return ["item-tag-information", "item-tag-help", "item-tag-long-lines"];
	}

	display(){
		let res = "Peut provoquer : ";
		let i = 0;
		for(let status in this.statusProba){
			if(i !== 0){
				res += ", ";
			}
			res += `${imageOfDefault(status)} (${this.statusProba[status]}%)`;
			i++;
		}
		return res;
	}
};

class ClearDust extends Info {
	constructor(nb){
		super();
		this.nb = nb;
	}
	
	style(){
		return ["item-tag-information", "item-tag-clear-dust"];
	}
	
	display(){
		return `Déblaye ${this.nb} tas`;
	}
};

class ControlRecovery extends Info {
	constructor(nb){
		super();
		this.seconds = nb%60;
		this.minutes = Math.floor(nb/60);
	}
	
	style(){
		return ["item-tag-information", "item-tag-control-recovery"];
	}
	
	display(){
		return `Reprise de contrôle pendant${this.minutes > 0 ? ` ${this.minutes} minutes` : ""}${this.seconds > 0 ? ` ${this.seconds} secondes` : ""}`;
	}
};

class CanPoison extends Info {
	constructor(...items){
		super();
		this.items = items;
	}
	
	style(){
		return ["item-tag-information", "item-tag-poisonable"];
	}
	
	display(){
		return `Peut empoisonner: ${itemList(this.items)}`;
	}
};

class Becomes extends Info {
	constructor(items, proba = null){
		super();
		if(!Array.isArray(items)){
			this.items = [items];
		}else{
			this.items = items;
		}
		this.proba = proba;
	}

	style(){
		return ["item-tag-information", "item-tag-more"];
	}

	display(){
		return "Devient : "+defaultList(this.items)+(this.proba !== null ? ` (${this.proba}%)` : "");
	}
};

class Breakable extends Info {
	constructor(proba = null){
		super();
		this.proba = proba;
	}

	style(){
		return ["item-tag-dangerous", "item-tag-breakable"];
	}

	display(){
		return "Objet cassable"+(this.proba !== null ? ` <em>(${this.proba}%)</em>` : "");
	}
};

class Special extends Info {
	constructor(explanation){
		super();
		this.explanation = explanation;
	}
	
	style(){
		return ["item-tag-information", "item-tag-help"];
	}
	
	display(){
		return "<strong>Spécial: </strong> "+this.explanation;
	}
};

const WATER = new SimpleInfo("item-tag-water", "Eau");
const POISONABLE = new SimpleInfo(["item-tag-dangerous", "item-tag-poisonable"], "Objet empoisonnable");
const OPENABLE = new SimpleInfo("item-tag-openable", "Objet à ouvrir");
const FOOD = new SimpleInfo("item-tag-food", "Nourriture");
const COOKABLE = new SimpleInfo("item-tag-cookable", "Objet cuisinable");
const TO_ASSEMBLE = new SimpleInfo("item-tag-to-assemble", "Objet à assembler");
const BULKY = new SimpleInfo("item-tag-heavy", "Objet encombrant", NEW_TOOLTIP);
const DRUG = new SimpleInfo("item-tag-drug", "Drogue");
const HEAL_ITEM = new SimpleInfo("item-tag-heal-item", "Objet de soin");
const HOME_ITEM = new SimpleInfo("item-tag-deco", "Aménagement de maison", NEW_TOOLTIP);
const RP_ITEM = new SimpleInfo("item-tag-rp-item", 'Objet "RP"');
const DEFENSE_ITEM = new SimpleInfo("item-tag-defense", "Objet de défense", NEW_TOOLTIP);
const CAMPING_ITEM = new SimpleInfo("item-tag-camping-item", "Objet pour le camping");
const ANIMAL = new SimpleInfo("item-tag-animal", "Animal");
const TRANSFORMABLE = new SimpleInfo("item-tag-transformable", "Objet transformable");
const ALCOHOL = new SimpleInfo("item-tag-alcohol", "Alcool");
const EVENT_ITEM = new SimpleInfo("item-tag-event-iem", "Objet évenementiel");
const SHUNNED_ITEM = new SimpleInfo("item-tag-shunned-item", "Objet de banni");
const BLUEPRINT = new SimpleInfo("item-tag-blueprint", "Plan de chantier");
const RUIN_ITEM = new SimpleInfo("item-tag-ruin-item", "Objet de ruine");
const REPAIR = new SimpleInfo(["item-tag-information", "item-tag-repair"], "Répare les objets cassés");
const DISCOVER_ZONE = new SimpleInfo(["item-tag-information", "item-tag-discover-zone"], "Dévoile les zones environnantes");
const PURIFIABLE = new SimpleInfo(["item-tag-information", "item-tag-purifiable"], "Se purifie au Hamâme");

const items = {
	water: [resource(25), apSource(6), WATER, POISONABLE, poisonableWith("poison"), causes("status_hasdrunk"), usedWith("watergun_opt_empty", "grenade_empty", "bgrenade_empty", "watergun_empty", "concrete", "spices", "water_can_empty", "water_can_1", "water_can_2", "infect_poison_part")],
	pile: [resource(4), usedWith("lamp", "music_part", "coffee_machine", "radio_off", "mixergun_empty", "chainsaw_empty", "pilegun_empty", "taser_empty", "sport_elec_empty", "big_pgun_empty", "vibr_empty", "radius_mk2_part", "pilegun_up_empty", "poison_part", "maglite_off", "maglite_1", "lpoint")],
	can: [OPENABLE, openGives("can_open"), openWith("small_refine", "item_screw", "item_swiss_knife", "item_can_opener", "item_saw_tool")],
	can_open: [watchWeapon(2), apSource(6), FOOD, COOKABLE, POISONABLE, poisonableWith("poison"), causes("status_haseaten"), usedWith("food_xmas")],
	pilegun: [watchWeapon(10), new Weapon(1, 95), new Becomes("item_pilegun_empty")],
	taser: [watchWeapon(4), new Weapon(1, 50), new Becomes("taser_empty", 80)],
	water_gun_opt_empty: [TO_ASSEMBLE, assemble("water", "water_gun_opt_5")],
	mixergun: [watchWeapon(9), new Weapon(1), opens("chest_tools", "chest_food"), new Becomes("mixergun_empty", 40)],
	chainsaw: [BULKY, watchWeapon(30), new Weapon(3), new Becomes("chainsaw_empty", 30)],
	lawn: [BULKY, watchWeapon(15), new Weapon(2), new Breakable(15), opens("chest_tools")],
	wrench: [watchWeapon(2), new Weapon(1, 50), new Breakable(33), opens("chest_tools", "chest_food")],
	screw: [watchWeapon(5), new Weapon(1, 25), new Breakable(50), opens("can", "chest", "chest_xl", "chest_tools", "chest_food", "catbox")],
	staff: [watchWeapon(4), new Weapon(1, 33), opens("chest_tools", "chest_food"), new Becomes("item_staff2", 58)], // 70/120
	knife: [watchWeapon(10), new Weapon(1), new Breakable(20), opens("chest_tools", "chest_food")],
	cutcut: [watchWeapon(5), new Weapon(2), new Breakable(25), opens("chest_tools", "chest_food")],
	small_knife: [watchWeapon(5), new Weapon(1, 33), new Breakable(50), usedWith("pumpkin_raw"), opens("chest_tools")],
	swiss_knife: [watchWeapon(10), new Weapon(1, 33), new Breakable(50), opens("can", "chest", "chest_xl", "chest_tools", "chest_food")],
	cutter: [watchWeapon(10), new Weapon(1, 50), new Breakable(90), usedWith("pet_snake2"), opens("chest_tools", "chest_food")],
	cart: [BULKY, watchWeapon(20), backpackExtension(2)],
	can_opener: [watchWeapon(4), new Weapon(1, 33), new Breakable(100), opens("can", "chest", "chest_xl", "chest_tools", "chest_food", "catbox")],
	bag: [backpackExtension(1)],
	lights: [TO_ASSEMBLE, assemble("wood_bad", "torch"), usedWith("pumpkin_off")],
	xanax: [DRUG, HEAL_ITEM, heals("terror"), causes("status_drugged")],
	chair: [BULKY, watchWeapon(15), HOME_ITEM, decoration(5)],
	rp_book: [RP_ITEM],
	bed: [BULKY, DEFENSE_ITEM, watchWeapon(25), HOME_ITEM, decoration(5), CAMPING_ITEM],
	lamp: [watchWeapon(4), HOME_ITEM, decoration(1), TO_ASSEMBLE, assemble("pile", "lamp_on")],
	carpet: [BULKY, watchWeapon(8), HOME_ITEM, decoration(10)],
	music_part: [BULKY, HOME_ITEM, decoration(1), TO_ASSEMBLE, assemble(["pile", "electro"], "music")],
	lock: [HOME_ITEM, new Special("Empêche les vols")],
	door_carpet: [HOME_ITEM, decoration(5), usedWith("claymo")],
	dice: [apSource("0, 1")],
	engine: [BULKY, watchWeapon(30), resource(2), usedWith("chainsaw_part")],
	courroie: [usedWith("chainsaw_part", "big_pgun_part")],
	meca_parts: [resource(42), usedWith("chainsaw_part", "mixergun_part", "lawn_part", "coffee_machine_part", "big_pgun_part", "saw_tool_part", "repair_kit_part_raw", "engine_part", "pilegun_upkit", "car_door_part", "wire", "diode")],
	pet_chick: [watchWeapon(8), new Weapon(1), ANIMAL, butcher("undef", "undef"), new Becomes("small_remove")],
	pet_pig: [BULKY, watchWeapon(20), new Weapon(1), ANIMAL, butcher("undef", "undef", "undef", "undef"), new Becomes("small_remove")],
	pet_rat: [watchWeapon(4), new Weapon(1), ANIMAL, butcher("undef", "undef"), new Becomes("small_remove")],
	pet_dog: [DEFENSE_ITEM, HOME_ITEM, new Weapon(1), ANIMAL, butcher("meat", "meat"), new Special("Empêche les vols"), new Becomes("small_remove", 5)],
	pet_cat: [watchWeapon(10), HOME_ITEM, new Weapon(1), ANIMAL, decoration(5), butcher("meat", "meat"), new Becomes("small_remove", 12)],
	pet_snake: [BULKY, watchWeapon(15), new Weapon(1), ANIMAL, butcher("meat", "meat", "meat", "meat"), new Becomes("small_remove")],
	vibr: [watchWeapon(-5), HEAL_ITEM, heals("terror"), new Becomes("vibr_empty")],
	drug: [apSource(6), DRUG, POISONABLE, poisonableWith("poison"), causes("status_drugged"), usedWith("infect_poison_part")],
	meat: [watchWeapon(4), apSource(7), FOOD, causes("status_haseaten")],
	undef: [watchWeapon(2), apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	sheet: [watchWeapon(10), CAMPING_ITEM],
	bagxl: [backpackExtension(2)],
	jerrycan: [TO_ASSEMBLE, assemble("water_cleaner", "water"), usedWith("jerrygun_part", "jerrygun_off")],
	wood2: [resource(53), TRANSFORMABLE, transformInto("wood_beam"), usedWith("wood_plate_part", "repair_kit_part_raw")],
	metal: [resource(54), TRANSFORMABLE, transformInto("metal_beam"), usedWith("lawn_part", "cart_part", "coffee_machine_part", "engine_part", "car_door_part")],
	grenade: [watchWeapon(8), new Weapon("2-4"), new Becomes("small_remove")],
	plate: [BULKY, DEFENSE_ITEM, HOME_ITEM, resource(13), CAMPING_ITEM],
	jerrygun_part: [TO_ASSEMBLE, assemble(["jerrycan", "rustine"], "jerrygun")],
	bandage: [HEAL_ITEM, heals("wound1"), causes("status_healed")],
	vodka: [apSource(6), ALCOHOL, causes("status_drunk"), usedWith("oilcan")],
	jerrygun_off: [TO_ASSEMBLE, assemble("jerrycan", "jerrygun")],
	explo: [resource(8), usedWith("deto", "wire")],
	hmeat: [watchWeapon(20), resource(3), apSource(6), FOOD, COOKABLE, causes("status_haseaten"), new MayCause({status_ghoul: 10})],
	grenade_empty: [TO_ASSEMBLE, assemble("water", "grenade"), usedWith("deto", "watergun_opt_part", "powder")],
	bgrenade: [watchWeapon(20), new Weapon("6-10"), new Becomes("small_remove")],
	bgrenade_empty: [TO_ASSEMBLE, assemble("water", "bgrenade")],
	chainsaw_part: [BULKY, TO_ASSEMBLE, assemble(["engine", "courroie", "meca_parts", "rustine"], "chainsaw_empty")],
	mixergun_part: [TO_ASSEMBLE, assemble(["meca_parts", "rustine", "electro"], "mixergun_empty")],
	rustine: [resource(3), usedWith("jerrygun_part", "chainsaw_part", "mixergun_part", "lawn_part", "cart_part", "coffee_machine_part", "deto", "watergun_opt_part", "saw_tool_part", "powder", "repair_kit_part_raw", "engine_part", "pilegun_upkit", "car_door_part", "wire")],
	lawn_part: [BULKY, TO_ASSEMBLE, assemble(["meca_parts", "metal", "rustine"], "lawn")],
	tube: [resource(15), usedWith("cart_part", "coffee_machine_part", "watergun_opt_part", "lens", "diode")],
	cart_part: [BULKY, TO_ASSEMBLE, assemble(["metal", "rustine", "tube"], "cart")],
	pocket_belt: [backpackExtension(1)],
	drug_hero: [apSource(8), DRUG, causes("status_drugged")],
	chest: [BULKY, watchWeapon(8), OPENABLE, openGives(["lights", "drug", "bandage", "vodka", "explo", "drug_hero", "rhum"]), openWith("small_refine", "item_screw", "item_swiss_knife", "item_can_opener", "item_saw_tool")],
	chest_xl: [BULKY, watchWeapon(10), OPENABLE, openGives(["cutcut", "chainsaw_part", "mixergun_part", "lawn_part", "pocket_belt", "big_pgun_part", "watergun_opt_part", "pilegun_upkit"]), openWith("small_refine", "item_screw", "item_swiss_knife", "item_can_opener", "item_saw_tool")],
	chest_tools: [BULKY, watchWeapon(5), OPENABLE, openGives(["pile", "meca_parts", "rustine", "tube", "explo", "pharma"]), openWith("small_refine", "item_mixergun", "item_lawn", "item_wrench", "item_screw", "item_staff", "item_knife", "item_cutcut", "item_small_knife", "item_swiss_knife", "item_cutter", "item_can_opener", "item_chair_basic", "item_bone", "item_chain", "item_pc")],
	lamp_on: [watchWeapon(10), HOME_ITEM, decoration(3)],
	music: [watchWeapon(-20), HOME_ITEM, decoration(10), usedWith("cdphil", "cdbrit", "cdelvi")],
	pharma: [resource(10), TO_ASSEMBLE, assemble("pharma", ["xanax", "drug", "drug_hero", "drug_water", "drug_random", "water_cleaner"]), usedWith("pharma", "coffee_machine", "poison_part", "infect_poison_part", "pumpkin_off")],
	plate_raw: [BULKY, TRANSFORMABLE, transformInto("plate")],
	rhum: [apSource(6), ALCOHOL, causes("status_drunk")],
	coffee: [apSource(4)],
	coffee_machine: [BULKY, HOME_ITEM, decoration(5), TO_ASSEMBLE, assemble(["pile", "pharma", "wood_bad"], "coffee")],
	coffee_machine_part: [BULKY, TO_ASSEMBLE, assemble(["meca_parts", "metal", "rustine", "tube", "electro", "cyanure"], "coffee_machine")],
	electro: [resource(13), usedWith("music_part", "mixergun_part", "coffee_machine_part", "pilegun_upkit")],
	chest_citizen: [BULKY, OPENABLE, openGives(["pile", "lights", "pharma", "radio_off"])],
	drug_water: [DRUG, HEAL_ITEM, heals("thirst1", "thirst2"), causes("status_drugged"), usedWith("infect_poison_part")],
	radio_off: [TO_ASSEMBLE, assemble("pile", "radio_on")],
	radio_on: [watchWeapon(-10), HOME_ITEM, resource(3), decoration(2)],
	cyanure: [causes("death"), usedWith("coffee_machine_part")],
	door: [BULKY, DEFENSE_ITEM, watchWeapon(10), HOME_ITEM, CAMPING_ITEM],
	vegetable: [apSource(6), FOOD, COOKABLE, POISONABLE, poisonableWith("poison"), causes("status_haseaten")],
	repair_kit_part: [TRANSFORMABLE, transformInto("repair_kit")],
	repair_kit: [REPAIR],
	watergun_empty: [TO_ASSEMBLE, assemble("water", "watergun_3")],
	watergun_opt_3: [watchWeapon(8), new Weapon(1), new Becomes("item_watergun_opt_2")],
	watergun_opt_2: [watchWeapon(8), new Weapon(1), new Becomes("item_watergun_opt_1")],
	watergun_opt_1: [watchWeapon(8), new Weapon(1), new Becomes("item_watergun_opt_empty")],
	mixergun_empty: [TO_ASSEMBLE, assemble("pile", "mixergun")],
	chainsaw_empty: [BULKY, TO_ASSEMBLE, assemble("pile", "chainsaw")],
	pilegun_empty: [TO_ASSEMBLE, assemble("pile", "pilegun"), usedWith("pilegun_upkit")],
	taser_empty: [TO_ASSEMBLE, assemble("pile", "taser")],
	sport_elec_empty: [TO_ASSEMBLE, assemble("pile", "sport_elec")],
	sport_elec: [apSource(5), causes("status_wound1"), new Becomes("sport_elec_empty")],
	big_pgun_empty: [TO_ASSEMBLE, assemble("pile", "big_pgun")],
	big_pgun: [watchWeapon(10), new Weapon(2), new Becomes("item_big_pgun_empty")],
	big_pgun_part: [TO_ASSEMBLE, assemble(["courroie", "meca_parts"], "big_pgun_empty")],
	tagger: [DISCOVER_ZONE],
	flare: [watchWeapon(-10)],
	jerrygun: [new Weapon(1), new Becomes("item_jerrygun_empty", 15)],
	chair_basic: [BULKY, watchWeapon(8), HOME_ITEM, new Weapon(1, 85), decoration(2), new Breakable(30), opens("chest_tools")],
	gun: [HOME_ITEM, decoration(5)],
	machine_gun: [HOME_ITEM, decoration(15)],
	deto: [resource(3), TO_ASSEMBLE, assemble(["explo", "grenade_empty", "rustine"], "bgrenade_empty"), usedWith("watergun_opt_part", "engine_part")],
	concrete: [BULKY, TO_ASSEMBLE, assemble("water", "concrete_wall")],
	concrete_wall: [BULKY, DEFENSE_ITEM, HOME_ITEM, resource(19), new Weapon(1), new Breakable(20)],
	drug_random: [apSource("0, 6, 7"), DRUG, new MayCause({status_drugged: 50, status_addict: 20, status_terror: 20})],
	disinfect: [DRUG, HEAL_ITEM, heals("infection"), causes("status_drugged", "status_immune")],
	digger: [new ClearDust("1-5")],
	chest_food: [BULKY, OPENABLE, openGives(["can", "meat", "hmeat", "vegetable", "food_bag", "vegetable_tasty"])],
	food_bag: [OPENABLE, openGives(["food_bar1", "food_bar2", "food_bar3", "food_biscuit", "food_chick", "food_pims", "food_tarte", "food_sandw", "food_noodles"])],
	food_bar1: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	food_bar2: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	food_bar3: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	food_biscuit: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	food_chick: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	food_pims: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	food_tarte: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	food_sandw: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	food_noodles: [apSource(6), FOOD, COOKABLE, causes("status_haseaten"), usedWith("spices")],
	spices: [TO_ASSEMBLE, assemble(["water", "food_noodles"], "food_noodles_hot")],
	food_noodles_hot: [apSource(7), FOOD, causes("status_haseaten")],
	cards: [apSource("0, 1"), new MayCause({status_terror: (1/53*100).toFixed(2)})],
	game_box: [OPENABLE, openGives(["dice", "cards"])],
	watergun_opt_part: [TO_ASSEMBLE, assemble(["grenade_empty", "rustine", "tube", "deto"], "watergun_opt_empty")],
	vibr_empty: [TO_ASSEMBLE, assemble("pile", "vibr")],
	bone_meat: [watchWeapon(10), resource(1), apSource(6), FOOD, COOKABLE, causes("status_haseaten"), new MayCause({status_infection: 50, status_ghoul: 5})],
	bone: [watchWeapon(10), new Weapon(1), new Breakable(75), usedWith("engine_part"), opens("chest_tools", "chest_food")],
	wood_beam: [BULKY, resource(59), TRANSFORMABLE, transformInto("wood2")],
	metal_beam: [BULKY, resource(64), TRANSFORMABLE, transformInto("metal")],
	metal_bad: [TRANSFORMABLE, transformInto("metal")],
	wood_bad: [TRANSFORMABLE, transformInto("wood2"), usedWith("lights", "coffee_machine")],
	saw_tool: [opens("can", "chest", "chest_xl")],
	wood_log: [BULKY, HOME_ITEM, decoration(2), TRANSFORMABLE, transformInto("wood2")],
	electro_box: [TRANSFORMABLE, transformInto("pile", "meca_parts", "electro", "pilegun_empty", "tagger", "deto")],
	deco_box: [BULKY, decoration(8), TRANSFORMABLE, transformInto("chair", "door", "chair_basic", "trestle", "table")],
	saw_tool_part: [TO_ASSEMBLE, assemble(["meca_parts", "rustine"], "saw_tool")],
	mecanism: [TRANSFORMABLE, transformInto("meca_parts", "metal", "tube", "metal_bad")],
	trestle: [BULKY, DEFENSE_ITEM, watchWeapon(4), HOME_ITEM, decoration(1), CAMPING_ITEM],
	table: [BULKY, DEFENSE_ITEM, watchWeapon(15), HOME_ITEM, decoration(3), CAMPING_ITEM],
	water_cleaner: [usedWith("jerrycan", "water_cup_part")],
	vegetable_tasty: [apSource(7), FOOD, causes("status_haseaten")],
	powder: [/*resource(0),*/ TO_ASSEMBLE, assemble(["grenade_empty", "rustine"], "flash")],
	flash: [new ControlRecovery(5*60)],
	"Teddy n'Ours": [HEAL_ITEM, decoration(8), heals("terror")], // Item image is ambiguous
	wood_plate_part: [BULKY, TO_ASSEMBLE, assemble("wood2", "wood_plate")],
	wood_plate: [BULKY, DEFENSE_ITEM, HOME_ITEM, CAMPING_ITEM],
	money: [HOME_ITEM, decoration(7)],
	repair_kit_part_raw: [TO_ASSEMBLE, assemble(["meca_parts", "rustine", "wood2"], "repair_kit")],
	radius_mk2_part: [TO_ASSEMBLE, assemble("pile", "radius_mk2")],
	radius_mk2: [DISCOVER_ZONE, new Becomes("radius_mk2_part", 33)],
	repair_one: [REPAIR],
	engine_part: [BULKY, TO_ASSEMBLE, assemble(["meca_parts", "metal", "rustine", "deto", "bone"], "engine")],
	machine_1: [BULKY, watchWeapon(19), HOME_ITEM, new Weapon(1), decoration(2), new Breakable(30)],
	machine_2: [BULKY, watchWeapon(15), HOME_ITEM, new Weapon(1), decoration(2), new Breakable(30)],
	machine_3: [BULKY, watchWeapon(15), HOME_ITEM, new Weapon(1), decoration(2), new Breakable(50)],
	rp_letter: [RP_ITEM],
	rp_scroll: [RP_ITEM],
	rp_manual: [RP_ITEM],
	rp_book2: [RP_ITEM],
	rp_sheets: [RP_ITEM],
	chain: [watchWeapon(8), resource(2), new Weapon(1, 50), new Breakable(30), opens("chest_tools", "chest_food")],
	dish: [watchWeapon(4), apSource(6), FOOD, causes("status_haseaten")],
	dish_tasty: [watchWeapon(6), apSource(7), FOOD, causes("status_haseaten")],
	home_box_xl: [BULKY, watchWeapon(8), HOME_ITEM, new Special("Améliore la taille du coffre")],
	home_box: [watchWeapon(4), HOME_ITEM, new Special("Améliore la taille du coffre")],
	home_def: [BULKY, HOME_ITEM, new Special("Améliore la défense de la maison")],
	book_gen_letter: [OPENABLE, openGives(["rp_letter", "rp_scroll", "rp_manual", "rp_scroll", "rp_book2", "rp_sheets"])],
	book_gen_box: [OPENABLE, openGives(["rp_book", "rp_book2", "rp_book", "rp_sheets"])],
	fence: [HOME_ITEM],
	watergun_3: [watchWeapon(8), new Weapon(1), new Becomes("item_watergun_2")],
	watergun_2: [watchWeapon(8), new Weapon(1), new Becomes("item_watergun_1")],
	watergun_1: [watchWeapon(8), new Weapon(1), new Becomes("item_watergun_empty")],
	watergun_opt_5: [watchWeapon(8), new Weapon(1), new Becomes("item_watergun_opt_4")],
	watergun_opt_4: [watchWeapon(8), new Weapon(1), new Becomes("item_watergun_opt_3")],
	cigs: [HEAL_ITEM, heals("terror"), usedWith("lights"), new Becomes("small_remove", 10)],
	pilegun_upkit: [TO_ASSEMBLE, assemble(["meca_parts", "rustine", "electro", "pilegun_empty"], "pilegun_up_empty")],
	pilegun_up_empty: [TO_ASSEMBLE, assemble("pile", "pilegun_up")],
	pilegun_up: [watchWeapon(11), new Weapon(1), new Becomes("item_pilegun_up_empty", 20)],
	pile_broken: [],
	rsc_pack_3: [BULKY, OPENABLE, openGives("rsc_pack_2", ["wood2", "metal"])],
	rsc_pack_2: [BULKY, OPENABLE, openGives("rsc_pack_1", ["wood2", "metal"])],
	rsc_pack_1: [BULKY, OPENABLE, openGives(["wood2", "metal"])],
	car_door: [BULKY, DEFENSE_ITEM, watchWeapon(40), HOME_ITEM],
	car_door_part: [BULKY, TO_ASSEMBLE, assemble(["meca_parts", "metal", "rustine"], "car_door")],
	poison: [new CanPoison("water", "can_open", "drug", "vegetable", "fruit")],
	poison_part: [TO_ASSEMBLE, assemble(["pile", "pharma"], "poison"), usedWith("fungus")],
	chest_hero: [BULKY, OPENABLE, openGives(["watergun_empty", "pilegun_empty", "flash", "repair_one", "smoke_bomb"])],
	postal_box_xl: [BULKY, OPENABLE, openGives(["vodka", "rhum", "machine_gun", "vibr_empty", "electro_box", "teddy", "rsc_pack_2", "chest_hero"])],
	postal_box: [OPENABLE, openGives(["rp_book", "money", "rp_book", "rp_sheets"])],
	food_armag: [OPENABLE, openGives(["meat", "food_noodles_hot", "vegetable_tasty", "food_candies"])],
	food_candies: [apSource(7), FOOD, causes("status_haseaten")],
	out_def: [CAMPING_ITEM],
	torch: [DEFENSE_ITEM, watchWeapon(15), HOME_ITEM, new Weapon(1), usedWith("chama"), new Becomes("item_torch_off")],
	torch_off: [watchWeapon(4), new Weapon(1, 10), new Breakable(50)],
	chama: [TO_ASSEMBLE, COOKABLE, assemble("torch", "chama_tasty")],
	chama_tasty: [apSource(7), FOOD, causes("status_haseaten")],
	chest_christmas_3: [EVENT_ITEM, OPENABLE, openGives("chest_christmas_2", "omg_this_will_kill_you")],
	chest_christmas_2: [EVENT_ITEM, OPENABLE, openGives("chest_christmas_1", "xmas_gift")],
	chest_christmas_1: [EVENT_ITEM, OPENABLE, openGives("rp_letter")],
	christmas_candy: [apSource(8), EVENT_ITEM, new MayCause({status_addict: (13/123*100).toFixed(1), status_infection: (29/123*100).toFixed(1), status_terror: (57/123*100).toFixed(1), death: (2/123*100).toFixed(2)})],
	pc: [BULKY, watchWeapon(11), HOME_ITEM, new Weapon(1), decoration(3), new Breakable(50), opens("chest_tools")],
	safe: [BULKY, OPENABLE, openGives(["cutcut", "rp_book", "meca_parts", "chainsaw_part", "mixergun_part", "lawn_part", "pocket_belt", "big_pgun_part", "watergun_opt_part", "rp_letter", "rp_scroll", "rp_manual", "rp_scroll", "rp_book2", "rp_book", "rp_sheets", "pilegun_upkit"]), openWith("small_pa")],
	rp_twin: [RP_ITEM],
	water_can_empty: [BULKY, TO_ASSEMBLE, assemble("water", "water_can_1")],
	water_can_1: [BULKY, watchWeapon(11), apSource(6), WATER, TO_ASSEMBLE, assemble("water", "water_can_2"), causes("status_hasdrunk"), new Becomes("water_can_empty")],
	water_can_2: [BULKY, watchWeapon(11), apSource(6), WATER, TO_ASSEMBLE, assemble("water", "water_can_3"), causes("status_hasdrunk"), new Becomes("water_can_1")],
	water_can_3: [BULKY, watchWeapon(11), apSource(6), WATER, causes("status_hasdrunk"), new Becomes("water_can_2")],
	beta_drug_bad: [apSource("0, 6, 7"), DRUG, new MayCause({status_drugged: 50, status_addict: 20, status_terror: 20})],
	april_drug: [EVENT_ITEM, COOKABLE],
	fruit_sub_part: [SHUNNED_ITEM, TO_ASSEMBLE, assemble("fruit_sub_part", "fruit_part"), usedWith("fruit_sub_part", "fruit_part")],
	fruit_part: [TO_ASSEMBLE, assemble("fruit_sub_part", "fruit")],
	flesh_part: [SHUNNED_ITEM, TO_ASSEMBLE, assemble("flesh_part", "flesh"), usedWith("flesh_part")],
	flesh: [new ControlRecovery(40)],
	pharma_part: [SHUNNED_ITEM, TO_ASSEMBLE, assemble("pharma_part", ["xanax", "drug", "drug_hero", "pharma", "drug_water", "drug_random", "disinfect", "water_cleaner"]), usedWith("pharma_part")],
	fruit: [apSource(6), FOOD, COOKABLE, POISONABLE, poisonableWith("poison"), causes("status_haseaten"), new MayCause({status_ghoul: 10})],
	water_cup_part: [SHUNNED_ITEM, TO_ASSEMBLE, assemble("water_cleaner", "water_cup")],
	water_cup: [apSource(6), WATER, causes("status_hasdrunk")],
	banned_note: [SHUNNED_ITEM],
	infect_poison_part: [TO_ASSEMBLE, assemble(["water", "drug", "pharma", "water_cleaner"], "infect_poison")],
	infect_poison: [new CanPoison("water", "can_open", "drug", "vegetable", "fruit")],
	"Teddy n'Ours maudit": [HOME_ITEM, decoration(1), RUIN_ITEM, causes("status_terror")], // Item image is ambiguous
	woodsteak: [apSource(7), FOOD, causes("status_haseaten")],
	christmas_suit_1: [EVENT_ITEM, TO_ASSEMBLE, assemble(["christmas_suit_2", "christmas_suit_3"], "christmas_suit_full"), usedWith("christmas_suit_2", "christmas_suit_3")],
	christmas_suit_2: [EVENT_ITEM, TO_ASSEMBLE, assemble(["christmas_suit_1", "christmas_suit_3"], "christmas_suit_full"), usedWith("christmas_suit_1", "christmas_suit_3")],
	christmas_suit_3: [EVENT_ITEM, TO_ASSEMBLE, assemble(["christmas_suit_1", "christmas_suit_2"], "christmas_suit_full"), usedWith("christmas_suit_1", "christmas_suit_2")],
	christmas_suit_full: [EVENT_ITEM],
	iphone: [watchWeapon(8), new Weapon("1-2"), new Becomes(["item_deto", "item_metal_bad", "item_pile_broken", "item_electro"])],
	smelly_meat: [CAMPING_ITEM],
	broken: [],
	maglite_off: [HOME_ITEM, decoration(5), TO_ASSEMBLE, assemble("pile", "maglite_2")],
	maglite_1: [HOME_ITEM, decoration(5), TO_ASSEMBLE, assemble("pile", "maglite_2")],
	maglite_2: [HOME_ITEM, decoration(5), usedWith("diode")],
	firework_powder: [HOME_ITEM, resource(1), decoration(5)],
	firework_tube: [BULKY, HOME_ITEM, resource(1), decoration(2)],
	firework_box: [BULKY, HOME_ITEM, resource(1), decoration(3)],
	cadaver: [BULKY, apSource("6, 7"), FOOD, HEAL_ITEM, COOKABLE, heals("wound1", "infection"), causes("status_haseaten"), new MayCause({status_infection: 10, status_ghoul: 90})],
	cadaver_remains: [BULKY],
	smoke_bomb: [new Special("Camoufle les actions de la zone")],
	pumpkin_raw: [BULKY, EVENT_ITEM, TO_ASSEMBLE, assemble("small_knife", "pumpkin_off")],
	pumpkin_off: [HOME_ITEM, decoration(5), EVENT_ITEM, TO_ASSEMBLE, assemble(["lights", "pharma"], "pumpkin_on")],
	pumpkin_on: [DEFENSE_ITEM, HOME_ITEM, decoration(15), EVENT_ITEM],
	sand_ball: [EVENT_ITEM, new MayCause({status_wound1: 10})],
	omg_this_will_kill_you: [apSource(6), FOOD, EVENT_ITEM, COOKABLE, causes("status_haseaten")],
	bplan_c: [BLUEPRINT],
	bplan_u: [BLUEPRINT],
	bplan_r: [BLUEPRINT],
	bplan_e: [BLUEPRINT],
	bplan_box: [BULKY, OPENABLE, openGives("bplan_r")],
	bplan_box_e: [BULKY, OPENABLE, openGives("bplan_e"), openWith("small_pa")],
	egg: [apSource(7), FOOD, causes("status_haseaten")],
	apple: [apSource(7), FOOD, causes("status_haseaten")],
	boomfruit: [watchWeapon(8), new Weapon("5-9"), new Becomes("small_remove")],
	bplan_drop: [openGives(["bplan_c", "bplan_u", "bplan_r", "bplan_e"])],
	magneticKey: [RUIN_ITEM],
	bumpKey: [RUIN_ITEM],
	classicKey: [RUIN_ITEM],
	"Empreinte de clé magnétique": [RUIN_ITEM, TRANSFORMABLE, transformInto("magneticKey")], // Item image is ambiguous
	"Empreinte de clé à percussion": [RUIN_ITEM, TRANSFORMABLE, transformInto("bumpKey")], // Item image is ambiguous
	"Empreinte de décapsuleur": [RUIN_ITEM, TRANSFORMABLE, transformInto("classicKey")], // item image is ambiguous
	vagoul: [HEAL_ITEM, heals("ghoul")],
	mbplan_u: [BLUEPRINT, RUIN_ITEM],
	mbplan_r: [BLUEPRINT, RUIN_ITEM],
	mbplan_e: [BLUEPRINT, RUIN_ITEM],
	bbplan_u: [BLUEPRINT, RUIN_ITEM],
	bbplan_r: [BLUEPRINT, RUIN_ITEM],
	bbplan_e: [BLUEPRINT, RUIN_ITEM],
	hbplan_u: [BLUEPRINT, RUIN_ITEM],
	hbplan_r: [BLUEPRINT, RUIN_ITEM],
	hbplan_e: [BLUEPRINT, RUIN_ITEM],
	soul_blue: [PURIFIABLE],
	soul_red: [causes("death"), PURIFIABLE],
	rlaunc: [BULKY, watchWeapon(8)],
	kalach: [/*BULKY,*/ watchWeapon(11)],
	bureau: [BULKY, watchWeapon(23), HOME_ITEM, decoration(2)],
	distri: [watchWeapon(30), HOME_ITEM, decoration(4)],
	renne: [BULKY, watchWeapon(30), EVENT_ITEM],
	paques: [watchWeapon(38), EVENT_ITEM],
	badge: [watchWeapon(40)],
	wire: [TO_ASSEMBLE, assemble(["meca_parts", "explo", "rustine"], "claymo"), usedWith("diode", "staff2")],
	oilcan: [TO_ASSEMBLE, assemble(["vodka", "fungus"], "hmbrew"), usedWith("staff2")],
	lens: [TO_ASSEMBLE, assemble("tube", "scope"), usedWith("ryebag")],
	angryc: [HOME_ITEM, new Weapon('?', 66), ANIMAL, decoration(1), butcher("flesh", "flesh"), new MayCause({status_wound1: 33}), new Becomes("small_remove")],
	claymo: [watchWeapon(50), TO_ASSEMBLE, assemble("door_carpet", "trapma")],
	diode: [TO_ASSEMBLE, assemble(["maglite_2", "wire", "tube", "meca_parts"], "lpoint")],
	guitar: [watchWeapon(19), HOME_ITEM, apSource("0, 1, 2"), decoration(6), new Breakable()],
	lsd: [apSource("0, 6, 7"), new MayCause({status_drugged: 50, status_addict: 20, status_terror: 20}), usedWith("chudol")],
	lpoint4: [new Weapon(2), new Becomes("lpoint3")],
	lpoint3: [new Weapon(2), new Becomes("lpoint2")],
	lpoint2: [new Weapon(2), new Becomes("lpoint1")],
	lpoint1: [new Weapon(2), new Becomes("lpoint")],
	lpoint: [TO_ASSEMBLE, assemble("pile", "lpoint4")],
	scope: [new Special("Facilite l'estimation de l'attaque")],
	trapma: [HOME_ITEM, decoration(15)],
	chudol: [HOME_ITEM, decoration(15), TO_ASSEMBLE, assemble("lsd", "chkspk")],
	lilboo: [RP_ITEM],
	ryebag: [TO_ASSEMBLE, assemble("lens", "fungus")],
	fungus: [TO_ASSEMBLE, COOKABLE, assemble("poison_part", "lsd"), usedWith("oilcan")],
	hmbrew: [apSource(6), ALCOHOL, causes("status_drunk")],
	hifiev: [HOME_ITEM, decoration(10), usedWith("bquies")],
	cdphil: [HOME_ITEM, decoration(2), TO_ASSEMBLE, assemble("music", "hifiev")],
	bquies: [TO_ASSEMBLE, assemble("hifiev", "dfhifi")],
	staff2: [TO_ASSEMBLE, assemble(["wire", "oilcan"], "guitar")],
	cdbrit: [TO_ASSEMBLE, decoration(3), TO_ASSEMBLE, assemble("music", "hifiev")],
	cdelvi: [HOME_ITEM, decoration(7), TO_ASSEMBLE, assemble("music", "dfhifi")],
	dfhifi: [HOME_ITEM, decoration(10)],
	catbox: [BULKY, OPENABLE, openGives(["pet_cat", "poison_part", "angryc"]), openWith("small_refine", "item_screw", "item_can_opener")],
	chkspk: [watchWeapon("20 * N")],
	pet_snake2: [BULKY, TO_ASSEMBLE, assemble("cutter", "angryc")],
	potion: [apSource(6), WATER, causes("status_hasdrunk")],
	wood_xmas: [BULKY, HOME_ITEM, decoration(8), EVENT_ITEM, COOKABLE],
	xmas_gift: [HOME_ITEM, decoration(2), EVENT_ITEM],
	food_xmas: [EVENT_ITEM, TO_ASSEMBLE, COOKABLE, assemble("can_open", "wood_xmas")],
	tekel: [DEFENSE_ITEM, HOME_ITEM, new Weapon(1), ANIMAL, butcher("meat", "meat"), new Special("Empêche les vols"), new Becomes("small_remove", 5)],
	vodka_de: [apSource(6), ALCOHOL, causes("status_drunk")],
	cinema: [BULKY, new Weapon(1), new Becomes("item_lens")],
	fest: [apSource(6), ALCOHOL, causes("status_drunk")],
	bretz: [apSource(6), FOOD, COOKABLE, causes("status_haseaten")],
	leprechaun_suit: [],
	hurling_stick: [new Weapon(1, 60), new Breakable(15)],
	guiness: [apSource(6), ALCOHOL, causes("status_drunk")]
};

// DOM-related functions

function displayInfo(thisItem, info){
	let div = document.createElement("div");
	div.classList.add("item-tag");
  if(Array.isArray(info.style())){
     div.classList.add(...info.style());
  }else{
    div.classList.add(info.style());
  }
	div.innerHTML = info.display(thisItem);
	return div;
}

function createNewTooltip(target, itemName, itemTitle){
	let itemInfo = items[itemName];
	if(itemInfo === undefined){
		itemInfo = items[itemTitle];
	}
	if(itemInfo === undefined){
		return;
	}
	let itemTooltip = document.createElement("div");
	itemTooltip.classList.add("tooltip", "normal");
	let h1 = document.createElement("h1");
	h1.innerHTML = itemTitle + "  " + imageOfItem(itemName);
	itemTooltip.appendChild(h1);
	for(let info of itemInfo){
		if(info.when() & NEW_TOOLTIP){
			itemTooltip.appendChild(displayInfo(itemName, info));
		}
	}
	target.appendChild(itemTooltip);
	unsafeWindow.$.html.handleTooltip(itemTooltip);
	target.classList.add("ib-tooltipped");
}

function createNewTooltips(){
	document.querySelectorAll(".tool:not(.ib-tooltipped), .workshop span.icon:not(.ib-tooltipped)").forEach(tool => {
		let itemName = tool.querySelector("img").src.match(/[^/]\/item_([^.]*)\./)[1];
		let itemTitle = tool.innerText.trim();
		createNewTooltip(tool, itemName, itemTitle);
	});
	document.querySelectorAll(".workshop .rw-1:not(.center) img:not(.ib-tooltipped)").forEach(img => {
		let itemName = img.src.match(/[^/]\/item_([^.]*)\./)[1];
		let itemTitle = img.alt;
		createNewTooltip(img, itemName, itemTitle);
	});
}

function main(){
	for(let item of unsafeWindow.document.querySelectorAll(".item:not(hordes-tooltip)")){
		let itemName = item.querySelector("img").src.match(/[^/]\/item_([^.]*)\./)[1];
		let itemInfo = items[itemName];
		if(itemInfo === undefined){
			itemInfo = items[item.querySelector("h1")?.textContent.trim()];
		}
		if(itemInfo === undefined){
			continue;
		}
		let itemTooltip = item.querySelector("hordes-tooltip");
		if(itemTooltip === null){
			continue;
		}
		let tooltipInfos = itemTooltip.querySelectorAll("div");
		for(let i = 0;i < tooltipInfos.length;i++){
			if(tooltipInfos[i].textContent === "Arme"){
				tooltipInfos[i].remove();
			}
		}
		for(let info of itemInfo){
			if(info.when() & EXISTING_TOOLTIP){
				itemTooltip.originalChildren.push(displayInfo(itemName, info));
			}
		}
	}
	createNewTooltips();
}

let infobulleppCSSRules = `
div.item-tag {
	padding-left: 17px;
}

div.item-tag.item-tag-long-lines {
	height: initial;
}

div.item-tag.item-tag-dangerous {
	background-color: #8F1305;
	border-color: #8F1305;
}

div.item-tag.item-tag-information {
	background-color: #7E4D2A;
	border-color: #DDAB76;
}

div.item-tag.item-tag-information.item-tag-help::after {
	background: url(${ICON_IMG_BASE_URL}small_help.gif) 50%/contain no-repeat;
}

div.item-tag.item-tag-information.item-tag-more::after {
	background: url(${GITLAB_IMG_BASE_URL}beyond/more.gif) 50%/contain no-repeat;
}`;

let tags = {
	"resource": GITLAB_IMG_BASE_URL+"pictos/r_buildr.gif",
	"ap-source": ICON_IMG_BASE_URL+"ap_small_fr.gif",
	"water": ITEM_IMG_BASE_URL+"water.gif",
	"poisonable": ITEM_IMG_BASE_URL+"poison.gif",
	"openable": GITLAB_IMG_BASE_URL+"actions/sort.gif",
	"food": ITEM_IMG_BASE_URL+"meat.gif",
	"cookable": ITEM_IMG_BASE_URL+"dish_tasty.gif",
	"to-assemble": GITLAB_IMG_BASE_URL+"pictos/r_share.gif",
	"breakable": ICON_IMG_BASE_URL+"Small_broken.gif",
	"backpack-extension": GITLAB_IMG_BASE_URL+"tags/tag_4.gif",
	"drug": GITLAB_IMG_BASE_URL+"pictos/r_drug.gif",
	"heal-item": STATUS_IMG_BASE_URL+"healed.gif",
	"decoration": ITEM_IMG_BASE_URL+"lamp_on.gif",
	"camping-item": GITLAB_IMG_BASE_URL+"pictos/r_camp.gif",
	"animal": ITEM_IMG_BASE_URL+"pet_cat.gif",
	"transformable": GITLAB_IMG_BASE_URL+"building/small_refine.gif",
	"alcohol": ITEM_IMG_BASE_URL+"vodka.gif",
	"blueprint": ITEM_IMG_BASE_URL+"bplan_r.gif",
	"ruin-item": GITLAB_IMG_BASE_URL+"pictos/r_ruine.gif",
	"rp-item": ICON_IMG_BASE_URL+"small_rp.gif",
	"event-item": GITLAB_IMG_BASE_URL+"pictos/r_heroac.gif",
	"shunned-item": GITLAB_IMG_BASE_URL+"pictos/r_ban.gif",
	"clear-dust": GITLAB_IMG_BASE_URL+"pictos/r_digger.gif",
	"control-recovery": ITEM_IMG_BASE_URL+"flash.gif",
	"repair": ITEM_IMG_BASE_URL+"repair_kit.gif",
	"discover-zone": ITEM_IMG_BASE_URL+"radius_mk2.gif",
	"purifiable": ITEM_IMG_BASE_URL+"soul_blue.gif"
};

for(let tag in tags){
	infobulleppCSSRules += `
	div.item-tag.item-tag-${tag}::after {
		background: url(${tags[tag]}) 50%/contain no-repeat;
	}`;
}

let stylesheet = document.createElement("style");
stylesheet.type = "text/css";
stylesheet.innerText = infobulleppCSSRules;
document.head.appendChild(stylesheet);

new MutationObserver((mutations, observer) => {
	if(document.querySelector(".item") !== null){
		try{main()}catch(e){console.error(e);};
		setTimeout(() => {
			let logContent = document.querySelector(".log-content");
			if(logContent !== null){
				createNewTooltips();
				new MutationObserver(createNewTooltips).observe(logContent, {childList: true});
			}
		}, 1000);
	}
}).observe(document.querySelector("#content"), {childList: true});
