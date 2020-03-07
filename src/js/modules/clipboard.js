var Clipboard = function(table){
	this.table = table;
	this.mode = true;

	this.pasteParser = function(){};
	this.pasteAction = function(){};
	this.customSelection = false;
	this.config = {};

	this.blocked = true; //block copy actions not originating from this command
};

Clipboard.prototype.initialize = function(){
	this.mode = this.table.options.clipboard;

	if(this.mode === true || this.mode === "copy"){
		this.table.element.addEventListener("copy", (e) => {
			var plain, html;

			this.processConfig();

			if(!this.blocked){
				e.preventDefault();

				if(this.customSelection){
					plain = this.customSelection;
				}else{
					html = this.table.modules.export.getHtml(this.table.options.clipboardRowRange, this.table.options.clipboardCopyStyled, this.config, "clipboard");
					plain = html ? this.generatePlainContent(html) : "";
				}

				if (window.clipboardData && window.clipboardData.setData) {
					window.clipboardData.setData('Text', plain);
				} else if (e.clipboardData && e.clipboardData.setData) {
					e.clipboardData.setData('text/plain', plain);
					if(html){
						e.clipboardData.setData('text/html', html);
					}
				} else if (e.originalEvent && e.originalEvent.clipboardData.setData) {
					e.originalEvent.clipboardData.setData('text/plain', plain);
					if(html){
						e.originalEvent.clipboardData.setData('text/html', html);
					}
				}

				this.table.options.clipboardCopied.call(this.table, plain);

				this.reset();
			}
		});
	}

	if(this.mode === true || this.mode === "paste"){
		this.table.element.addEventListener("paste", function(e){
			this.paste(e);
		});
	}

	this.setPasteParser(this.table.options.clipboardPasteParser);
	this.setPasteAction(this.table.options.clipboardPasteAction);
};

Clipboard.prototype.processConfig = function(){
	var config = {
		columnHeaders:"groups",
		rowGroups:true,
		columnCalcs:true,
	};

	if(typeof this.table.options.clipboardCopyHeader !== "undefined"){
		config.columnHeaders = this.table.options.clipboardCopyHeader;
		console.warn("DEPRECATION WARNING - clipboardCopyHeader option has been deprecated, please use the columnHeaders property on the clipboardCopyConfig option");
	}

	if(this.table.options.clipboardCopyConfig){
		for(var key in this.table.options.clipboardCopyConfig){
			config[key] = this.table.options.clipboardCopyConfig[key];
		}
	}

	if (config.rowGroups && this.table.options.groupBy && this.table.modExists("groupRows")){
		this.config.rowGroups = true;
	}

	if(config.columnHeaders){
		if((config.columnHeaders === "groups" || config === true)  && this.table.columnManager.columns.length != this.table.columnManager.columnsByIndex.length){
			this.config.columnHeaders = "groups";
		}else{
			this.config.columnHeaders = "columns";
		}
	}else{
		this.config.columnHeaders = false;
	}

	if (config.columnCalcs && this.table.modExists("columnCalcs")){
		this.config.columnCalcs = true;
	}
};


Clipboard.prototype.reset = function(){
	this.blocked = false;
	this.originalSelectionText = "";
};


Clipboard.prototype.generatePlainContent = function (html) {
	var output = [];

	var holder = document.createElement("div");
	holder.innerHTML = html;

	var table = holder.getElementsByTagName("table")[0];
	var rows = Array.prototype.slice.call(table.getElementsByTagName("tr"));

	rows.forEach((row) => {
		var rowData = [];

		var headers = Array.prototype.slice.call(row.getElementsByTagName("th"));
		var cells = Array.prototype.slice.call(row.getElementsByTagName("td"));

		cells = cells.concat(headers);

		cells.forEach((cell) => {
			var val = cell.innerHTML;

			val = val == "&nbsp;" ? "" : val;

			rowData.push(val);
		});

		output.push(rowData.join("\t"));
	});

	return output.join("\n");
};

Clipboard.prototype.copy = function (selector, selectorParams, formatter, formatterParams, internal) {
	var range, sel, textRange;
	this.blocked = false;
	this.customSelection = false;

	if (this.mode === true || this.mode === "copy") {

		if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
			range = document.createRange();
			range.selectNodeContents(this.table.element);
			sel = window.getSelection();

			if (sel.toString() && internal) {
				this.customSelection = sel.toString();
			}

			sel.removeAllRanges();
			sel.addRange(range);
		} else if (typeof document.selection != "undefined" && typeof document.body.createTextRange != "undefined") {
			textRange = document.body.createTextRange();
			textRange.moveToElementText(this.table.element);
			textRange.select();
		}

		// this.setSelector(selector);
		// this.copySelectorParams = typeof selectorParams != "undefined" && selectorParams != null ? selectorParams : this.config.columnHeaders;
		// this.setFormatter(formatter);
		// this.copyFormatterParams = typeof formatterParams != "undefined" && formatterParams != null ? formatterParams : {};

		document.execCommand('copy');

		if (sel) {
			sel.removeAllRanges();
		}
	}
};



