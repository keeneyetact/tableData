'use strict';

import defaultOptions from './options.js';
import coreModules from '../modules_core.js';

/*=include polyfills.js */

/*=include column_manager.js */
/*=include column.js */
/*=include row_manager.js */
/*=include vdom_hoz.js */
/*=include row.js */
/*=include footer_manager.js */

class Tabulator {

	//default setup options
	static defaultOptions = defaultOptions;
	static moduleBindings = coreModules;

	constructor(element, options){

		this.options = {};

		this.columnManager = null; // hold Column Manager
		this.rowManager = null; //hold Row Manager
		this.footerManager = null; //holder Footer Manager
		this.vdomHoz  = null; //holder horizontal virtual dom


		this.browser = ""; //hold current browser type
		this.browserSlow = false; //handle reduced functionality for slower browsers
		this.browserMobile = false; //check if running on moble, prevent resize cancelling edit on keyboard appearence
		this.rtl = false; //check if the table is in RTL mode

		this.modules = {}; //hold all modules bound to this table

		if(this.initializeElement(element)){
			this.initializeOptions(options || {});
			this._create();
		}

		Tabulator.prototype.comms.register(this); //register table for inderdevice communication
	}

	initializeOptions(options){
		//warn user if option is not available
		if(options.invalidOptionWarnings !== false){
			for (var key in options){
				if(typeof this.defaultOptions[key] === "undefined"){
					console.warn("Invalid table constructor option:", key)
				}
			}
		}

		//assign options to table
		for (var key in this.defaultOptions){
			if(key in options){
				this.options[key] = options[key];
			}else{
				if(Array.isArray(this.defaultOptions[key])){
					this.options[key] = Object.assign([], this.defaultOptions[key]);
				}else if(typeof this.defaultOptions[key] === "object" && this.defaultOptions[key] !== null){
					this.options[key] = Object.assign({}, this.defaultOptions[key]);
				}else{
					this.options[key] = this.defaultOptions[key];
				}
			}
		}
	}

	initializeElement(element){
		if(typeof HTMLElement !== "undefined" && element instanceof HTMLElement){
			this.element = element;
			return true;
		}else if(typeof element === "string"){
			this.element = document.querySelector(element);

			if(this.element){
				return true;
			}else{
				console.error("Tabulator Creation Error - no element found matching selector: ", element);
				return false;
			}
		}else{
			console.error("Tabulator Creation Error - Invalid element provided:", element);
			return false;
		}
	}

	rtlCheck(){
		var style = window.getComputedStyle(this.element);

		switch(this.options.textDirection){
			case"auto":
			if(style.direction !== "rtl"){
				break;
			};

			case "rtl":
			this.element.classList.add("tabulator-rtl");
			this.rtl = true;
			break;

			case "ltr":
			this.element.classList.add("tabulator-ltr");

			default:
			this.rtl = false;
		}
	}

	//convert depricated functionality to new functions
	_mapDepricatedFunctionality(){
		//map depricated persistance setup options
		if(this.options.persistentLayout || this.options.persistentSort || this.options.persistentFilter){
			if(!this.options.persistence){
				this.options.persistence = {};
			}
		}

		if(this.options.dataEdited){
			console.warn("DEPRECATION WARNING - dataEdited option has been deprecated, please use the dataChanged option instead");
			this.options.dataChanged = this.options.dataEdited;
		}

		if(this.options.downloadDataFormatter){
			console.warn("DEPRECATION WARNING - downloadDataFormatter option has been deprecated");
		}

		if(typeof this.options.clipboardCopyHeader !== "undefined"){
			this.options.columnHeaders = this.options.clipboardCopyHeader;
			console.warn("DEPRECATION WARNING - clipboardCopyHeader option has been deprecated, please use the columnHeaders property on the clipboardCopyConfig option");
		}

		if(this.options.printVisibleRows !== true){
			console.warn("printVisibleRows option is deprecated, you should now use the printRowRange option");

			this.options.persistence.printRowRange = "active";
		}

		if(this.options.printCopyStyle !== true){
			console.warn("printCopyStyle option is deprecated, you should now use the printStyled option");

			this.options.persistence.printStyled = this.options.printCopyStyle;
		}

		if(this.options.persistentLayout){
			console.warn("persistentLayout option is deprecated, you should now use the persistence option");

			if(this.options.persistence !== true && typeof this.options.persistence.columns === "undefined"){
				this.options.persistence.columns = true;
			}
		}

		if(this.options.persistentSort){
			console.warn("persistentSort option is deprecated, you should now use the persistence option");

			if(this.options.persistence !== true  && typeof this.options.persistence.sort === "undefined"){
				this.options.persistence.sort = true;
			}
		}

		if(this.options.persistentFilter){
			console.warn("persistentFilter option is deprecated, you should now use the persistence option");

			if(this.options.persistence !== true  && typeof this.options.persistence.filter === "undefined"){
				this.options.persistence.filter = true;
			}
		}

		if(this.options.columnVertAlign){
			console.warn("columnVertAlign option is deprecated, you should now use the columnHeaderVertAlign option");

			this.options.columnHeaderVertAlign = this.options.columnVertAlign;
		}
	}

	_clearSelection(){

		this.element.classList.add("tabulator-block-select");

		if (window.getSelection) {
		  if (window.getSelection().empty) {  // Chrome
		  	window.getSelection().empty();
		  } else if (window.getSelection().removeAllRanges) {  // Firefox
		  	window.getSelection().removeAllRanges();
		  }
		} else if (document.selection) {  // IE?
			document.selection.empty();
		}

		this.element.classList.remove("tabulator-block-select");
	}

