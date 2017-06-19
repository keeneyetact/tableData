
//public row object
var CellComponent = function (cell){

	var obj = {
		getValue:function(){
			return cell.getValue();
		},

		getOldValue:function(){
			return cell.getOldValue();
		},

		getElement:function(){
			return cell.getElement();
		},

		getRow:function(){
			return cell.row.getComponent();
		},

		getColumn:function(){
			return cell.column.getComponent();
		},

		setValue:function(value, mutate){
			if(typeof mutate == "undefined"){
				mutate = true;
			}

			cell.setValue(value, mutate);
		},

		edit:function(){
			cell.edit();
		},

		nav:function(){
			return cell.nav();
		},

		checkHeight:function(){
			cell.checkHeight();
		},

		_getSelf:function(){
			return cell;
		},
	}

	return obj;
};

var Cell = function(column, row){

	this.table = column.table;
	this.column = column;
	this.row = row;
	this.element = $("<div class='tabulator-cell' role='gridcell'></div>");
	this.value = null;
	this.oldValue = null;

	this.height = null;
	this.width = null;
	this.minWidth = null;

	this.generateElement();
};

//////////////// Setup Functions /////////////////

//generate element
Cell.prototype.generateElement = function(){
	this.setWidth(this.column.width);

	this._configureCell();

	this.setValueProcessData(this.row.data[this.column.getField()]);
};


Cell.prototype._configureCell = function(){
	var self = this,
	cellEvents = self.column.cellEvents,
	element = self.element,
	field = this.column.getField();

	//set text alignment
	element.css("text-align", typeof(self.column.definition.align) == "undefined" ? "" : self.column.definition.align);

	if(field){
		element.attr("tabulator-field", field);
	}

	if(self.column.definition.cssClass){
		element.addClass(self.column.definition.cssClass);
	}

	//set event bindings
	if (cellEvents.cellClick){
		self.element.on("click", function(e){
			cellEvents.cellClick(e, self.getComponent());
		});
	}

	if (cellEvents.cellDblClick){
		self.element.on("dblclick", function(e){
			cellEvents.cellDblClick(e, self.getComponent());
		});
	}

	if (cellEvents.cellContext){
		self.element.on("contextmenu", function(e){
			cellEvents.cellContext(e, self.getComponent());
		});
	}

	if(self.column.extensions.edit){
		self.table.extensions.edit.bindEditor(self);
	}

	if(self.column.definition.rowHandle && self.table.options.movableRows !== false && self.table.extExists("moveRow")){
		self.table.extensions.moveRow.initializeCell(self);
	}

	if(self.column.visible){
		self.show();
	}else{
		self.hide();
	}
};

//generate cell contents
Cell.prototype._generateContents = function(){
	var self = this;

	if(self.table.extExists("format")){
		self.element.html(self.table.extensions.format.formatValue(self));
	}else{
		self.element.html(self.value);
	}
};

//generate tooltip text
Cell.prototype._generateTooltip = function(){
	var self = this;

	var tooltip = self.column.definition.tooltip || self.column.definition.tooltip === false ? self.column.definition.tooltip : self.table.options.tooltips;

	if(tooltip){
		if(tooltip === true){
			tooltip = self.value;
		}else if(typeof(tooltip) == "function"){
			tooltip = tooltip(self.getComponent());
		}

		self.element.attr("title", tooltip);
	}else{
		self.element.attr("title", "");
	}
};


//////////////////// Getters ////////////////////
Cell.prototype.getElement = function(){
	return this.element;
};

Cell.prototype.getValue = function(){
	return this.value;
};

Cell.prototype.getOldValue = function(){
	return this.oldValue;
};

//////////////////// Actions ////////////////////

Cell.prototype.setValue = function(value, mutate){

	var changed = this.setValueProcessData(value, mutate);

	if(changed){
		if(this.table.options.history && this.table.extExists("history")){
			this.table.extensions.history.action("cellEdit", this, {oldValue:this.oldValue, newValue:this.value});
		};

		this.table.options.cellEdited(this.getComponent());
		this.table.options.dataEdited(this.table.rowManager.getData());
	}

};

