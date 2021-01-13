import ColumnComponent from './ColumnComponent.js';
import defaultOptions from './defaults/options.js';

import Cell from '../cell/Cell.js';

class Column {

	constructor(def, parent){
		this.table = parent.table;
		this.definition = def; //column definition
		this.parent = parent; //hold parent object
		this.type = "column"; //type of element
		this.columns = []; //child columns
		this.cells = []; //cells bound to this column
		this.element = this.createElement(); //column header element
		this.contentElement = false;
		this.titleHolderElement = false;
		this.titleElement = false;
		this.groupElement = this.createGroupElement(); //column group holder element
		this.isGroup = false;
		this.tooltip = false; //hold column tooltip
		this.hozAlign = ""; //horizontal text alignment
		this.vertAlign = ""; //vert text alignment

		//multi dimensional filed handling
		this.field ="";
		this.fieldStructure = "";
		this.getFieldValue = "";
		this.setFieldValue = "";

		this.titleFormatterRendered = false;

		this.setField(this.definition.field);

		if(this.table.options.invalidOptionWarnings){
			this.checkDefinition();
		}

		this.modules = {}; //hold module variables;

		this.cellEvents = {
			cellClick:false,
			cellDblClick:false,
			cellContext:false,
			cellTap:false,
			cellDblTap:false,
			cellTapHold:false,
			cellMouseEnter:false,
			cellMouseLeave:false,
			cellMouseOver:false,
			cellMouseOut:false,
			cellMouseMove:false,
		};

		this.width = null; //column width
		this.widthStyled = ""; //column width prestyled to improve render efficiency
		this.maxWidth = null; //column maximum width
		this.maxWidthStyled = ""; //column maximum prestyled to improve render efficiency
		this.minWidth = null; //column minimum width
		this.minWidthStyled = ""; //column minimum prestyled to improve render efficiency
		this.widthFixed = false; //user has specified a width for this column

		this.visible = true; //default visible state

		this.component = null;

		this._mapDepricatedFunctionality();

		//initialize column
		if(def.columns){

			this.isGroup = true;

			def.columns.forEach((def, i) => {
				var newCol = new Column(def, this);
				this.attachColumn(newCol);
			});

			this.checkColumnVisibility();
		}else{
			parent.registerColumnField(this);
		}

		if(def.rowHandle && this.table.options.movableRows !== false && this.table.modExists("moveRow")){
			this.table.modules.moveRow.setHandle(true);
		}

		this._buildHeader();

		this.bindModuleColumns();
	}

	createElement (){
		var el = document.createElement("div");

		el.classList.add("tabulator-col");
		el.setAttribute("role", "columnheader");
		el.setAttribute("aria-sort", "none");

		return el;
	}

	createGroupElement (){
		var el = document.createElement("div");

		el.classList.add("tabulator-col-group-cols");

		return el;
	}

	checkDefinition(){
		Object.keys(this.definition).forEach((key) => {
			if(Column.defaultOptionList.indexOf(key) === -1){
				console.warn("Invalid column definition option in '" + (this.field || this.definition.title) + "' column:", key)
			}
		});
	}

	setField(field){
		this.field = field;
		this.fieldStructure = field ? (this.table.options.nestedFieldSeparator ? field.split(this.table.options.nestedFieldSeparator) : [field]) : [];
		this.getFieldValue = this.fieldStructure.length > 1 ? this._getNestedData : this._getFlatData;
		this.setFieldValue = this.fieldStructure.length > 1 ? this._setNestedData : this._setFlatData;
	}

	//register column position with column manager
	registerColumnPosition(column){
		this.parent.registerColumnPosition(column);
	}

	//register column position with column manager
	registerColumnField(column){
		this.parent.registerColumnField(column);
	}

	//trigger position registration
	reRegisterPosition(){
		if(this.isGroup){
			this.columns.forEach(function(column){
				column.reRegisterPosition();
			});
		}else{
			this.registerColumnPosition(this);
		}
	}

