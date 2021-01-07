import Module from '../../module.js';

import GroupComponent from './GroupComponent.js';
import Group from './Group.js';

class GroupRows extends Module{

	constructor(table){
		super(table);

		this.groupIDLookups = false; //enable table grouping and set field to group by
		this.startOpen = [function(){return false;}]; //starting state of group
		this.headerGenerator = [function(){return "";}];
		this.groupList = []; //ordered list of groups
		this.allowedValues = false;
		this.groups = {}; //hold row groups
		this.displayIndex = 0; //index in display pipeline
	}

	//initialize group configuration
	initialize(){
		var self = this,
		groupBy = self.table.options.groupBy,
		startOpen = self.table.options.groupStartOpen,
		groupHeader = self.table.options.groupHeader;

		this.allowedValues = self.table.options.groupValues;

		if(Array.isArray(groupBy) && Array.isArray(groupHeader) && groupBy.length > groupHeader.length){
			console.warn("Error creating group headers, groupHeader array is shorter than groupBy array");
		}

		self.headerGenerator = [function(){return "";}];
		this.startOpen = [function(){return false;}]; //starting state of group

		self.table.modules.localize.bind("groups|item", function(langValue, lang){
			self.headerGenerator[0] = function(value, count, data){ //header layout function
				return (typeof value === "undefined" ? "" : value) + "<span>(" + count + " " + ((count === 1) ? langValue : lang.groups.items) + ")</span>";
			};
		});

		this.groupIDLookups = [];

		if(Array.isArray(groupBy) || groupBy){
			if(this.table.modExists("columnCalcs") && this.table.options.columnCalcs != "table" && this.table.options.columnCalcs != "both"){
				this.table.modules.columnCalcs.removeCalcs();
			}
		}else{
			if(this.table.modExists("columnCalcs") && this.table.options.columnCalcs != "group"){

				var cols = this.table.columnManager.getRealColumns();

				cols.forEach(function(col){
					if(col.definition.topCalc){
						self.table.modules.columnCalcs.initializeTopRow();
					}

					if(col.definition.bottomCalc){
						self.table.modules.columnCalcs.initializeBottomRow();
					}
				});
			}
		}



		if(!Array.isArray(groupBy)){
			groupBy = [groupBy];
		}

		groupBy.forEach(function(group, i){
			var lookupFunc, column;

			if(typeof group == "function"){
				lookupFunc = group;
			}else{
				column = self.table.columnManager.getColumnByField(group);

				if(column){
					lookupFunc = function(data){
						return column.getFieldValue(data);
					};
				}else{
					lookupFunc = function(data){
						return data[group];
					};
				}
			}

			self.groupIDLookups.push({
				field: typeof group === "function" ? false : group,
				func:lookupFunc,
				values:self.allowedValues ? self.allowedValues[i] : false,
			});
		});

		if(startOpen){
			if(!Array.isArray(startOpen)){
				startOpen = [startOpen];
			}

			startOpen.forEach(function(level){
				level = typeof level == "function" ? level : function(){return true;};
			});

			self.startOpen = startOpen;
		}

		if(groupHeader){
			self.headerGenerator = Array.isArray(groupHeader) ? groupHeader : [groupHeader];
		}

		this.initialized = true;
	}

	setDisplayIndex(index){
		this.displayIndex = index;
	}

	getDisplayIndex(){
		return this.displayIndex;
	}

	//return appropriate rows with group headers
	getRows(rows){
		if(this.groupIDLookups.length){

			this.table.options.dataGrouping.call(this.table);

			this.generateGroups(rows);

			if(this.table.options.dataGrouped){
				this.table.options.dataGrouped.call(this.table, this.getGroups(true));
			}

			return this.updateGroupRows();

		}else{
			return rows.slice(0);
		}
	}

	getGroups(compoment){
		var groupComponents = [];

		this.groupList.forEach(function(group){
			groupComponents.push(compoment ? group.getComponent() : group);
		});

		return groupComponents;
	}

	getChildGroups(group){
		var groupComponents = [];

		if(!group){
			group = this;
		}

		group.groupList.forEach((child) => {
			if(child.groupList.length){
				groupComponents = groupComponents.concat(this.getChildGroups(child));
			}else{
				groupComponents.push(child);
			}
		});

		return groupComponents;
	}

	wipe(){
		this.groupList.forEach(function(group){
			group.wipe();
		});
	}

