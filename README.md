node-sqlanywhere
---------

A fork of the [node-sybase](https://github.com/rodhoward/node-sybase) library, this is a simple node.js wrapper around a Go CLI that provides easy access to SQL Anywhere 12.0 data sources. A static binary of the sqlago-connector go program is included and compiled as a 32 bit windows executable, tested using SQL Anywher 12.0 on Windows Server 2008.

### npm

```bash
npm install sqlanywhere
```

quick example
-------------

```javascript
var SQLAnywhere = require('sqlanywhere');
var db = new SQLAnywhere('host', 'dbName', 'username', 'pw');

db.connect(function (err) {
  if (err) return console.log(err);
  
  db.query('select * from user where user_id = 42', function (err, data) {
    if (err) console.log(err);
    
    console.log(data);

    db.disconnect();

  });
});
```

api
-------------

The api is super simple. It makes use of standard node callbacks so that it can be easily used with promises. 