	//concreate table
	_create(){
		this._clearObjectPointers();

		this._mapDepricatedFunctionality();

		this.bindModules();

		this.rtlCheck();

		if(this.element.tagName === "TABLE"){
			if(this.modExists("htmlTableImport", true)){
				this.modules.htmlTableImport.parseTable();
			}
		}

		this.columnManager = new ColumnManager(this);
		this.rowManager = new RowManager(this);
		this.footerManager = new FooterManager(this);

		this.columnManager.setRowManager(this.rowManager);
		this.rowManager.setColumnManager(this.columnManager);

		if(this.options.virtualDomHoz){
			this.vdomHoz = new VDomHoz(this);
		}

		this._buildElement();

		this._loadInitialData();
	}

	//clear pointers to objects in default config object
	_clearObjectPointers(){
		this.options.columns = this.options.columns.slice(0);

		if(!this.options.reactiveData){
			this.options.data = this.options.data.slice(0);
		}
	}

	//build tabulator element
	_buildElement(){
		var element = this.element,
		mod = this.modules,
		options = this.options;

		options.tableBuilding.call(this);

		element.classList.add("tabulator");
		element.setAttribute("role", "grid");

		//empty element
		while(element.firstChild) element.removeChild(element.firstChild);

		//set table height
		if(options.height){
			options.height = isNaN(options.height) ? options.height : options.height + "px";
			element.style.height = options.height;
		}

		//set table min height
		if(options.minHeight !== false){
			options.minHeight = isNaN(options.minHeight) ? options.minHeight : options.minHeight + "px";
			element.style.minHeight = options.minHeight;
		}

		//set table maxHeight
		if(options.maxHeight !== false){
			options.maxHeight = isNaN(options.maxHeight) ? options.maxHeight : options.maxHeight + "px";
			element.style.maxHeight = options.maxHeight;
		}

		this.columnManager.initialize();
		this.rowManager.initialize();

		this._detectBrowser();

		if(this.modExists("layout", true)){
			mod.layout.initialize(options.layout);
		}

		//set localization
		mod.localize.initialize();

		if(options.headerFilterPlaceholder !== false){
			mod.localize.setHeaderFilterPlaceholder(options.headerFilterPlaceholder);
		}

		for(let locale in options.langs){
			mod.localize.installLang(locale, options.langs[locale]);
		}

		mod.localize.setLocale(options.locale);

		//configure placeholder element
		if(typeof options.placeholder == "string"){

			var el = document.createElement("div");
			el.classList.add("tabulator-placeholder");

			var span = document.createElement("span");
			span.innerHTML = options.placeholder;

			el.appendChild(span);

			options.placeholder = el;
		}

		//build table elements
		element.appendChild(this.columnManager.getElement());
		element.appendChild(this.rowManager.getElement());

		if(options.footerElement){
			this.footerManager.activate();
		}

		if(options.persistence && this.modExists("persistence", true)){
			mod.persistence.initialize();
		}

		if(options.movableRows && this.modExists("moveRow")){
			mod.moveRow.initialize();
		}

		if(options.autoColumns && this.options.data){
			this.columnManager.generateColumnsFromRowData(this.options.data);
		}

		if(this.modExists("columnCalcs")){
			mod.columnCalcs.initialize();
		}

		this.columnManager.setColumns(options.columns);

		if(options.dataTree && this.modExists("dataTree", true)){
			mod.dataTree.initialize();
		}

		if(this.modExists("frozenRows")){
			this.modules.frozenRows.initialize();
		}

		if(((options.persistence && this.modExists("persistence", true) && mod.persistence.config.sort) || options.initialSort) && this.modExists("sort", true)){
			var sorters = [];

			if(options.persistence && this.modExists("persistence", true) && mod.persistence.config.sort){
				sorters = mod.persistence.load("sort");

				if(sorters === false && options.initialSort){
					sorters = options.initialSort;
				}
			}else if(options.initialSort){
				sorters = options.initialSort;
			}

			mod.sort.setSort(sorters);
		}

		if(((options.persistence && this.modExists("persistence", true) && mod.persistence.config.filter) || options.initialFilter) && this.modExists("filter", true)){
			var filters = [];


			if(options.persistence && this.modExists("persistence", true) && mod.persistence.config.filter){
				filters = mod.persistence.load("filter");

				if(filters === false && options.initialFilter){
					filters = options.initialFilter;
				}
			}else if(options.initialFilter){
				filters = options.initialFilter;
			}

			mod.filter.setFilter(filters);
		}

		if(options.initialHeaderFilter && this.modExists("filter", true)){
			options.initialHeaderFilter.forEach((item) => {

				var column = this.columnManager.findColumn(item.field);

				if(column){
					mod.filter.setHeaderFilterValue(column, item.value);
				}else{
					console.warn("Column Filter Error - No matching column found:", item.field);
					return false;
				}
			});
		}


		if(this.modExists("ajax")){
			mod.ajax.initialize();
		}

		if(options.pagination && this.modExists("page", true)){
			mod.page.initialize();
		}

		if(options.groupBy && this.modExists("groupRows", true)){
			mod.groupRows.initialize();
		}

		if(this.modExists("keybindings")){
			mod.keybindings.initialize();
		}

		if(this.modExists("selectRow")){
			mod.selectRow.clearSelectionData(true);
		}

		if(options.autoResize && this.modExists("resizeTable")){
			mod.resizeTable.initialize();
		}

		if(this.modExists("clipboard")){
			mod.clipboard.initialize();
		}

		if(options.printAsHtml && this.modExists("print")){
			mod.print.initialize();
		}

		options.tableBuilt.call(this);
	}