	pullGroupListData(groupList) {
		var self = this;
		var groupListData = [];

		groupList.forEach( function(group) {
			var groupHeader = {};
			groupHeader.level = 0;
			groupHeader.rowCount = 0;
			groupHeader.headerContent = "";
			var childData = [];

			if (group.hasSubGroups) {
				childData = self.pullGroupListData(group.groupList);

				groupHeader.level = group.level;
				groupHeader.rowCount = childData.length - group.groupList.length; // data length minus number of sub-headers
				groupHeader.headerContent = group.generator(group.key, groupHeader.rowCount, group.rows, group);

				groupListData.push(groupHeader);
				groupListData = groupListData.concat(childData);
			}

			else {
				groupHeader.level = group.level;
				groupHeader.headerContent = group.generator(group.key, group.rows.length, group.rows, group);
				groupHeader.rowCount = group.getRows().length;

				groupListData.push(groupHeader);

				group.getRows().forEach( function(row) {
					groupListData.push(row.getData("data"));
				});
			}
		});

		return groupListData
	}

	getGroupedData(){

		return this.pullGroupListData(this.groupList);
	}

	getRowGroup(row){
		var match = false;

		this.groupList.forEach(function(group){
			var result = group.getRowGroup(row);

			if(result){
				match = result;
			}
		});

		return match;
	}

	countGroups(){
		return this.groupList.length;
	}

	generateGroups(rows){
		var self = this,
		oldGroups = self.groups;

		self.groups = {};
		self.groupList =[];

		if(this.allowedValues && this.allowedValues[0]){
			this.allowedValues[0].forEach(function(value){
				self.createGroup(value, 0, oldGroups);
			});

			rows.forEach(function(row){
				self.assignRowToExistingGroup(row, oldGroups);
			});
		}else{
			rows.forEach(function(row){
				self.assignRowToGroup(row, oldGroups);
			});
		}
	}

	createGroup(groupID, level, oldGroups){
		var groupKey = level + "_" + groupID,
		group;

		oldGroups = oldGroups || [];

		group = new Group(this, false, level, groupID, this.groupIDLookups[0].field, this.headerGenerator[0], oldGroups[groupKey]);

		this.groups[groupKey] = group;
		this.groupList.push(group);
	}

	assignRowToExistingGroup(row, oldGroups){
		var groupID = this.groupIDLookups[0].func(row.getData()),
		groupKey = "0_" + groupID;

		if(this.groups[groupKey]){
			this.groups[groupKey].addRow(row);
		}
	}

	assignRowToGroup(row, oldGroups){
		var groupID = this.groupIDLookups[0].func(row.getData()),
		newGroupNeeded = !this.groups["0_" + groupID];

		if(newGroupNeeded){
			this.createGroup(groupID, 0, oldGroups);
		}

		this.groups["0_" + groupID].addRow(row);

		return !newGroupNeeded;
	}

	reassignRowToGroup(row){
		var oldRowGroup = row.getGroup(),
			oldGroupPath = oldRowGroup.getPath(),
			newGroupPath = this.getExpectedPath(row),
			samePath = true;
		// figure out if new group path is the same as old group path
		var samePath = (oldGroupPath.length == newGroupPath.length) && oldGroupPath.every(function(element, index) {
			return element === newGroupPath[index];
		});
		// refresh if they new path and old path aren't the same (aka the row's groupings have changed)
		if(!samePath) {
			oldRowGroup.removeRow(row);
			this.assignRowToGroup(row, self.groups);
			this.table.rowManager.refreshActiveData("group", false, true);
		}
	}

	getExpectedPath(row) {
		var groupPath = [], rowData = row.getData();
		this.groupIDLookups.forEach(function(groupId) {
			groupPath.push(groupId.func(rowData));
		});
		return groupPath;
	}

	updateGroupRows(force){
		var self = this,
		output = [],
		oldRowCount;

		self.groupList.forEach(function(group){
			output = output.concat(group.getHeadersAndRows());
		});

		//force update of table display
		if(force){

			var displayIndex = self.table.rowManager.setDisplayRows(output, this.getDisplayIndex());

			if(displayIndex !== true){
				this.setDisplayIndex(displayIndex);
			}

			self.table.rowManager.refreshActiveData("group", true, true);
		}

		return output;
	}

	scrollHeaders(left){
		if(this.table.options.virtualDomHoz){
			left -= this.table.vdomHoz.vDomPadLeft;
		}

		left = left + "px";

		this.groupList.forEach(function(group){
			group.scrollHeader(left);
		});
	}

	removeGroup(group){
		var groupKey = group.level + "_" + group.key,
		index;

		if(this.groups[groupKey]){
			delete this.groups[groupKey];

			index = this.groupList.indexOf(group);

			if(index > -1){
				this.groupList.splice(index, 1);
			}
		}
	}
}

// Tabulator.prototype.registerModule("groupRows", GroupRows);
module.exports = GroupRows;