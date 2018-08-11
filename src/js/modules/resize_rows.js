var ResizeRows = function(table){
	this.table = table; //hold Tabulator object
	this.startColumn = false;
	this.startY = false;
	this.startHeight = false;
	this.handle = null;
	this.prevHandle = null;
};

ResizeRows.prototype.initializeRow = function(row){
	var self = this;

	var handle = document.createElement('div');
	handle.className = "tabulator-row-resize-handle";

	var prevHandle = document.createElement('div');
	prevHandle.className = "tabulator-row-resize-handle prev";

	handle.addEventListener("click", function(e){
		e.stopPropagation();
	});

	handle.addEventListener("mousedown", function(e){
		self.startRow = row;
		self._mouseDown(e, row);
	});

	prevHandle.addEventListener("click", function(e){
		e.stopPropagation();
	});

	prevHandle.addEventListener("mousedown", function(e){
		var prevRow = self.table.rowManager.prevDisplayRow(row);

		if(prevRow){
			self.startRow = prevRow;
			self._mouseDown(e, prevRow);
		}
	});

	row.getElement().append(handle)
	.append(prevHandle);
};

ResizeRows.prototype._mouseDown = function(e, row){
	var self = this;

	self.table.element.classList.add("tabulator-block-select");

	function mouseMove(e){
		row.setHeight(self.startHeight + (e.screenY - self.startY));
	}

	function mouseUp(e){

		// //block editor from taking action while resizing is taking place
		// if(self.startColumn.modules.edit){
		// 	self.startColumn.modules.edit.blocked = false;
		// }

		$("body").off("mouseup", mouseMove);
		$("body").off("mousemove", mouseMove);

		self.table.element.classList.remove("tabulator-block-select");

		self.table.options.rowResized(row.getComponent());
	}

	e.stopPropagation(); //prevent resize from interfereing with movable columns

	//block editor from taking action while resizing is taking place
	// if(self.startColumn.modules.edit){
	// 	self.startColumn.modules.edit.blocked = true;
	// }

	self.startY = e.screenY;
	self.startHeight = row.getHeight();

	$("body").on("mousemove", mouseMove);

	$("body").on("mouseup", mouseUp);
};

Tabulator.prototype.registerModule("resizeRows", ResizeRows);