	_loadInitialData(){
		var self = this;

		if(self.options.pagination && self.modExists("page")){
			self.modules.page.reset(true, true);

			if(self.options.pagination == "local"){
				if(self.options.data.length){
					self.rowManager.setData(self.options.data, false, true);
				}else{
					if((self.options.ajaxURL || self.options.ajaxURLGenerator) && self.modExists("ajax")){
						self.modules.ajax.loadData(false, true).then(()=>{}).catch(()=>{
							if(self.options.paginationInitialPage){
								self.modules.page.setPage(self.options.paginationInitialPage);
							}
						});

						return;
					}else{
						self.rowManager.setData(self.options.data, false, true);
					}
				}

				if(self.options.paginationInitialPage){
					self.modules.page.setPage(self.options.paginationInitialPage);
				}
			}else{
				if(self.options.ajaxURL){
					self.modules.page.setPage(self.options.paginationInitialPage).then(()=>{}).catch(()=>{});
				}else{
					self.rowManager.setData([], false, true);
				}
			}
		}else{
			if(self.options.data.length){
				self.rowManager.setData(self.options.data);
			}else{
				if((self.options.ajaxURL || self.options.ajaxURLGenerator) && self.modExists("ajax")){
					self.modules.ajax.loadData(false, true).then(()=>{}).catch(()=>{});
				}else{
					self.rowManager.setData(self.options.data, false, true);
				}
			}
		}
	}

	//deconstructor
	destroy(){
		var element = this.element;

		comms(this); //deregister table from inderdevice communication

		if(this.options.reactiveData && this.modExists("reactiveData", true)){
			this.modules.reactiveData.unwatchData();
		}

		//clear row data
		this.rowManager.rows.forEach(function(row){
			row.wipe();
		});

		this.rowManager.rows = [];
		this.rowManager.activeRows = [];
		this.rowManager.displayRows = [];

		//clear event bindings
		if(this.options.autoResize && this.modExists("resizeTable")){
			this.modules.resizeTable.clearBindings();
		}

		if(this.modExists("keybindings")){
			this.modules.keybindings.clearBindings();
		}

		//clear DOM
		while(element.firstChild) element.removeChild(element.firstChild);
		element.classList.remove("tabulator");
	}

	_detectBrowser(){
		var ua = navigator.userAgent||navigator.vendor||window.opera;

		if(ua.indexOf("Trident") > -1){
			this.browser = "ie";
			this.browserSlow = true;
		}else if(ua.indexOf("Edge") > -1){
			this.browser = "edge";
			this.browserSlow = true;
		}else if(ua.indexOf("Firefox") > -1){
			this.browser = "firefox";
			this.browserSlow = false;
		}else{
			this.browser = "other";
			this.browserSlow = false;
		}

		this.browserMobile = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(ua)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(ua.substr(0,4));
	}

	////////////////// Data Handling //////////////////
	//block table redrawing
	blockRedraw(){
		return this.rowManager.blockRedraw();
	}

	//restore table redrawing
	restoreRedraw(){
		return this.rowManager.restoreRedraw();
	}

	//local data from local file
	setDataFromLocalFile(extensions){

		return new Promise((resolve, reject) => {
			var input = document.createElement("input");
			input.type = "file";
			input.accept = extensions || ".json,application/json";

			input.addEventListener("change", (e) => {
				var file = input.files[0],
				reader = new FileReader(),
				data;

				reader.readAsText(file);

				reader.onload = (e) => {

					try {
						data = JSON.parse(reader.result);
					} catch(e) {
						console.warn("File Load Error - File contents is invalid JSON", e);
						reject(e);
						return;
					}

					this.setData(data)
					.then((data) => {
						resolve(data);
					})
					.catch((err) => {
						resolve(err);
					});
				};

				reader.onerror = (e) => {
					console.warn("File Load Error - Unable to read file");
					reject();
				};
			});

			input.click();
		});
	}

	//load data
	setData(data, params, config){
		if(this.modExists("ajax")){
			this.modules.ajax.blockActiveRequest();
		}

		return this._setData(data, params, config, false, true);
	}

	_setData(data, params, config, inPosition, columnsChanged){
		var self = this;

		if(typeof(data) === "string"){
			if (data.indexOf("{") == 0 || data.indexOf("[") == 0){
				//data is a json encoded string
				return self.rowManager.setData(JSON.parse(data), inPosition, columnsChanged);
			}else{

				if(self.modExists("ajax", true)){
					if(params){
						self.modules.ajax.setParams(params);
					}

					if(config){
						self.modules.ajax.setConfig(config);
					}

					self.modules.ajax.setUrl(data);

					if(self.options.pagination == "remote" && self.modExists("page", true)){
						self.modules.page.reset(true, true);
						return self.modules.page.setPage(1);
					}else{
						//assume data is url, make ajax call to url to get data
						return self.modules.ajax.loadData(inPosition, columnsChanged);
					}
				}
			}
		}else{
			if(data){
				//asume data is already an object
				return self.rowManager.setData(data, inPosition, columnsChanged);
			}else{

				//no data provided, check if ajaxURL is present;
				if(self.modExists("ajax") && (self.modules.ajax.getUrl || self.options.ajaxURLGenerator)){

					if(self.options.pagination == "remote" && self.modExists("page", true)){
						self.modules.page.reset(true, true);
						return self.modules.page.setPage(1);
					}else{
						return self.modules.ajax.loadData(inPosition, columnsChanged);
					}

				}else{
					//empty data
					return self.rowManager.setData([], inPosition, columnsChanged);
				}
			}
		}
	}

	//clear data
	clearData(){
		if(this.modExists("ajax")){
			this.modules.ajax.blockActiveRequest();
		}

		this.rowManager.clearData();
	}