//PASTE EVENT HANDLING

Clipboard.prototype.setPasteAction = function(action){

	switch(typeof action){
		case "string":
		this.pasteAction = this.pasteActions[action];

		if(!this.pasteAction){
			console.warn("Clipboard Error - No such paste action found:", action);
		}
		break;

		case "function":
		this.pasteAction = action;
		break;
	}
};

Clipboard.prototype.setPasteParser = function(parser){
	switch(typeof parser){
		case "string":
		this.pasteParser = this.pasteParsers[parser];

		if(!this.pasteParser){
			console.warn("Clipboard Error - No such paste parser found:", parser);
		}
		break;

		case "function":
		this.pasteParser = parser;
		break;
	}
};


Clipboard.prototype.paste = function(e){
	var data, rowData, rows;

	if(this.checkPaseOrigin(e)){

		data = this.getPasteData(e);

		rowData = this.pasteParser.call(this, data);

		if(rowData){
			e.preventDefault();

			if(this.table.modExists("mutator")){
				rowData = this.mutateData(rowData);
			}

			rows = this.pasteAction.call(this, rowData);
			this.table.options.clipboardPasted.call(this.table, data, rowData, rows);
		}else{
			this.table.options.clipboardPasteError.call(this.table, data);
		}
	}
};

Clipboard.prototype.mutateData = function(data){
	var self = this,
	output = [];

	if(Array.isArray(data)){
		data.forEach(function(row){
			output.push(self.table.modules.mutator.transformRow(row, "clipboard"));
		});
	}else{
		output = data;
	}

	return output;
};


Clipboard.prototype.checkPaseOrigin = function(e){
	var valid = true;

	if(e.target.tagName != "DIV" || this.table.modules.edit.currentCell){
		valid = false;
	}

	return valid;
};

Clipboard.prototype.getPasteData = function(e){
	var data;

	if (window.clipboardData && window.clipboardData.getData) {
		data = window.clipboardData.getData('Text');
	} else if (e.clipboardData && e.clipboardData.getData) {
		data = e.clipboardData.getData('text/plain');
	} else if (e.originalEvent && e.originalEvent.clipboardData.getData) {
		data = e.originalEvent.clipboardData.getData('text/plain');
	}

	return data;
};


Clipboard.prototype.pasteParsers = {
	table:function(clipboard){
		var data = [],
		success = false,
		headerFindSuccess = true,
		columns = this.table.columnManager.columns,
		columnMap = [],
		rows = [];

		//get data from clipboard into array of columns and rows.
		clipboard = clipboard.split("\n");

		clipboard.forEach(function(row){
			data.push(row.split("\t"));
		});

		if(data.length && !(data.length === 1 && data[0].length < 2)){
			success = true;

			//check if headers are present by title
			data[0].forEach(function(value){
				var column = columns.find(function(column){
					return value && column.definition.title && value.trim() && column.definition.title.trim() === value.trim();
				});

				if(column){
					columnMap.push(column);
				}else{
					headerFindSuccess = false;
				}
			});

			//check if column headers are present by field
			if(!headerFindSuccess){
				headerFindSuccess = true;
				columnMap = [];

				data[0].forEach(function(value){
					var column = columns.find(function(column){
						return value && column.field && value.trim() && column.field.trim() === value.trim();
					});

					if(column){
						columnMap.push(column);
					}else{
						headerFindSuccess = false;
					}
				});

				if(!headerFindSuccess){
					columnMap = this.table.columnManager.columnsByIndex;
				}
			}

			//remove header row if found
			if(headerFindSuccess){
				data.shift();
			}

			data.forEach(function(item){
				var row = {};

				item.forEach(function(value, i){
					if(columnMap[i]){
						row[columnMap[i].field] = value;
					}
				});

				rows.push(row);
			});

			return rows;
		}else{
			return false;
		}
	}
};

Clipboard.prototype.pasteActions = {
	replace:function(rows){
		return this.table.setData(rows);
	},
	update:function(rows){
		return this.table.updateOrAddData(rows);
	},
	insert:function(rows){
		return this.table.addData(rows);
	},
};



Tabulator.prototype.registerModule("clipboard", Clipboard);