	_mapDepricatedFunctionality(){
		if(typeof this.definition.hideInHtml !== "undefined"){
			this.definition.htmlOutput = !this.definition.hideInHtml;
			console.warn("hideInHtml column definition property is deprecated, you should now use htmlOutput")
		}

		if(typeof this.definition.align !== "undefined"){
			this.definition.hozAlign = this.definition.align;
			console.warn("align column definition property is deprecated, you should now use hozAlign");
		}

		if(typeof this.definition.downloadTitle !== "undefined"){
			this.definition.titleDownload = this.definition.downloadTitle;
			console.warn("downloadTitle definition property is deprecated, you should now use titleDownload");
		}
	}

	setTooltip(){
		var def = this.definition;

		//set header tooltips
		var tooltip = def.headerTooltip || def.tooltip === false  ? def.headerTooltip : this.table.options.tooltipsHeader;

		if(tooltip){
			if(tooltip === true){
				if(def.field){
					this.table.modules.localize.bind("columns|" + def.field, (value) => {
						this.element.setAttribute("title", value || def.title);
					});
				}else{
					this.element.setAttribute("title", def.title);
				}

			}else{
				if(typeof(tooltip) == "function"){
					tooltip = tooltip(this.getComponent());

					if(tooltip === false){
						tooltip = "";
					}
				}

				this.element.setAttribute("title", tooltip);
			}

		}else{
			this.element.setAttribute("title", "");
		}
	}

	//build header element
	_buildHeader(){
		var def = this.definition;

		while(this.element.firstChild) this.element.removeChild(this.element.firstChild);

		if(def.headerVertical){
			this.element.classList.add("tabulator-col-vertical");

			if(def.headerVertical === "flip"){
				this.element.classList.add("tabulator-col-vertical-flip");
			}
		}

		this.contentElement = this._bindEvents();

		this.contentElement = this._buildColumnHeaderContent();

		this.element.appendChild(this.contentElement);

		if(this.isGroup){
			this._buildGroupHeader();
		}else{
			this._buildColumnHeader();
		}

		this.setTooltip();

		//set resizable handles
		if(this.table.options.resizableColumns && this.table.modExists("resizeColumns")){
			this.table.modules.resizeColumns.initializeColumn("header", this, this.element);
		}

		//set resizable handles
		if(def.headerFilter && this.table.modExists("filter") && this.table.modExists("edit")){
			if(typeof def.headerFilterPlaceholder !== "undefined" && def.field){
				this.table.modules.localize.setHeaderFilterColumnPlaceholder(def.field, def.headerFilterPlaceholder);
			}

			this.table.modules.filter.initializeColumn(this);
		}


		//set resizable handles
		if(this.table.modExists("frozenColumns")){
			this.table.modules.frozenColumns.initializeColumn(this);
		}

		//set movable column
		if(this.table.options.movableColumns && !this.isGroup && this.table.modExists("moveColumn")){
			this.table.modules.moveColumn.initializeColumn(this);
		}

		//set calcs column
		if((def.topCalc || def.bottomCalc) && this.table.modExists("columnCalcs")){
			this.table.modules.columnCalcs.initializeColumn(this);
		}

		//handle persistence
		if(this.table.modExists("persistence") && this.table.modules.persistence.config.columns){
			this.table.modules.persistence.initializeColumn(this);
		}


		//update header tooltip on mouse enter
		this.element.addEventListener("mouseenter", (e) => {
			this.setTooltip();
		});
	}

