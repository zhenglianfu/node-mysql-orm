/**
 * Created by zhenglianfu on 2015/7/12.
 */

// TODO 引入数据库语言包

// load default node_mysql module

// add method `type` to util
var util = require('util');
util.TYPES = function(){
    var types = {};
    for (var i = 0, len = arguments.length; i < len; i += 1) {
        types['[object ' + arguments[i] + ']'] = arguments[i].toLowerCase();
    }
    return types;
}('Date', 'Undefined', 'Null', 'Number', 'Boolean', 'String', 'Object', 'Array', 'RegExp');
util.type = function(obj){
    return util.TYPES[Object.prototype.toString.call(obj)];
};
// extend on util
util.extend = function(){
    var target = arguments[0],
        copy,
        len = arguments.length,
        i = 1,
        k, item,
        deep = false;
    if (typeof target === 'boolean') {
        deep = target;
        i ++;
        target = arguments[i];
    }
    for (;i < len; i++) {
        var item = arguments[i];
        if(item){
            for(k in item){
                copy = item[k];
                if (typeof copy === 'object' && deep) {
                    if (Array.isArray(copy)) {
                        target[k] = utils.extend(deep, [], copy);
                    } else {
                        target[k] = utils.extend(deep, {}, copy);
                    }
                } else if (copy != null) {
                    target[k] = copy;
                }
            }
        }
    }
    return target;
};
var orm = {};
var dump = function(){};
module.exports = orm;
// escape sql
var sqlString = {
    escapeField: function(value){
        return '`' + value.replace(/`/g, '``').replace(/\./g, '`.`') + '`';
    },
    escape: function(value){
        var type = util.type(value);
        // TODO complete mysql field types
        switch (type){
            case 'number':
                return value;
            case 'array':
                return sqlString.arrayToList(value);
            case 'object':
                return sqlString.objToValue(value);
            case 'string':
                // 该死的字符串
                return '\'' + value.replace(/(\\'|'|\\)/g, function(token){
                        return token.replace('\\', '\\\\').replace('\'', '\\\'');
                    }) + '\'';
            case 'date':
                return sqlString.dateToString(value);
            case 'timestamp':
                return sqlString.dateToTimestamp(value);
            case 'null':
            case 'undefined':
            default :
                return 'NULL';
        }
    },
    format: function(sql, values){
        var index = 0;
        // make sure `values` is an array
        if (values == null) {
            values = [];
        } else if (!Array.isArray(values)) {
            values = [values];
        }
        var len = values.length;
        return sql.replace(/\?\?|\?/g, function(token){
            if (index < len) {
                if ('??' == token) {
                    return sqlString.escapeField(values[index++]);
                } else {
                    return sqlString.escape(values[index++]);
                }
            }
            return token;
        });
    },
    arrayToList: function(arr){
        var newArr = [];
        for (var i = 0, len = arr.length; i < len; i+=1) {
            newArr[i] = sqlString.escape(arr[i]);
        }
        return newArr.join(',');
    },
    objToValue: function(obj){
        var exp = [],
            i = 0;
        for(var key in obj){
            exp[i++] = sqlString.escapeField(key) + '=' + sqlString.escape(obj[key]);
        }
        return exp.join(',');
    },
    dateToString: function(date){
        return sqlString.formatDate(date, 'yyyy-MM-dd');
    },
    dateToTimestamp: function(date){
        if (util.isDate(date)) {
            return date.getTime();
        } else {
            var d = new Date(date),
                t= d.getTime();
            return isNaN(t) ? 0 : t;
        }
    },
    formatDate: function(date, pattern){
        if (date == null || date == '' || (util.isDate(date) && isNaN(date.getFullYear()))) {
            return null; // mysql 'NULL'
        }
        pattern = pattern || 'yyyy-MM-dd HH:mm:ss';
        if (!util.isDate(date)) {
            date = new Date(date);
        }
        var escapeStrs = {
            'yyyy': date.getFullYear(),
            'MM': date.getMonth() + 1,
            'dd': date.getDate(),
            'HH': date.getHours(),
            'mm': date.getMinutes(),
            'ss': date.getSeconds()
        };
        for (var i in escapeStrs) {
            pattern = pattern.replace(new RegExp(i, 'g'), escapeStrs[i]);
        }
        return pattern;
    }
};
// resource setting
var resource = null;
// TODO 配置ORM的数据源，重写数据库连接池，统一各个数据库实例
orm.setResource = function(connect){
    // 以Mysql的函数代替先
    resource = connect;
};
orm.getResource = function(){
    return resource;
};

// format sql (??|?) values
orm.format = function(sql, values){
    return sqlString.format(sql, values);
};

orm.DATABASE_TYPE = (function(){
    var types = {};
    ['CHAR', 'STRING', 'INT', 'FLOAT', 'DOUBLE', 'TIME', 'TIME_STAMP', 'DATE','DATE_TIME','YEAR'].forEach(function(v, i){
        var f = function(){
            return {
                id: i,
                type: v
            };
        };
        f.toString = function(){
            return v;
        };
        f.getTypeId = function(){
            return i;
        };
        return types[v] = f;
    });
    return types;
}());

// TODO 添加事件监听 错误监听
/**
 * error&listener handlers
 * */
orm.on = function(){

};

/**
 * Table
 * */
orm.Table = function(tname, fields){
    return new Table(tname, fields);
};

/**
 * @arguments string(表名) array(字段数组)
 * @example Table('person', [
 *  {name: 'id',
 *   tname: 'id',
 *   isId: true,
 *   type: 'int',
 *   strategy: 'auto'
 *  },
 *  {name: 'name',
 *  tname: 'name',
 *  type: "string',
 *  length: 30,
 *  notNull: true,
 *  unique: false
 *  }])
 *
 * */
function Table(tname, fields){
    this.tname = tname;
    this.originFields = fields || [];
    this._init();
}
Table.prototype = {
    query: function(sql, data, fn){
        var table = this;
        if (typeof data === 'function') {
            fn = data;
            data = [];
        } else {
            fn = fn || dump;
        }
        var proxyFn = function(err, result){
            if (err) {
                console.error(err);
            }
            fn(err, table._transferSet(result));
            console.log(sqlString.format(sql, data));
        };
        return orm.getResource().getConnection(function(err, connect){
            connect.query(sql, data, proxyFn);
        });
    },
    getId: function(){
        for (var i = 0, len = this.fields.length; i < len; i++) {
            if (this.fields[i].isId) {
                this.getId = function(){
                    return this.fields[i];
                };
                return this.getId();
            }
        }
    },
    getField: function(name){
        this.queryFieldCache = this.queryFieldCache || {};
        if (this.queryFieldCache[name]) {
            return this.queryFieldCache[name];
        } else {
            for (var i = 0, len = this.fields.length; i < len; i++) {
                if (this.fields[i].name == name) {
                    this.queryFieldCache[name] = this.fields[i];
                    return this.fields[i];
                }
            }
        }
        return null;
    },
    // TODO 添加一次插入多条记录的支持
    // TODO 记录里有ID值，若存在该ID的记录则采用更新策略否则[ 新增记录可能会导致自增长ID撞车，仍需考虑，目前不检查ID有效性直接执行更新语句 ]
    save: function(obj, fn){
        var id = this.getId();
        if (util.isArray(obj)) {
            this._save(this._transferObjs(obj), fn);
        }
         else {
            this._save(this._transferObj(obj), fn)
        }
    },
    update: function(obj, fn){
        this._update(this._transferObj(obj), fn);
    },
    _init: function(){
        var defaultField = {
            name: '',
            tname: '',
            isId: false,
            notNull: false,
            unique: false,
            length: 1,
            type: 'int',
            strategy: 'auto'
        };
        var idField = null;
        this.fields = [];
        this.fieldNames = [];
        for (var i = 0, len = this.originFields.length; i < len; i++){
            var field = this.originFields[i];
            field.tname = field.tname || field.name;
            this.fields[i] = util.extend({}, defaultField, field);
            this.fieldNames[i] = field.tname;
        }
        this._createMethods();
    },
    _createMethods: function(){
        var len = this.fields.length;
        var allFieldPlaces = [];
        var i = 0;
        for (; i < len; i++) {
            allFieldPlaces[i] = '??';
        }
        var sql = 'select ' + allFieldPlaces.join(',') + ' from ?? where ??=?';
        sql = sqlString.format(sql, this.fieldNames.concat(this.tname));
        for (i = 0; i < len; i++) {
            var field = this.fields[i];
            if(field.isId && field.name != 'id'){
                this.findById = this.__createMethod(sql, field);
                this.deleteById = this.__createMethod(sqlString.format('delete from ?? where ??=?', this.tname), field);
            }
            this['findBy' + field.name.substr(0,1).toUpperCase() + field.name.substring(1)] = this.__createMethod(sql, field);
        }
    },
    __createMethod: function(sql, field){
        return function(value, fn){
            return this.query(sql, [field.tname, value], fn);
        };
    },
    _transferObjs: function(list){
        var res = [];
        for (var i = 0, len = list.length; i < len; i++) {
            res[i] = this._transferObj(list[i]);
        }
        return res;
    },
    _transferObj: function(obj){
        var row = {};
        for (var key in obj) {
            if (this.getField(key) !== null) {
                row[this.getField(key).tname] = obj[key];
            }
        }
        return row;
    },
    _transferSet: function(result){
        var transfer = [];
        if (Array.isArray(result)) {
            for (var i = 0, len = result.length; i < len; i++) {
                transfer[i] = this._transferRow(result[i]);
            }
        }
        return transfer;
    },
    _transferRow: function(row){
        var transfer = {};
        for (var i = 0, len = this.fields.length; i < len; i++) {
            transfer[this.fields[i].name] = row[this.fields[i].tname];
        }
        return transfer;
    },
    _generateId: function(customVal){
        // TODO id生成策略设定，目前全部使用auto increment，即不指定id
        var idField = this.getId();
        return customVal;
    },
    _escape : function(value, field){
        switch (field.type.toUpperCase()) {
            case orm.DATABASE_TYPE.CHAR.toString():
            case orm.DATABASE_TYPE.STRING.toString():
                return '' + value;
                break;
            case orm.DATABASE_TYPE.DATE.toString():
                return sqlString.formatDate(value, 'yyyy-MM-dd');
                break;
            default:
                return value;
        }
        return value;
    },
    /**
     * row: {} or [{}, {}, ...]
     * fn: function
     * */
    _save: function(row, fn){
        var fieldPlaces = [];
        for (var i = 0, len = this.fieldNames.length; i < len; i++) {
            fieldPlaces[i] = '??';
        }
        var sql = sqlString.format('insert into ??(' + fieldPlaces.join(',') + ') values', [this.tname].concat(this.fieldNames));
        // rewrite _save to make faster
        this._save = function(rows, fn){
            var values = [], value, obj, rlen, r, insertValuePlaceholder= [];
            if (!util.isArray(rows)) {
                rows = [rows];
            }
            for (r = 0, rlen = rows.length; r < rlen; r += 1) {
                value = [];
                obj = rows[r];
                if (obj[this.getId().name]) {
                    this._update(this._transferObj(obj), fn);
                    continue;
                }
                for (var i = 0, len = this.fieldNames.length; i < len; i++) {
                    if (this.fields[i].isId) {
                        value[i] = this._generateId(obj[this.fieldNames[i]]);
                    } else {
                        // TODO 在这里根据字段类型转换变量值
                        value[i] = this._escape(obj[this.fieldNames[i]], this.fields[i]);
                    }
                }
                values[r] = value;
                insertValuePlaceholder[r] = '(?)';
            }
            insertValuePlaceholder.length > 0 && this.query(sql + insertValuePlaceholder.join(','), values, fn);
        };
        this._save(row, fn);
    },
    _update: function(row, fn){
        var sql = 'update ?? set ? where ?? = ?';
        var idField = this.getId();
        this.query(sql, [this.tname, row, idField.tname, row[idField.tname]], fn);
    }
};