	//get table data array
	getData(active){
		if(active === true){
			console.warn("passing a boolean to the getData function is deprecated, you should now pass the string 'active'");
			active = "active";
		}

		return this.rowManager.getData(active);
	}

	//get table data array count
	getDataCount(active){

		if(active === true){
			console.warn("passing a boolean to the getDataCount function is deprecated, you should now pass the string 'active'");
			active = "active";
		}

		return this.rowManager.getDataCount(active);
	}

	//search for specific row components
	searchRows(field, type, value){
		if(this.modExists("filter", true)){
			return this.modules.filter.search("rows", field, type, value);
		}
	}

	//search for specific data
	searchData(field, type, value){
		if(this.modExists("filter", true)){
			return this.modules.filter.search("data", field, type, value);
		}
	}

	//get table html
	getHtml(visible, style, config){
		if(this.modExists("export", true)){
			return this.modules.export.getHtml(visible, style, config);
		}
	}

	//get print html
	print(visible, style, config){
		if(this.modExists("print", true)){
			return this.modules.print.printFullscreen(visible, style, config);
		}
	}

	//retrieve Ajax URL
	getAjaxUrl(){
		if(this.modExists("ajax", true)){
			return this.modules.ajax.getUrl();
		}
	}

	//replace data, keeping table in position with same sort
	replaceData(data, params, config){
		if(this.modExists("ajax")){
			this.modules.ajax.blockActiveRequest();
		}

		return this._setData(data, params, config, true);
	}

	//update table data
	updateData(data){
		var self = this;
		var responses = 0;

		return new Promise((resolve, reject) => {
			if(this.modExists("ajax")){
				this.modules.ajax.blockActiveRequest();
			}

			if(typeof data === "string"){
				data = JSON.parse(data);
			}

			if(data){
				data.forEach(function(item){
					var row = self.rowManager.findRow(item[self.options.index]);

					if(row){
						responses++;

						row.updateData(item)
						.then(()=>{
							responses--;

							if(!responses){
								resolve();
							}
						});
					}
				});
			}else{
				console.warn("Update Error - No data provided");
				reject("Update Error - No data provided");
			}
		});
	}

	addData(data, pos, index){
		return new Promise((resolve, reject) => {
			if(this.modExists("ajax")){
				this.modules.ajax.blockActiveRequest();
			}

			if(typeof data === "string"){
				data = JSON.parse(data);
			}

			if(data){
				this.rowManager.addRows(data, pos, index)
				.then((rows) => {
					var output = [];

					rows.forEach(function(row){
						output.push(row.getComponent());
					});

					resolve(output);
				});
			}else{
				console.warn("Update Error - No data provided");
				reject("Update Error - No data provided");
			}
		});
	}

	//update table data
	updateOrAddData(data){
		var self = this,
		rows = [],
		responses = 0;

		return new Promise((resolve, reject) => {
			if(this.modExists("ajax")){
				this.modules.ajax.blockActiveRequest();
			}

			if(typeof data === "string"){
				data = JSON.parse(data);
			}

			if(data){
				data.forEach(function(item){
					var row = self.rowManager.findRow(item[self.options.index]);

					responses++;

					if(row){
						row.updateData(item)
						.then(()=>{
							responses--;
							rows.push(row.getComponent());

							if(!responses){
								resolve(rows);
							}
						});
					}else{
						self.rowManager.addRows(item)
						.then((newRows)=>{
							responses--;
							rows.push(newRows[0].getComponent());

							if(!responses){
								resolve(rows);
							}
						});
					}
				});
			}else{
				console.warn("Update Error - No data provided");
				reject("Update Error - No data provided");
			}
		});
	}

	//get row object
	getRow(index){
		var row = this.rowManager.findRow(index);

		if(row){
			return row.getComponent();
		}else{
			console.warn("Find Error - No matching row found:", index);
			return false;
		}
	}

	//get row object
	getRowFromPosition(position, active){
		var row = this.rowManager.getRowFromPosition(position, active);

		if(row){
			return row.getComponent();
		}else{
			console.warn("Find Error - No matching row found:", position);
			return false;
		}
	}

	//delete row from table
	deleteRow(index){
		return new Promise((resolve, reject) => {
			var self = this,
			count = 0,
			successCount = 0,
			foundRows = [];

			function doneCheck(){
				count++;

				if(count == index.length){
					if(successCount){
						self.rowManager.reRenderInPosition();
						resolve();
					}
				}
			}

			if(!Array.isArray(index)){
				index = [index];
			}

			//find matching rows
			index.forEach((item) =>{
				var row = this.rowManager.findRow(item, true);

				if(row){
					foundRows.push(row);
				}else{
					console.warn("Delete Error - No matching row found:", item);
					reject("Delete Error - No matching row found")
					doneCheck();
				}
			});

			//sort rows into correct order to ensure smooth delete from table
			foundRows.sort((a, b) => {
				return this.rowManager.rows.indexOf(a) > this.rowManager.rows.indexOf(b) ? 1 : -1;
			});

			foundRows.forEach((row) =>{
				row.delete()
				.then(() => {
					successCount++;
					doneCheck();
				})
				.catch((err) => {
					doneCheck();
					reject(err);
				});
			});
		});
	}

	//add row to table
	addRow(data, pos, index){
		return new Promise((resolve, reject) => {
			if(typeof data === "string"){
				data = JSON.parse(data);
			}

			this.rowManager.addRows(data, pos, index)
			.then((rows)=>{
				//recalc column calculations if present
				if(this.modExists("columnCalcs")){
					this.modules.columnCalcs.recalc(this.rowManager.activeRows);
				}

				resolve(rows[0].getComponent());
			});
		});
	}