Cell.prototype.setValueProcessData = function(value, mutate){
	var changed = false;

	if(this.value != value){

		changed = true;

		if(mutate){
			if(this.column.extensions.mutate && this.column.extensions.mutate.type !== "data"){
				value = this.table.extensions.mutator.transformCell(cell, value);
			}
		}
	}

	this.setValueActual(value);

	return changed;
}

Cell.prototype.setValueActual = function(value){
	this.oldValue = this.value;

	this.value = value;
	this.row.data[this.column.getField()] = value;

	this._generateContents();
	this._generateTooltip();

	//set resizable handles
	if(this.table.options.resizableColumns && this.table.extExists("resizeColumns")){
		this.table.extensions.resizeColumns.initializeColumn(this.column, this.element);
	}

	//handle frozen cells
	if(this.table.extExists("frozenColumns")){
		this.table.extensions.frozenColumns.layoutElement(this.element, this.column);
	}
};

Cell.prototype.setWidth = function(width){
	this.width = width;
	this.element.css("width", width || "");
};

Cell.prototype.getWidth = function(){
	return this.width || this.element.outerWidth();
};

Cell.prototype.setMinWidth = function(minWidth){
	this.minWidth = minWidth;
	this.element.css("min-width", minWidth || "");
};

Cell.prototype.checkHeight = function(){
	var height = this.element.css("height");

	if(this.element.is(":visible") && height){
		this.element.css("height", "");

		if(this.element.outerHeight() != parseInt(height)){
			this.row.normalizeHeight(true);
		}else{
			this.element.css("height", height);
		}
	}else{
		this.row.reinitialize();
	}
};

Cell.prototype.setHeight = function(height){
	this.height = height;
	this.element.css("height", height || "");
};

Cell.prototype.getHeight = function(){
	return this.height || this.element.outerHeight();
};

Cell.prototype.show = function(){
	this.element.css("display","");
};

Cell.prototype.hide = function(){
	this.element.css("display","none");
};

Cell.prototype.edit = function(){
	this.element.focus();
};

Cell.prototype.delete = function(){
	this.element.detach();
	this.column.deleteCell(this);
	this.row.deleteCell(this);
};

//////////////// Navigation /////////////////

Cell.prototype.nav = function(){

	var self = this,
	nextCell = false,
	index = this.row.getCellIndex(this);

	return {
		next:function(){

			var nextCell = this.right(),
			nextRow;

			if(!nextCell){
				nextRow = self.table.rowManager.nextDisplayRow(self.row);

				if(nextRow){
					nextCell = nextRow.findNextEditableCell(-1);

					if(nextCell){
						nextCell.edit();
						return true;
					}
				}

			}

			return false;

		},
		prev:function(){
			var nextCell = this.left(),
			prevRow;

			if(!nextCell){
				prevRow = self.table.rowManager.prevDisplayRow(self.row);

				if(prevRow){
					nextCell = prevRow.findPrevEditableCell(prevRow.cells.length);

					if(nextCell){
						nextCell.edit();
						return true;
					}
				}

			}

			return false;

		},
		left:function(){

			nextCell = self.row.findPrevEditableCell(index);

			if(nextCell){
				nextCell.edit();
				return true;
			}else{
				return false;
			}

		},
		right:function(){
			nextCell = self.row.findNextEditableCell(index);

			if(nextCell){
				nextCell.edit();
				return true;
			}else{
				return false;
			}
		},
		up:function(){
			var nextRow = self.table.rowManager.prevDisplayRow(self.row);

			if(nextRow){
				nextRow.cells[index].edit();
			}
		},
		down:function(){
			var nextRow = self.table.rowManager.nextDisplayRow(self.row);

			if(nextRow){
				nextRow.cells[index].edit();
			}
		},

	}

};

Cell.prototype.getIndex = function(){
	this.row.getCellIndex(this);
};

//////////////// Object Generation /////////////////
Cell.prototype.getComponent = function(){
	return new CellComponent(this);
};