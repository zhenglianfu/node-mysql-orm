/**
 * Created by zhenglianfu on 2016/1/10.
 * 测试代码，请修改连接配置
 */

var orm = require('../bin/orm');
var mysql = require('mysql');
var con = null;
try{
    // FIXME 测试时修改配置
    con = mysql.createConnection({
        host: 'localhost',
        port: '3306',
        user: 'root',
        password: '123456',
        database: 'nodejs',
        charset: 'utf8mb4'
    });
    con.connect();
} catch (e) {
    con  = null;
}
// 设置数据源
orm.setResource({getConnection: function(fn){
    return fn && fn(con == null ? {message: 'create databse connection failed'} : null, con);
}});
// table mapper
var table = orm.Table('person', [
    {
        name: 'key',
        tname: 'id',
        isId: true
    },
    {
        name: 'xingbie',
        tname: 'sex',
        type: 'int'
    },
    {
        name: 'mingzi',
        tname: 'name',
        type: 'string'
    },
    {
        name: 'nianji',
        tname: 'age',
        type: 'int'
    },
    {
        name: 'shengri',
        tname: 'birthday',
        type: 'date'
    }
]);
// insert two records
table.save([{
    xingbie: '1',
    mingzi: 'zhangsan',
    nianji: 12
},{
    xingbie: 0,
    mingzi: 'lisi',
    nianji: 11,
    shengri: Date.now()
}]);
// update
table.save({
    key: 2,
    xingbie: 1
});
console.log(table);