	//update a row if it exitsts otherwise create it
	updateOrAddRow(index, data){
		return new Promise((resolve, reject) => {
			var row = this.rowManager.findRow(index);

			if(typeof data === "string"){
				data = JSON.parse(data);
			}

			if(row){
				row.updateData(data)
				.then(()=>{
					//recalc column calculations if present
					if(this.modExists("columnCalcs")){
						this.modules.columnCalcs.recalc(this.rowManager.activeRows);
					}

					resolve(row.getComponent());
				})
				.catch((err)=>{
					reject(err);
				});
			}else{
				row = this.rowManager.addRows(data)
				.then((rows)=>{
					//recalc column calculations if present
					if(this.modExists("columnCalcs")){
						this.modules.columnCalcs.recalc(this.rowManager.activeRows);
					}

					resolve(rows[0].getComponent());
				})
				.catch((err)=>{
					reject(err);
				});
			}
		});
	}

	//update row data
	updateRow(index, data){
		return new Promise((resolve, reject) => {
			var row = this.rowManager.findRow(index);

			if(typeof data === "string"){
				data = JSON.parse(data);
			}

			if(row){
				row.updateData(data).then(()=>{
					resolve(row.getComponent());
				})
				.catch((err)=>{
					reject(err);
				});
			}else{
				console.warn("Update Error - No matching row found:", index);
				reject("Update Error - No matching row found");
			}
		});
	}

	//scroll to row in DOM
	scrollToRow(index, position, ifVisible){
		return new Promise((resolve, reject) => {
			var row = this.rowManager.findRow(index);

			if(row){
				this.rowManager.scrollToRow(row, position, ifVisible)
				.then(()=>{
					resolve();
				})
				.catch((err)=>{
					reject(err);
				});
			}else{
				console.warn("Scroll Error - No matching row found:", index);
				reject("Scroll Error - No matching row found");
			}
		});
	}

	moveRow(from, to, after){
		var fromRow = this.rowManager.findRow(from);

		if(fromRow){
			fromRow.moveToRow(to, after);
		}else{
			console.warn("Move Error - No matching row found:", from);
		}
	}

	getRows(active){
		if(active === true){
			console.warn("passing a boolean to the getRows function is deprecated, you should now pass the string 'active'");
			active = "active";
		}

		return this.rowManager.getComponents(active);
	}

	//get position of row in table
	getRowPosition(index, active){
		var row = this.rowManager.findRow(index);

		if(row){
			return this.rowManager.getRowPosition(row, active);
		}else{
			console.warn("Position Error - No matching row found:", index);
			return false;
		}
	}

	//copy table data to clipboard
	copyToClipboard(selector){
		if(this.modExists("clipboard", true)){
			this.modules.clipboard.copy(selector);
		}
	}

	/////////////// Column Functions  ///////////////
	setColumns(definition){
		this.columnManager.setColumns(definition);
	}

	getColumns(structured){
		return this.columnManager.getComponents(structured);
	}

	getColumn(field){
		var col = this.columnManager.findColumn(field);

		if(col){
			return col.getComponent();
		}else{
			console.warn("Find Error - No matching column found:", field);
			return false;
		}
	}

	getColumnDefinitions(){
		return this.columnManager.getDefinitionTree();
	}

	getColumnLayout(){
		if(this.modExists("persistence", true)){
			return this.modules.persistence.parseColumns(this.columnManager.getColumns());
		}
	}

	setColumnLayout(layout){
		if(this.modExists("persistence", true)){
			this.columnManager.setColumns(this.modules.persistence.mergeDefinition(this.options.columns, layout))
			return true;
		}
		return false;
	}

	showColumn(field){
		var column = this.columnManager.findColumn(field);

		if(column){
			column.show();

			if(this.options.responsiveLayout && this.modExists("responsiveLayout", true)){
				this.modules.responsiveLayout.update();
			}
		}else{
			console.warn("Column Show Error - No matching column found:", field);
			return false;
		}
	}

	hideColumn(field){
		var column = this.columnManager.findColumn(field);

		if(column){
			column.hide();

			if(this.options.responsiveLayout && this.modExists("responsiveLayout", true)){
				this.modules.responsiveLayout.update();
			}
		}else{
			console.warn("Column Hide Error - No matching column found:", field);
			return false;
		}
	}

	toggleColumn(field){
		var column = this.columnManager.findColumn(field);

		if(column){
			if(column.visible){
				column.hide();
			}else{
				column.show();
			}
		}else{
			console.warn("Column Visibility Toggle Error - No matching column found:", field);
			return false;
		}
	}

	addColumn(definition, before, field){
		return new Promise((resolve, reject) => {
			var column = this.columnManager.findColumn(field);

			this.columnManager.addColumn(definition, before, column)
			.then((column) => {
				resolve(column.getComponent());
			}).catch((err) => {
				reject(err);
			});
		});
	}

	deleteColumn(field){
		return new Promise((resolve, reject) => {
			var column = this.columnManager.findColumn(field);

			if(column){
				column.delete()
				.then(() => {
					resolve();
				}).catch((err) => {
					reject(err);
				});
			}else{
				console.warn("Column Delete Error - No matching column found:", field);
				reject();
			}
		});
	}

	updateColumnDefinition(field, definition){
		return new Promise((resolve, reject) => {
			var column = this.columnManager.findColumn(field);

			if(column){
				column.updateDefinition(definition)
				.then((col) => {
					resolve(col);
				}).catch((err) => {
					reject(err);
				});
			}else{
				console.warn("Column Update Error - No matching column found:", field);
				reject();
			}
		});
	}

