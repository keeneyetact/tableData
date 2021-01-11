export default class FooterManager {

	constructor(table){
		this.table = table;
		this.active = false;
		this.element = this.createElement(); //containing element
		this.external = false;
		this.links = [];

		this._initialize();
	}

	createElement (){
		var el = document.createElement("div");

		el.classList.add("tabulator-footer");

		return el;
	}

	_initialize(element){
		if(this.table.options.footerElement){

			switch(typeof this.table.options.footerElement){
				case "string":
				if(this.table.options.footerElement[0] === "<"){
					this.element.innerHTML = this.table.options.footerElement;
				}else{
					this.external = true;
					this.element = document.querySelector(this.table.options.footerElement);
				}
				break;

				default:
				this.element = this.table.options.footerElement;
				break;
			}
		}
	}

	getElement(){
		return this.element;
	}

	append(element, parent){
		this.activate(parent);

		this.element.appendChild(element);
		this.table.rowManager.adjustTableSize();
	}

	prepend(element, parent){
		this.activate(parent);

		this.element.insertBefore(element, this.element.firstChild);
		this.table.rowManager.adjustTableSize();
	}

	remove(element){
		element.parentNode.removeChild(element);
		this.deactivate();
	}

	deactivate(force){
		if(!this.element.firstChild || force){
			if(!this.external){
				this.element.parentNode.removeChild(this.element);
			}
			this.active = false;
		}
	}

	activate(parent){
		if(!this.active){
			this.active = true;
			if(!this.external){
				this.table.element.appendChild(this.getElement());
				this.table.element.style.display = '';
			}
		}

		if(parent){
			this.links.push(parent);
		}
	}

	redraw(){
		this.links.forEach(function(link){
			link.footerRedraw();
		});
	}
}