	_bindEvents(){
		var def = this.definition,
		dblTap,	tapHold, tap;

		//setup header click event bindings
		if(typeof(def.headerClick) == "function"){
			this.element.addEventListener("click", (e) => {def.headerClick(e, this.getComponent());});
		}

		if(typeof(def.headerDblClick) == "function"){
			this.element.addEventListener("dblclick", (e) => {def.headerDblClick(e, this.getComponent());});
		}

		if(typeof(def.headerContext) == "function"){
			this.element.addEventListener("contextmenu", (e) => {def.headerContext(e, this.getComponent());});
		}

		//setup header tap event bindings
		if(typeof(def.headerTap) == "function"){
			tap = false;

			this.element.addEventListener("touchstart", (e) => {
				tap = true;
			}, {passive: true});

			this.element.addEventListener("touchend", (e) => {
				if(tap){
					def.headerTap(e, this.getComponent());
				}

				tap = false;
			});
		}

		if(typeof(def.headerDblTap) == "function"){
			dblTap = null;

			this.element.addEventListener("touchend", (e) => {

				if(dblTap){
					clearTimeout(dblTap);
					dblTap = null;

					def.headerDblTap(e, this.getComponent());
				}else{

					dblTap = setTimeout(() => {
						clearTimeout(dblTap);
						dblTap = null;
					}, 300);
				}

			});
		}

		if(typeof(def.headerTapHold) == "function"){
			tapHold = null;

			this.element.addEventListener("touchstart", (e) => {
				clearTimeout(tapHold);

				tapHold = setTimeout(function(){
					clearTimeout(tapHold);
					tapHold = null;
					tap = false;
					def.headerTapHold(e, this.getComponent());
				}, 1000);

			}, {passive: true});

			this.element.addEventListener("touchend", (e) => {
				clearTimeout(tapHold);
				tapHold = null;
			});
		}

		//store column cell click event bindings
		if(typeof(def.cellClick) == "function"){
			this.cellEvents.cellClick = def.cellClick;
		}

		if(typeof(def.cellDblClick) == "function"){
			this.cellEvents.cellDblClick = def.cellDblClick;
		}

		if(typeof(def.cellContext) == "function"){
			this.cellEvents.cellContext = def.cellContext;
		}

		//store column mouse event bindings
		if(typeof(def.cellMouseEnter) == "function"){
			this.cellEvents.cellMouseEnter = def.cellMouseEnter;
		}

		if(typeof(def.cellMouseLeave) == "function"){
			this.cellEvents.cellMouseLeave = def.cellMouseLeave;
		}

		if(typeof(def.cellMouseOver) == "function"){
			this.cellEvents.cellMouseOver = def.cellMouseOver;
		}

		if(typeof(def.cellMouseOut) == "function"){
			this.cellEvents.cellMouseOut = def.cellMouseOut;
		}

		if(typeof(def.cellMouseMove) == "function"){
			this.cellEvents.cellMouseMove = def.cellMouseMove;
		}

		//setup column cell tap event bindings
		if(typeof(def.cellTap) == "function"){
			this.cellEvents.cellTap = def.cellTap;
		}

		if(typeof(def.cellDblTap) == "function"){
			this.cellEvents.cellDblTap = def.cellDblTap;
		}

		if(typeof(def.cellTapHold) == "function"){
			this.cellEvents.cellTapHold = def.cellTapHold;
		}

		//setup column cell edit callbacks
		if(typeof(def.cellEdited) == "function"){
			this.cellEvents.cellEdited = def.cellEdited;
		}

		if(typeof(def.cellEditing) == "function"){
			this.cellEvents.cellEditing = def.cellEditing;
		}

		if(typeof(def.cellEditCancelled) == "function"){
			this.cellEvents.cellEditCancelled = def.cellEditCancelled;
		}
	}

