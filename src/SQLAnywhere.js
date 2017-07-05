var spawn = require('child_process').spawn;
var JSONStream = require('JSONStream');
var fs = require("fs");
var path = require("path");

var PATH_TO_GO_CONNECTOR = path.resolve(__dirname + '/../sqlago-connector/sqlago-connector.exe');

function SQLAnywhere(dbname, username, password, logTiming, pathToGoConnector)
{
    this.connected = false;
    this.dbname = dbname;
    this.username = username;
    this.password = password;    
    this.logTiming = (logTiming == true);
    
    this.pathToGoConnector = pathToGoConnector;

    if (this.pathToGoConnector === undefined)
    {
        if (fs.existsSync(PATH_TO_GO_CONNECTOR))
            this.pathToGoConnector = PATH_TO_GO_CONNECTOR;
    }

    this.queryCount = 0;
    this.currentMessages = {}; // look up msgId to message sent and call back details.

    this.jsonParser = JSONStream.parse();
}

SQLAnywhere.prototype.connect = function(callback)
{
    var that = this;
    this.sqlaConn = spawn(this.pathToGoConnector, ["-dsn", 'DSN=' + this.dbname + ';UID=' + this.username + ';PWD=' + this.password]);

    var hrstart = process.hrtime();
	this.sqlaConn.stdout.once("data", function(data) {
		if ((data+"").trim() != "connected")
		{
			callback(new Error("Error connecting " + data));
			return;
		}

		that.sqlaConn.stderr.removeAllListeners("data");
		that.connected = true;

		// set up normal listeners.		
		that.sqlaConn.stdout.pipe(that.jsonParser).on("data", function(jsonMsg) { that.onSQLResponse.call(that, jsonMsg); });
		that.sqlaConn.stderr.on("data", function(err) { that.onSQLError.call(that, err); });

		callback(null, data);
	});

	// handle connection issues.
    this.sqlaConn.stderr.once("data", function(data) {
    	that.sqlaConn.stdout.removeAllListeners("data");
    	that.sqlaConn.kill();
    	callback(new Error(data));
    });   
};

SQLAnywhere.prototype.disconnect = function()
{
	this.sqlaConn.kill();
	this.connected = false;	
}

SQLAnywhere.prototype.isConnected = function() 
{
    return this.connected;
};

SQLAnywhere.prototype.query = function(sql, callback) 
{
    if (this.isConnected === false)
    {
    	callback(new Error("database isn't connected."));
    	return;
    }    
    var hrstart = process.hrtime();
    this.queryCount++;
    
    var msg = {};
    msg.msgId = this.queryCount;
    msg.sql = sql;
    msg.sentTime = (new Date()).getTime();
    var strMsg = JSON.stringify(msg).replace(/(\r\n|\n|\r)/gm,"");
    msg.callback = callback;
    msg.hrstart = hrstart;

    console.log("this: " + this + " currentMessages: " +  this.currentMessages + " this.queryCount: " + this.queryCount);
    
    this.currentMessages[msg.msgId] = msg;

    this.sqlaConn.stdin.write(strMsg + "\n");
    console.log("sql request written: " + strMsg);
};

SQLAnywhere.prototype.onSQLResponse = function(jsonMsg)
{
    var err = null;
    var result = null;

	var request = this.currentMessages[jsonMsg.msgId];
	delete this.currentMessages[jsonMsg.msgId];

    console.log(jsonMsg);

    if (jsonMsg.error !== undefined)
        err = new Error(jsonMsg.error);

    if (jsonMsg.result){
    	result = jsonMsg.result;
    	if (result.length === 1)
    		result = result[0]; //if there is only one just return the first RS not a set of RS's
    }
	var currentTime = (new Date()).getTime();
	var sendTimeMS = currentTime - jsonMsg.goEndTime;
	hrend = process.hrtime(request.hrstart);
	var goDuration = (jsonMsg.goEndTime - jsonMsg.goStartTime);

	if (this.logTiming)
		console.log("Execution time (hr): %ds %dms dbTime: %dms dbSendTime: %d sql=%s", hrend[0], hrend[1]/1000000, goDuration, sendTimeMS, request.sql);
	request.callback(err, result);
};

SQLAnywhere.prototype.onSQLError = function(data)
{
	var error = new Error(data);

    var callBackFuncitons = [];
	for (var k in this.currentMessages){
    	if (this.currentMessages.hasOwnProperty(k)) { 		
            callBackFuncitons.push(this.currentMessages[k].callback);
    	}
	}

    // clear the current messages before calling back with the error.
    this.currentMessages = [];
    callBackFuncitons.forEach(function(cb) {
        cb(error);
    });
};

module.exports = SQLAnywhere;