	moveColumn(from, to, after){
		var fromColumn = this.columnManager.findColumn(from);
		var toColumn = this.columnManager.findColumn(to);

		if(fromColumn){
			if(toColumn){
				this.columnManager.moveColumn(fromColumn, toColumn, after)
			}else{
				console.warn("Move Error - No matching column found:", toColumn);
			}
		}else{
			console.warn("Move Error - No matching column found:", from);
		}
	}

	//scroll to column in DOM
	scrollToColumn(field, position, ifVisible){
		return new Promise((resolve, reject) => {
			var column = this.columnManager.findColumn(field);

			if(column){
				this.columnManager.scrollToColumn(column, position, ifVisible)
				.then(()=>{
					resolve();
				})
				.catch((err)=>{
					reject(err);
				});
			}else{
				console.warn("Scroll Error - No matching column found:", field);
				reject("Scroll Error - No matching column found");
			}
		});
	}

	//////////// Localization Functions  ////////////
	setLocale(locale){
		this.modules.localize.setLocale(locale);
	}

	getLocale(){
		return this.modules.localize.getLocale();
	}

	getLang(locale){
		return this.modules.localize.getLang(locale);
	}

	//////////// General Public Functions ////////////
	//redraw list without updating data
	redraw(force){
		this.columnManager.redraw(force);
		this.rowManager.redraw(force);
	}

	setHeight(height){

		if(this.rowManager.renderMode !== "classic"){
			this.options.height = isNaN(height) ? height : height + "px";
			this.element.style.height = this.options.height;
			this.rowManager.setRenderMode();
			this.rowManager.redraw();
		}else{
			console.warn("setHeight function is not available in classic render mode");
		}
	}

	///////////////////// Sorting ////////////////////
	setSort(sortList, dir){
		if(this.modExists("sort", true)){
			this.modules.sort.setSort(sortList, dir);
			this.rowManager.sorterRefresh();
		}
	}

	getSorters(){
		if(this.modExists("sort", true)){
			return this.modules.sort.getSort();
		}
	}

	clearSort(){
		if(this.modExists("sort", true)){
			this.modules.sort.clear();
			this.rowManager.sorterRefresh();
		}
	}


	///////////////////// Filtering ////////////////////

	//set standard filters
	setFilter(field, type, value, params){
		if(this.modExists("filter", true)){
			this.modules.filter.setFilter(field, type, value, params);
			this.rowManager.filterRefresh();
		}
	}

	//set standard filters
	refreshFilter(){
		if(this.modExists("filter", true)){
			this.rowManager.filterRefresh();
		}
	}

	//add filter to array
	addFilter(field, type, value, params){
		if(this.modExists("filter", true)){
			this.modules.filter.addFilter(field, type, value, params);
			this.rowManager.filterRefresh();
		}
	}

	//get all filters
	getFilters(all){
		if(this.modExists("filter", true)){
			return this.modules.filter.getFilters(all);
		}
	}

	setHeaderFilterFocus(field){
		if(this.modExists("filter", true)){
			var column = this.columnManager.findColumn(field);

			if(column){
				this.modules.filter.setHeaderFilterFocus(column);
			}else{
				console.warn("Column Filter Focus Error - No matching column found:", field);
				return false;
			}
		}
	}

	getHeaderFilterValue(field) {
		if(this.modExists("filter", true)){
			var column = this.columnManager.findColumn(field);

			if(column){
				return this.modules.filter.getHeaderFilterValue(column);
			}else{
				console.warn("Column Filter Error - No matching column found:", field);
			}
		}
	}

	setHeaderFilterValue(field, value){
		if(this.modExists("filter", true)){
			var column = this.columnManager.findColumn(field);

			if(column){
				this.modules.filter.setHeaderFilterValue(column, value);
			}else{
				console.warn("Column Filter Error - No matching column found:", field);
				return false;
			}
		}
	}

	getHeaderFilters(){
		if(this.modExists("filter", true)){
			return this.modules.filter.getHeaderFilters();
		}
	}


	//remove filter from array
	removeFilter(field, type, value){
		if(this.modExists("filter", true)){
			this.modules.filter.removeFilter(field, type, value);
			this.rowManager.filterRefresh();
		}
	}

	//clear filters
	clearFilter(all){
		if(this.modExists("filter", true)){
			this.modules.filter.clearFilter(all);
			this.rowManager.filterRefresh();
		}
	}

	//clear header filters
	clearHeaderFilter(){
		if(this.modExists("filter", true)){
			this.modules.filter.clearHeaderFilter();
			this.rowManager.filterRefresh();
		}
	}

	///////////////////// select ////////////////////
	selectRow(rows){
		if(this.modExists("selectRow", true)){
			if(rows === true){
				console.warn("passing a boolean to the selectRowselectRow function is deprecated, you should now pass the string 'active'");
				rows = "active";
			}
			this.modules.selectRow.selectRows(rows);
		}
	}

	deselectRow(rows){
		if(this.modExists("selectRow", true)){
			this.modules.selectRow.deselectRows(rows);
		}
	}

	toggleSelectRow(row){
		if(this.modExists("selectRow", true)){
			this.modules.selectRow.toggleRow(row);
		}
	}

	getSelectedRows(){
		if(this.modExists("selectRow", true)){
			return this.modules.selectRow.getSelectedRows();
		}
	}

	getSelectedData(){
		if(this.modExists("selectRow", true)){
			return this.modules.selectRow.getSelectedData();
		}
	}

	///////////////////// validation  ////////////////////
	getInvalidCells(){
		if(this.modExists("validate", true)){
			return this.modules.validate.getInvalidCells();
		}
	}

	clearCellValidation(cells){

		if(this.modExists("validate", true)){

			if(!cells){
				cells = this.modules.validate.getInvalidCells();
			}

			if(!Array.isArray(cells)){
				cells = [cells];
			}

			cells.forEach((cell) => {
				this.modules.validate.clearValidation(cell._getSelf());
			});
		}
	}