	//build header element for header
	_buildColumnHeader(){
		var def = this.definition,
		table = this.table,
		sortable;

		//set column sorter
		if(table.modExists("sort")){
			table.modules.sort.initializeColumn(this, this.titleHolderElement);
		}

		//set column header context menu
		if((def.headerContextMenu || def.headerClickMenu || def.headerMenu) && table.modExists("menu")){
			table.modules.menu.initializeColumnHeader(this);
		}

		//set column formatter
		if(table.modExists("format")){
			table.modules.format.initializeColumn(this);
		}

		//set column editor
		if(typeof def.editor != "undefined" && table.modExists("edit")){
			table.modules.edit.initializeColumn(this);
		}

		//set colum validator
		if(typeof def.validator != "undefined" && table.modExists("validate")){
			table.modules.validate.initializeColumn(this);
		}


		//set column mutator
		if(table.modExists("mutator")){
			table.modules.mutator.initializeColumn(this);
		}

		//set column accessor
		if(table.modExists("accessor")){
			table.modules.accessor.initializeColumn(this);
		}

		//set respoviveLayout
		if(typeof table.options.responsiveLayout && table.modExists("responsiveLayout")){
			table.modules.responsiveLayout.initializeColumn(this);
		}

		//set column visibility
		if(typeof def.visible != "undefined"){
			if(def.visible){
				this.show(true);
			}else{
				this.hide(true);
			}
		}

		//asign additional css classes to column header
		if(def.cssClass){
			var classeNames = def.cssClass.split(" ");
			classeNames.forEach((className) => {
				this.element.classList.add(className);
			});
		}

		if(def.field){
			this.element.setAttribute("tabulator-field", def.field);
		}

		//set min width if present
		this.setMinWidth(typeof def.minWidth == "undefined" ? this.table.options.columnMinWidth : parseInt(def.minWidth));

		if(def.maxWidth || this.table.options.columnMaxWidth){
			if(def.maxWidth !== false){
				this.setMaxWidth(typeof def.maxWidth == "undefined" ? this.table.options.columnMaxWidth : parseInt(def.maxWidth));
			}
		}

		this.reinitializeWidth();

		//set tooltip if present
		this.tooltip = this.definition.tooltip || this.definition.tooltip === false ? this.definition.tooltip : this.table.options.tooltips;

		//set orizontal text alignment
		this.hozAlign = typeof(this.definition.hozAlign) == "undefined" ? this.table.options.cellHozAlign : this.definition.hozAlign;
		this.vertAlign = typeof(this.definition.vertAlign) == "undefined" ? this.table.options.cellVertAlign : this.definition.vertAlign;

		this.titleElement.style.textAlign = this.definition.headerHozAlign || this.table.options.headerHozAlign;
	}

	_buildColumnHeaderContent(){
		var def = this.definition,
		table = this.table;

		var contentElement = document.createElement("div");
		contentElement.classList.add("tabulator-col-content");

		this.titleHolderElement = document.createElement("div");
		this.titleHolderElement.classList.add("tabulator-col-title-holder");

		contentElement.appendChild(this.titleHolderElement);

		this.titleElement = this._buildColumnHeaderTitle();

		this.titleHolderElement.appendChild(this.titleElement);

		return contentElement;
	}

	//build title element of column
	_buildColumnHeaderTitle(){
		var def = this.definition,
		table = this.table,
		title;

		var titleHolderElement = document.createElement("div");
		titleHolderElement.classList.add("tabulator-col-title");

		if(def.editableTitle){
			var titleElement = document.createElement("input");
			titleElement.classList.add("tabulator-title-editor");

			titleElement.addEventListener("click", (e) => {
				e.stopPropagation();
				titleElement.focus();
			});

			titleElement.addEventListener("change", () => {
				def.title = titleElement.value;
				table.options.columnTitleChanged.call(this.table, this.getComponent());
			});

			titleHolderElement.appendChild(titleElement);

			if(def.field){
				table.modules.localize.bind("columns|" + def.field, (text) => {
					titleElement.value = text || (def.title || "&nbsp;");
				});
			}else{
				titleElement.value  = def.title || "&nbsp;";
			}

		}else{
			if(def.field){
				table.modules.localize.bind("columns|" + def.field, (text) => {
					this._formatColumnHeaderTitle(titleHolderElement, text || (def.title || "&nbsp;"));
				});
			}else{
				this._formatColumnHeaderTitle(titleHolderElement, def.title || "&nbsp;");
			}
		}

		return titleHolderElement;
	}

