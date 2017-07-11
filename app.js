
var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io").listen(server);
var users={};
var mongoose = require("mongoose");
var Schema = mongoose.Schema;

app.use(express.static('./public'));//to make sure css works

server.listen(3000);
//-----------------------------------------------------
//Connect to the database
mongoose.connect('mongodb://localhost/chat');
//Make a schema
var chatSchema = mongoose.Schema({
  user: String,
  msg: String,
  created: {type:Date, default: Date.now}
});

//Make a model
var Chat = mongoose.model('Message', chatSchema);

//-----------------------------------------------------

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
	//sendStatus function defined
	sendStatus = function(val){
		socket.emit('status', val);
	};

	//Load all messages
	var query = Chat.find({});
	//Retrieve messages as soon as the user gets connected in the order of "last created"
	query.sort('-created').limit(15).exec(function(err, docs){
		if(err) throw err;
		//send it to client to be displayed
		socket.emit('load old messages', docs);

	});

	//on input
	socket.on('send message', function(data, callback){
		var name=data.name;
		var message=data.message;
		var whitespacePattern =/^\s*$/;

		if(whitespacePattern.test(name) || whitespacePattern.test(message)){
			//sending the status as a string
			sendStatus("Enter valid name and message");
		}else{
			//Trim for spaces
			//check if the send message contains \w in the begining
			var msg = message.trim();
			if(msg.substr(0,3) === '/w '){
				//Cut /w out of the msg
				msg = msg.substr(3);
				//Find the first space
				var ind = msg.indexOf(' ');
				if(ind !== -1){
					var whisperName = msg.substr(0,ind);
					var whisperMessage = msg.substr(ind+1);
					//Check if the name already exists in the list of users
					if(whisperName in users){
						//Send the private message to the user
						users[whisperName].emit('new message', {msg:whisperMessage, user:name});
						callback("Message Sent");
					}else{
						callback("Enter valid username");
					}
				}else{

					//if there is no space it means no message
					callback('Please enter a valid message for your whisper');
				}
				
			}//if /w 
			else{

					//username not in the users list
					callback();
					socket.username = name;//storing the username
					//users.push(socket.username);
					users[socket.username] = socket;//save the socket with nickname as the key
					updateUsernames();
					//Save to database
					var newMsg = new Chat({msg:message, user:name});
					newMsg.save(function (err) {
		  				if (err) return handleError(err);
						//send to everyone including me
						io.sockets.emit('new message', {msg:message, user:name});
					});
					//sending the status as an object
					sendStatus({
						message:"Message Sent",
						clear: "true"
					});

			}//else
			
		}//else
	});
	
	//When a user disconnects
	socket.on('disconnect', function(data){
		//Delete the username from the user list
		delete users[socket.username];
		//Send the list of updated nicknames back to the client
		updateUsernames();
	});

	function updateUsernames(){
		io.sockets.emit('usernames',Object.keys(users));
		//io.sockets.emit('usernames',users);
	}

});

