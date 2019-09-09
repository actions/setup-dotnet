(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.nimnSchemaBuilder = f()}})(function(){var define,module,exports;return (function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){

/**
 * Build Schema for nimnification of JSON data
 * @param {*} jsObj 
 */
function buildSchema(jsObj){
    var type = typeOf(jsObj);
    switch(type){
        case "array":
            return [buildSchema(jsObj[0])];
        case "object":
            var schema = {  };
            var keys = Object.keys(jsObj);
            for(var i in keys){
                var key = keys[i];
                /* if(key === null || typeof key === "undefined"){//in case of null or undefined, take sibling's type
                    if(keys[i+1] ){
                        schema[key] = buildSchema(jsObj[keys[i+1]]);        
                    }else if(keys[i-1]){
                        schema[key] = buildSchema(jsObj[keys[i-1]]);        
                    }
                    continue;
                } */
                schema[key] = buildSchema(jsObj[key]);
            }
            return schema;
        case "string":
        case "number":
        case "date":
        case "boolean":
            return type;
        default:
            throw Error("Unacceptable type : " + type);
    }
}

function typeOf(obj){
    if(obj === null) return "null";
    else if(Array.isArray(obj)) return "array";
    else if(obj instanceof Date) return "date";
    else return typeof obj;
}

module.exports.build = buildSchema;
},{}]},{},[1])(1)
});