	_formatColumnHeaderTitle(el, title){
		var formatter, contents, params, mockCell, onRendered;

		if(this.definition.titleFormatter && this.table.modExists("format")){

			formatter = this.table.modules.format.getFormatter(this.definition.titleFormatter);

			onRendered = (callback) => {
				this.titleFormatterRendered = callback;
			};

			mockCell = {
				getValue:function(){
					return title;
				},
				getElement:function(){
					return el;
				}
			};

			params = this.definition.titleFormatterParams || {};

			params = typeof params === "function" ? params() : params;

			contents = formatter.call(this.table.modules.format, mockCell, params, onRendered);

			switch(typeof contents){
				case "object":
				if(contents instanceof Node){
					el.appendChild(contents);
				}else{
					el.innerHTML = "";
					console.warn("Format Error - Title formatter has returned a type of object, the only valid formatter object return is an instance of Node, the formatter returned:", contents);
				}
				break;
				case "undefined":
				case "null":
				el.innerHTML = "";
				break;
				default:
				el.innerHTML = contents;
			}
		}else{
			el.innerHTML = title;
		}
	}

	//build header element for column group
	_buildGroupHeader(){
		this.element.classList.add("tabulator-col-group");
		this.element.setAttribute("role", "columngroup");
		this.element.setAttribute("aria-title", this.definition.title);

		//asign additional css classes to column header
		if(this.definition.cssClass){
			var classeNames = this.definition.cssClass.split(" ");
			classeNames.forEach((className) => {
				this.element.classList.add(className);
			});
		}

		//set column header context menu
		if ((this.definition.headerContextMenu || this.definition.headerMenu) && this.table.modExists("menu")) {
			this.table.modules.menu.initializeColumnHeader(this);
		}

		this.titleElement.style.textAlign = this.definition.headerHozAlign || this.table.options.headerHozAlign;

		this.element.appendChild(this.groupElement);
	}

	//flat field lookup
	_getFlatData(data){
		return data[this.field];
	}

	//nested field lookup
	_getNestedData(data){
		var dataObj = data,
		structure = this.fieldStructure,
		length = structure.length,
		output;

		for(let i = 0; i < length; i++){

			dataObj = dataObj[structure[i]];

			output = dataObj;

			if(!dataObj){
				break;
			}
		}

		return output;
	}

	//flat field set
	_setFlatData(data, value){
		if(this.field){
			data[this.field] = value;
		}
	}

	//nested field set
	_setNestedData(data, value){
		var dataObj = data,
		structure = this.fieldStructure,
		length = structure.length;

		for(let i = 0; i < length; i++){

			if(i == length -1){
				dataObj[structure[i]] = value;
			}else{
				if(!dataObj[structure[i]]){
					if(typeof value !== "undefined"){
						dataObj[structure[i]] = {};
					}else{
						break;
					}
				}

				dataObj = dataObj[structure[i]];
			}
		}
	}

	//attach column to this group
	attachColumn(column){
		if(this.groupElement){
			this.columns.push(column);
			this.groupElement.appendChild(column.getElement());
		}else{
			console.warn("Column Warning - Column being attached to another column instead of column group");
		}
	}

	//vertically align header in column
	verticalAlign(alignment, height){

		//calculate height of column header and group holder element
		var parentHeight = this.parent.isGroup ? this.parent.getGroupElement().clientHeight : (height || this.parent.getHeadersElement().clientHeight);
		// var parentHeight = this.parent.isGroup ? this.parent.getGroupElement().clientHeight : this.parent.getHeadersElement().clientHeight;

		this.element.style.height = parentHeight + "px";

		if(this.isGroup){
			this.groupElement.style.minHeight = (parentHeight - this.contentElement.offsetHeight) + "px";
		}

		//vertically align cell contents
		if(!this.isGroup && alignment !== "top"){
			if(alignment === "bottom"){
				this.element.style.paddingTop = (this.element.clientHeight - this.contentElement.offsetHeight) + "px";
			}else{
				this.element.style.paddingTop = ((this.element.clientHeight - this.contentElement.offsetHeight) / 2) + "px";
			}
		}

		this.columns.forEach(function(column){
			column.verticalAlign(alignment);
		});
	}