	validate(cells){
		var output = [];

		//clear row data
		this.rowManager.rows.forEach(function(row){
			var valid = row.validate();

			if(valid !== true){
				output = output.concat(valid);
			}
		});

		return output.length ? output : true;
	}

	//////////// Pagination Functions  ////////////
	setMaxPage(max){
		if(this.options.pagination && this.modExists("page")){
			this.modules.page.setMaxPage(max);
		}else{
			return false;
		}
	}

	setPage(page){
		if(this.options.pagination && this.modExists("page")){
			return this.modules.page.setPage(page);
		}else{
			return new Promise((resolve, reject) => { reject() });
		}
	}

	setPageToRow(row){
		return new Promise((resolve, reject) => {
			if(this.options.pagination && this.modExists("page")){
				row = this.rowManager.findRow(row);

				if(row){
					this.modules.page.setPageToRow(row)
					.then(()=>{
						resolve();
					})
					.catch(()=>{
						reject();
					});
				}else{
					reject();
				}
			}else{
				reject();
			}
		});
	}

	setPageSize(size){
		if(this.options.pagination && this.modExists("page")){
			this.modules.page.setPageSize(size);
			this.modules.page.setPage(1).then(()=>{}).catch(()=>{});
		}else{
			return false;
		}
	}

	getPageSize(){
		if(this.options.pagination && this.modExists("page", true)){
			return this.modules.page.getPageSize();
		}
	}

	previousPage(){
		if(this.options.pagination && this.modExists("page")){
			this.modules.page.previousPage();
		}else{
			return false;
		}
	}

	nextPage(){
		if(this.options.pagination && this.modExists("page")){
			this.modules.page.nextPage();
		}else{
			return false;
		}
	}

	getPage(){
		if(this.options.pagination && this.modExists("page")){
			return this.modules.page.getPage();
		}else{
			return false;
		}
	}

	getPageMax(){
		if(this.options.pagination && this.modExists("page")){
			return this.modules.page.getPageMax();
		}else{
			return false;
		}
	}

	///////////////// Grouping Functions ///////////////
	setGroupBy(groups){
		if(this.modExists("groupRows", true)){
			this.options.groupBy = groups;
			this.modules.groupRows.initialize();
			this.rowManager.refreshActiveData("display");

			if(this.options.persistence && this.modExists("persistence", true) && this.modules.persistence.config.group){
				this.modules.persistence.save("group");
			}
		}else{
			return false;
		}
	}

	setGroupValues(groupValues){
		if(this.modExists("groupRows", true)){
			this.options.groupValues = groupValues;
			this.modules.groupRows.initialize();
			this.rowManager.refreshActiveData("display");

			if(this.options.persistence && this.modExists("persistence", true) && this.modules.persistence.config.group){
				this.modules.persistence.save("group");
			}
		}else{
			return false;
		}
	}

	setGroupStartOpen(values){
		if(this.modExists("groupRows", true)){
			this.options.groupStartOpen = values;
			this.modules.groupRows.initialize();
			if(this.options.groupBy){
				this.rowManager.refreshActiveData("group");

				if(this.options.persistence && this.modExists("persistence", true) && this.modules.persistence.config.group){
					this.modules.persistence.save("group");
				}
			}else{
				console.warn("Grouping Update - cant refresh view, no groups have been set");
			}
		}else{
			return false;
		}
	}

	setGroupHeader(values){
		if(this.modExists("groupRows", true)){
			this.options.groupHeader = values;
			this.modules.groupRows.initialize();
			if(this.options.groupBy){
				this.rowManager.refreshActiveData("group");

				if(this.options.persistence && this.modExists("persistence", true) && this.modules.persistence.config.group){
					this.modules.persistence.save("group");
				}
			}else{
				console.warn("Grouping Update - cant refresh view, no groups have been set");
			}
		}else{
			return false;
		}
	}

	getGroups(values){
		if(this.modExists("groupRows", true)){
			return this.modules.groupRows.getGroups(true);
		}else{
			return false;
		}
	}

	// get grouped table data in the same format as getData()
	getGroupedData(){
		if (this.modExists("groupRows", true)){
			return this.options.groupBy ?
			this.modules.groupRows.getGroupedData() : this.getData()
		}
	}

	getEditedCells(){
		if(this.modExists("edit", true)){
			return this.modules.edit.getEditedCells();
		}
	}

	clearCellEdited(cells){
		if(this.modExists("edit", true)){

			if(!cells){
				cells = this.modules.edit.getEditedCells();
			}

			if(!Array.isArray(cells)){
				cells = [cells];
			}

			cells.forEach((cell) => {
				this.modules.edit.clearEdited(cell._getSelf());
			});
		}
	}

	///////////////// Column Calculation Functions ///////////////
	getCalcResults(){
		if(this.modExists("columnCalcs", true)){
			return this.modules.columnCalcs.getResults();
		}else{
			return false;
		}
	}

	recalc(){
		if(this.modExists("columnCalcs", true)){
			this.modules.columnCalcs.recalcAll(this.rowManager.activeRows);
		}
	}

	/////////////// Navigation Management //////////////
	navigatePrev(){
		var cell = false;

		if(this.modExists("edit", true)){
			cell = this.modules.edit.currentCell;

			if(cell){
				return cell.nav().prev();
			}
		}

		return false;
	}

	navigateNext(){
		var cell = false;

		if(this.modExists("edit", true)){
			cell = this.modules.edit.currentCell;

			if(cell){
				return cell.nav().next();
			}
		}

		return false;
	}

