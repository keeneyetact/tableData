import Module from '../../module.js';

import defaultPasteActions from './defaults/pasteActions.js';
import defaultPasteParsers from './defaults/pasteParsers.js';

class Clipboard extends Module{

	//load defaults
	static pasteActions = defaultPasteActions;
	static pasteParsers = defaultPasteParsers;

	constructor(table){
		super(table, "clipboard");

		this.mode = true;
		this.pasteParser = function(){};
		this.pasteAction = function(){};
		this.customSelection = false;
		this.rowRange = false;
		this.blocked = true; //block copy actions not originating from this command
	}

	initialize(){
		this.mode = this.table.options.clipboard;

		this.rowRange = this.table.options.clipboardCopyRowRange;

		if(this.mode === true || this.mode === "copy"){
			this.table.element.addEventListener("copy", (e) => {
				var plain, html, list;

				if(!this.blocked){
					e.preventDefault();

					if(this.customSelection){
						plain = this.customSelection;

						if(this.table.options.clipboardCopyFormatter){
							plain = this.table.options.clipboardCopyFormatter("plain", plain);
						}
					}else{

						var list = this.table.modules.export.generateExportList(this.table.options.clipboardCopyConfig, this.table.options.clipboardCopyStyled, this.rowRange, "clipboard");

						html = this.table.modules.export.genereateHTMLTable(list);
						plain = html ? this.generatePlainContent(list) : "";

						if(this.table.options.clipboardCopyFormatter){
							plain = this.table.options.clipboardCopyFormatter("plain", plain);
							html = this.table.options.clipboardCopyFormatter("html", html);
						}
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

					this.table.options.clipboardCopied.call(this.table, plain, html);

					this.reset();
				}
			});
		}

		if(this.mode === true || this.mode === "paste"){
			this.table.element.addEventListener("paste", (e) => {
				this.paste(e);
			});
		}

		this.setPasteParser(this.table.options.clipboardPasteParser);
		this.setPasteAction(this.table.options.clipboardPasteAction);
	}

	reset(){
		this.blocked = true;
		this.customSelection = false;
	}

	generatePlainContent (list) {
		var output = [];

		list.forEach((row) => {
			var rowData = [];

			row.columns.forEach((col) => {
				var value = "";

				if(col){

					if(row.type === "group"){
						col.value = col.component.getKey();
					}

					if(col.value === null){
						value = "";
					}else{
						switch(typeof col.value){
							case "object":
							value = JSON.stringify(col.value);
							break;

							case "undefined":
							value = "";
							break;

							default:
							value = col.value;
						}
					}
				}

				rowData.push(value);
			});

			output.push(rowData.join("\t"));
		});

		return output.join("\n");
	}

	copy (range, internal) {
		var range, sel, textRange;
		this.blocked = false;
		this.customSelection = false;

		if (this.mode === true || this.mode === "copy") {

			this.rowRange = range || this.table.options.clipboardCopyRowRange;

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

			document.execCommand('copy');

			if (sel) {
				sel.removeAllRanges();
			}
		}
	}

	//PASTE EVENT HANDLING
	setPasteAction(action){

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
	}

	setPasteParser(parser){
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
	}

	paste(e){
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
	}

	mutateData(data){
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
	}


	checkPaseOrigin(e){
		var valid = true;

		if(e.target.tagName != "DIV" || this.table.modules.edit.currentCell){
			valid = false;
		}

		return valid;
	}

	getPasteData(e){
		var data;

		if (window.clipboardData && window.clipboardData.getData) {
			data = window.clipboardData.getData('Text');
		} else if (e.clipboardData && e.clipboardData.getData) {
			data = e.clipboardData.getData('text/plain');
		} else if (e.originalEvent && e.originalEvent.clipboardData.getData) {
			data = e.originalEvent.clipboardData.getData('text/plain');
		}

		return data;
	}
}

// Tabulator.prototype.registerModule("clipboard", Clipboard);
module.exports = Clipboard;