	//clear vertical alignmenet
	clearVerticalAlign(){
		this.element.style.paddingTop = "";
		this.element.style.height = "";
		this.element.style.minHeight = "";
		this.groupElement.style.minHeight = "";

		this.columns.forEach(function(column){
			column.clearVerticalAlign();
		});
	}

	bindModuleColumns (){
		//check if rownum formatter is being used on a column
		if(this.definition.formatter == "rownum"){
			this.table.rowManager.rowNumColumn = this;
		}
	}

	//// Retreive Column Information ////
	//return column header element
	getElement(){
		return this.element;
	}

	//return colunm group element
	getGroupElement(){
		return this.groupElement;
	}

	//return field name
	getField(){
		return this.field;
	}

	//return the first column in a group
	getFirstColumn(){
		if(!this.isGroup){
			return this;
		}else{
			if(this.columns.length){
				return this.columns[0].getFirstColumn();
			}else{
				return false;
			}
		}
	}

	//return the last column in a group
	getLastColumn(){
		if(!this.isGroup){
			return this;
		}else{
			if(this.columns.length){
				return this.columns[this.columns.length -1].getLastColumn();
			}else{
				return false;
			}
		}
	}

	//return all columns in a group
	getColumns(){
		return this.columns;
	}

	//return all columns in a group
	getCells(){
		return this.cells;
	}

	//retreive the top column in a group of columns
	getTopColumn(){
		if(this.parent.isGroup){
			return this.parent.getTopColumn();
		}else{
			return this;
		}
	}

	//return column definition object
	getDefinition(updateBranches){
		var colDefs = [];

		if(this.isGroup && updateBranches){
			this.columns.forEach(function(column){
				colDefs.push(column.getDefinition(true));
			});

			this.definition.columns = colDefs;
		}

		return this.definition;
	}

	//////////////////// Actions ////////////////////
	checkColumnVisibility(){
		var visible = false;

		this.columns.forEach(function(column){
			if(column.visible){
				visible = true;
			}
		});

		if(visible){
			this.show();
			this.parent.table.options.columnVisibilityChanged.call(this.table, this.getComponent(), false);
		}else{
			this.hide();
		}
	}

	//show column
	show(silent, responsiveToggle){
		if(!this.visible){
			this.visible = true;

			this.element.style.display = "";

			if(this.parent.isGroup){
				this.parent.checkColumnVisibility();
			}

			this.cells.forEach(function(cell){
				cell.show();
			});

			if(!this.isGroup && this.width === null){
				this.reinitializeWidth();
			}

			this.table.columnManager._verticalAlignHeaders();

			if(this.table.options.persistence && this.table.modExists("persistence", true) && this.table.modules.persistence.config.columns){
				this.table.modules.persistence.save("columns");
			}

			if(!responsiveToggle && this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
				this.table.modules.responsiveLayout.updateColumnVisibility(this, this.visible);
			}

			if(!silent){
				this.table.options.columnVisibilityChanged.call(this.table, this.getComponent(), true);
			}

			if(this.parent.isGroup){
				this.parent.matchChildWidths();
			}

			if(!this.silent && this.table.options.virtualDomHoz){
				this.table.vdomHoz.reinitialize();
			}
		}
	}