	navigateLeft(){
		var cell = false;

		if(this.modExists("edit", true)){
			cell = this.modules.edit.currentCell;

			if(cell){
				e.preventDefault();
				return cell.nav().left();
			}
		}

		return false;
	}

	navigateRight(){
		var cell = false;

		if(this.modExists("edit", true)){
			cell = this.modules.edit.currentCell;

			if(cell){
				e.preventDefault();
				return cell.nav().right();
			}
		}

		return false;
	}

	navigateUp(){
		var cell = false;

		if(this.modExists("edit", true)){
			cell = this.modules.edit.currentCell;

			if(cell){
				e.preventDefault();
				return cell.nav().up();
			}
		}

		return false;
	}

	navigateDown(){
		var cell = false;

		if(this.modExists("edit", true)){
			cell = this.modules.edit.currentCell;

			if(cell){
				e.preventDefault();
				return cell.nav().down();
			}
		}

		return false;
	}

	/////////////// History Management //////////////
	undo(){
		if(this.options.history && this.modExists("history", true)){
			return this.modules.history.undo();
		}else{
			return false;
		}
	}

	redo(){
		if(this.options.history && this.modExists("history", true)){
			return this.modules.history.redo();
		}else{
			return false;
		}
	}

	getHistoryUndoSize(){
		if(this.options.history && this.modExists("history", true)){
			return this.modules.history.getHistoryUndoSize();
		}else{
			return false;
		}
	}

	getHistoryRedoSize(){
		if(this.options.history && this.modExists("history", true)){
			return this.modules.history.getHistoryRedoSize();
		}else{
			return false;
		}
	}

	clearHistory(){
		if(this.options.history && this.modExists("history", true)){
			return this.modules.history.clear();
		}else{
			return false;
		}
	}

	/////////////// Download Management //////////////
	download(type, filename, options, active){
		if(this.modExists("download", true)){
			this.modules.download.download(type, filename, options, active);
		}
	}

	downloadToTab(type, filename, options, active){
		if(this.modExists("download", true)){
			this.modules.download.download(type, filename, options, active, true);
		}
	}

	/////////// Inter Table Communications ///////////
	tableComms(table, module, action, data){
		this.modules.comms.receive(table, module, action, data);
	}

	////////////// Extension Management //////////////
	modExists(plugin, required){
		if(this.modules[plugin]){
			return true;
		}else{
			if(required){
				console.error("Tabulator Module Not Installed: " + plugin);
			}
			return false;
		}
	}

	//ensure that module are bound to instantiated function
	bindModules(){
		this.modules = {};

		for(var name in Tabulator.prototype.moduleBindings){
			this.modules[name] = new Tabulator.prototype.moduleBindings[name](this);
		}
	}

	//extend module
	static extendModule = function(name, property, values){
		if(Tabulator.prototype.moduleBindings[name]){
			var source = Tabulator.prototype.moduleBindings[name].prototype[property];

			if(source){
				if(typeof values == "object"){
					for(let key in values){
						source[key] = values[key];
					}
				}else{
					console.warn("Module Error - Invalid value type, it must be an object");
				}
			}else{
				console.warn("Module Error - property does not exist:", property);
			}
		}else{
			console.warn("Module Error - module does not exist:", name);
		}
	};

	//add module to tabulator
	static registerModule(name, module){
		var self = this;
		Tabulator.prototype.moduleBindings[name] = module;
	};

	static helpers = {

		elVisible: function(el){
			return !(el.offsetWidth <= 0 && el.offsetHeight <= 0);
		},

		elOffset: function(el){
			var box = el.getBoundingClientRect();

			return {
				top: box.top + window.pageYOffset - document.documentElement.clientTop,
				left: box.left + window.pageXOffset - document.documentElement.clientLeft
			};
		},

		deepClone: function(obj){
			var clone = Object.assign(Array.isArray(obj) ? [] : {}, obj);

			for(var i in obj) {
				if(obj[i] != null && typeof(obj[i])  === "object"){
					if (obj[i] instanceof Date) {
						clone[i] = new Date(obj[i]);
					} else {
						clone[i] = this.deepClone(obj[i]);
					}
				}
			}
			return clone;
		}
	};

	static comms = {
		tables:[],
		register:function(table){
			Tabulator.prototype.comms.tables.push(table);
		},
		deregister:function(table){
			var index = Tabulator.prototype.comms.tables.indexOf(table);

			if(index > -1){
				Tabulator.prototype.comms.tables.splice(index, 1);
			}
		},
		lookupTable:function(query, silent){
			var results = [],
			matches, match;

			if(typeof query === "string"){
				matches = document.querySelectorAll(query);

				if(matches.length){
					for(var i = 0; i < matches.length; i++){
						match = Tabulator.prototype.comms.matchElement(matches[i]);

						if(match){
							results.push(match);
						}
					}
				}

			}else if((typeof HTMLElement !== "undefined" && query instanceof HTMLElement) || query instanceof Tabulator){
				match = Tabulator.prototype.comms.matchElement(query);

				if(match){
					results.push(match);
				}
			}else if(Array.isArray(query)){
				query.forEach(function(item){
					results = results.concat(Tabulator.prototype.comms.lookupTable(item));
				});
			}else{
				if(!silent){
					console.warn("Table Connection Error - Invalid Selector", query);
				}
			}

			return results;
		},
		matchElement:function(element){
			return Tabulator.prototype.comms.tables.find(function(table){
				return element instanceof Tabulator ? table === element : table.element === element;
			});
		}
	};

	static findTable(query){
		var results = Tabulator.prototype.comms.lookupTable(query, true);
		return Array.isArray(results) && !results.length ? false : results;
	}
}
