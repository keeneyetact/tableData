import Module from '../../core/Module.js';

import defaultImporters from './defaults/importers.js';

class Import extends Module{
    
    constructor(table){
        super(table);
        
        this.registerTableOption("importFormat"); //import data to the table
    }
    
    initialize(){
        this.registerTableFunction("import", this.importFromFile.bind(this));

        if(this.table.options.importFormat){
            this.subscribe("data-loading", this.loadDataCheck.bind(this), 10);
            this.subscribe("data-load", this.loadData.bind(this), 10);
        }
    }

    loadDataCheck(data){
        return typeof data === "string";
    }

    loadData(data, params, config, silent, previousData){
        return this.importData(this.lookupImporter(), data);
    }

    lookupImporter(importFormat){
        var importer;
        
        if(!importFormat){
            importFormat = this.table.options.importFormat;
        }
        
        if(typeof importFormat === "string"){
            importer = Import.importers[importFormat];
        }else{
            importer = importFormat;
        }

        if(!importer){
            console.error("Import Error - Importer not found:", importFormat);
        }
        
        return importer;
    }
    
    importFromFile(importFormat, extension){
        var importer = this.lookupImporter(importFormat);
        
        if(importer){
            return this.pickFile(extension)
            .then(this.importData.bind(this, importer))
            .then(this.setData.bind(this))
            .catch((err) => {
                console.error("Import Error:", err || "Unable to import file")
                return Promise.reject(err);
            })
        }
    }
    
    pickFile(extensions){
        return new Promise((resolve, reject) => {
            var input = document.createElement("input");
            input.type = "file";
            input.accept = extensions;
            
            input.addEventListener("change", (e) => {
                var file = input.files[0],
                reader = new FileReader(),
                data;
                
                reader.readAsText(file);
                
                reader.onload = (e) => {
                    resolve(reader.result)
                };
                
                reader.onerror = (e) => {
                    console.warn("File Load Error - Unable to read file");
                    reject();
                };
            });
            
            input.click();
        });
    }
    
    importData(importer, fileContents){
        var data = importer.call(this.table, fileContents);
        
        if(data instanceof Promise){
            return data;
        }else{
            return data ? Promise.resolve(data) : Promise.reject();
        }
    }
    
    setData(data){
        return this.table.setData(data);
    }
}

Import.moduleName = "import";

//load defaults
Import.importers = defaultImporters;

export default Import;