	//hide column
	hide(silent, responsiveToggle){
		if(this.visible){
			this.visible = false;

			this.element.style.display = "none";

			this.table.columnManager._verticalAlignHeaders();

			if(this.parent.isGroup){
				this.parent.checkColumnVisibility();
			}

			this.cells.forEach(function(cell){
				cell.hide();
			});

			if(this.table.options.persistence && this.table.modExists("persistence", true) && this.table.modules.persistence.config.columns){
				this.table.modules.persistence.save("columns");
			}

			if(!responsiveToggle && this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
				this.table.modules.responsiveLayout.updateColumnVisibility(this, this.visible);
			}

			if(!silent){
				this.table.options.columnVisibilityChanged.call(this.table, this.getComponent(), false);
			}

			if(this.parent.isGroup){
				this.parent.matchChildWidths();
			}

			if(!this.silent && this.table.options.virtualDomHoz){
				this.table.vdomHoz.reinitialize();
			}
		}
	}

	matchChildWidths(){
		var childWidth = 0;

		if(this.contentElement && this.columns.length){
			this.columns.forEach(function(column){
				if(column.visible){
					childWidth += column.getWidth();
				}
			});

			this.contentElement.style.maxWidth = (childWidth - 1) + "px";

			if(this.parent.isGroup){
				this.parent.matchChildWidths();
			}
		}
	}

	removeChild(child){
		var index = this.columns.indexOf(child);

		if(index > -1){
			this.columns.splice(index, 1);
		}

		if(!this.columns.length){
			this.delete();
		}
	}

	setWidth(width){
		this.widthFixed = true;
		this.setWidthActual(width);
	}

	setWidthActual(width){
		if(isNaN(width)){
			width = Math.floor((this.table.element.clientWidth/100) * parseInt(width));
		}

		width = Math.max(this.minWidth, width);

		if(this.maxWidth){
			width = Math.min(this.maxWidth, width);
		}

		this.width = width;
		this.widthStyled = width ? width + "px" : "";

		this.element.style.width = this.widthStyled;

		if(!this.isGroup){
			this.cells.forEach(function(cell){
				cell.setWidth();
			});
		}

		if(this.parent.isGroup){
			this.parent.matchChildWidths();
		}

		//set resizable handles
		if(this.table.modExists("frozenColumns")){
			this.table.modules.frozenColumns.layout();
		}
	}

	checkCellHeights(){
		var rows = [];

		this.cells.forEach(function(cell){
			if(cell.row.heightInitialized){
				if(cell.row.getElement().offsetParent !== null){
					rows.push(cell.row);
					cell.row.clearCellHeight();
				}else{
					cell.row.heightInitialized = false;
				}
			}
		});

		rows.forEach(function(row){
			row.calcHeight();
		});

		rows.forEach(function(row){
			row.setCellHeight();
		});
	}

	getWidth(){
		var width = 0;

		if(this.isGroup){
			this.columns.forEach(function(column){
				if(column.visible){
					width += column.getWidth();
				}
			});
		}else{
			width = this.width;
		}

		return width;
	}

	getHeight(){
		return this.element.offsetHeight;
	}

	setMinWidth(minWidth){
		this.minWidth = minWidth;
		this.minWidthStyled = minWidth ? minWidth + "px" : "";

		this.element.style.minWidth = this.minWidthStyled;

		this.cells.forEach(function(cell){
			cell.setMinWidth();
		});
	}

	setMaxWidth(maxWidth){
		this.maxWidth = maxWidth;
		this.maxWidthStyled = maxWidth ? maxWidth + "px" : "";

		this.element.style.maxWidth = this.maxWidthStyled;

		this.cells.forEach(function(cell){
			cell.setMaxWidth();
		});
	}

	delete(){
		return new Promise((resolve, reject) => {
			var index;

			if(this.isGroup){
				this.columns.forEach(function(column){
					column.delete();
				});
			}

			//cancel edit if column is currently being edited
			if(this.table.modExists("edit")){
				if(this.table.modules.edit.currentCell.column === this){
					this.table.modules.edit.cancelEdit();
				}
			}

			var cellCount = this.cells.length;

			for(let i = 0; i < cellCount; i++){
				this.cells[0].delete();
			}

			if(this.element.parentNode){
				this.element.parentNode.removeChild(this.element);
			}

			this.element = false;
			this.contentElement = false;
			this.titleElement = false;
			this.groupElement = false;

			if(this.parent.isGroup){
				this.parent.removeChild(this);
			}

			this.table.columnManager.deregisterColumn(this);

			if(this.table.options.virtualDomHoz){
				this.table.vdomHoz.reinitialize(true);
			}

			resolve();
		});
	}

	columnRendered(){
		if(this.titleFormatterRendered){
			this.titleFormatterRendered();
		}
	}

	validate(){
		var invalid = [];

		this.cells.forEach(function(cell){
			if(!cell.validate()){
				invalid.push(cell.getComponent());
			}
		});

		return invalid.length ? invalid : true;
	}

	//////////////// Cell Management /////////////////
	//generate cell for this column
	generateCell(row){
		var cell = new Cell(this, row);

		this.cells.push(cell);

		return cell;
	}

	nextColumn(){
		var index = this.table.columnManager.findColumnIndex(this);
		return index > -1 ? this._nextVisibleColumn(index + 1) : false;
	}

	_nextVisibleColumn(index){
		var column = this.table.columnManager.getColumnByIndex(index);
		return !column || column.visible ? column : this._nextVisibleColumn(index + 1);
	}

	prevColumn(){
		var index = this.table.columnManager.findColumnIndex(this);
		return index > -1 ? this._prevVisibleColumn(index - 1) : false;
	}

	_prevVisibleColumn(index){
		var column = this.table.columnManager.getColumnByIndex(index);
		return !column || column.visible ? column : this._prevVisibleColumn(index - 1);
	}

	reinitializeWidth(force){
		this.widthFixed = false;

		//set width if present
		if(typeof this.definition.width !== "undefined" && !force){
			this.setWidth(this.definition.width);
		}

		//hide header filters to prevent them altering column width
		if(this.table.modExists("filter")){
			this.table.modules.filter.hideHeaderFilterElements();
		}

		this.fitToData();

		//show header filters again after layout is complete
		if(this.table.modExists("filter")){
			this.table.modules.filter.showHeaderFilterElements();
		}
	}

	//set column width to maximum cell width
	fitToData(){
		if(!this.widthFixed){
			this.element.style.width = "";

			this.cells.forEach((cell) => {
				cell.clearWidth();
			});
		}

		var maxWidth = this.element.offsetWidth;

		if(!this.width || !this.widthFixed){
			this.cells.forEach((cell) => {
				var width = cell.getWidth();

				if(width > maxWidth){
					maxWidth = width;
				}
			});

			if(maxWidth){
				this.setWidthActual(maxWidth + 1);
			}
		}
	}

	updateDefinition(updates){
		return new Promise((resolve, reject) => {
			var definition;

			if(!this.isGroup){
				if(!this.parent.isGroup){
					definition = Object.assign({}, this.getDefinition());
					definition = Object.assign(definition, updates);

					this.table.columnManager.addColumn(definition, false, this)
					.then((column) => {

						if(definition.field == this.field){
							this.field = false; //cleair field name to prevent deletion of duplicate column from arrays
						}

						this.delete()
						.then(() => {
							resolve(column.getComponent());
						}).catch((err) => {
							reject(err);
						});

					}).catch((err) => {
						reject(err);
					});
				}else{
					console.warn("Column Update Error - The updateDefinition function is only available on ungrouped columns");
					reject("Column Update Error - The updateDefinition function is only available on columns, not column groups");
				}
			}else{
				console.warn("Column Update Error - The updateDefinition function is only available on ungrouped columns");
				reject("Column Update Error - The updateDefinition function is only available on columns, not column groups");
			}
		});
	}

	deleteCell(cell){
		var index = this.cells.indexOf(cell);

		if(index > -1){
			this.cells.splice(index, 1);
		}
	}

	//////////////// Object Generation /////////////////
	getComponent(){
		if(!this.component){
			this.component = new ColumnComponent(this);
		}

		return this.component;
	}
}

Column.defaultOptionList = defaultOptions;

export default Column;