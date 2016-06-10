
if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('botkit');
var os = require('os');
var http = require('http');

var controller = Botkit.slackbot({
    debug: true,
});

var bot = controller.spawn({
  token: process.env.token
})
bot.startRTM(function(err,bot,payload) {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
});

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['Is the pp room free', 'is the ping pong room free', 'can we play?'], 'direct_message,direct_mention,mention', function(bot, message) {
	var options = {
		host: '192.168.1.158',
		port: 4567,
		path: '/room/pingpong/presence',
		method: 'GET'
	};
	http.request(options, function(res) {
		var body = '';
		res.setEncoding('utf8');
		res.on('data', function (chunk) {
			body += chunk;
		});
		res.on('end', function(){
	        var response = JSON.parse(body);
	        if (!response.presence) {
			bot.reply(message, 
			'Great news everyone! The ping pong temple is free!');
			} else {
			bot.reply(message, 
			'The Vogons are occupying ping pong room :(');
			}
	    });
		
	}).end();
	// bot.reply(message, 
	// 	'As a matter of fact yes, but you probably should check by yourself.');
});

controller.hears(['show me the pp room', 'show me the ping pong room', 'room photo'], 'direct_message,direct_mention,mention', function(bot, message) {
	var options = {
		host: '192.168.1.158',
		port: 4567,
		path: '/room/pingpong/image/last',
		method: 'GET'
	};
var http = require('http')
  , fs = require('fs')
  , options


var request = http.get(options, function(res){
    var imagedata = ''
    res.setEncoding('binary')

    res.on('data', function(chunk){
        imagedata += chunk
    })

    res.on('end', function(){
        fs.writeFile('logo.jpg', imagedata, 'binary', function(err){
            if (err) throw err
            console.log('File saved.')

        });
    //bot.api.files.upload({
    //    content: imagedata,
    //    channels: '#ping-pong-hack',
	//	filename: 'auto.jpg',
	//	filetype: 'image',
	//	mimetype: 'image/jpeg',
    //}, function(err, res) {
    //    if (err) {
    //        bot.botkit.log('Failed to add emoji reaction :(', err);
    //    }
    //});
    random = Math.random() * (1000);
    //bot.api.chat.postMessage({channel: '#ping-pong-hack', text: 'https://2470de95.ngrok.io/latest?r='+random, unfurl_media: 'true'});
    bot.reply(message, 'https://2470de95.ngrok.io/latest?r='+random);
    })

})

//var binary=""
//url="http://192.168.1.158:4567/room/pingpong/image/last"
//download(url, binary);
//console .log("binary:" + binary);
//req = http.request(options, function(res) {
//    res.setEncoding('binary');
//
//    var data = [ ];
//
//    res.on('data', function(chunk) {
//        data.push(chunk);
//    });
//    res.on('end', function() {
//        binary = Buffer.concat(data);
//		console.log("BINARY: " ,binary);
//		console.log("DATA: " ,data);
//		console.log("DATA: " ,binary);
//        // binary is your data
//    });
//    res.on('error', function(err) {
//        console.log("Error during HTTP request");
//        console.log(err.message);
//    });
//});
//var sleep = require('sleep');
//sleep.sleep(4);
//console.log("SIO?", binary);
//
//
//	//http.request(options, function(res) {
//	//	res.setEncoding('binary');
//	//	res.on('data', function (chunk) {
//	//		data.push(chunk);
//	//	});
//	//	http.request(options, function(res) {
//	//		
//	//	})
//	//	// res.on('end', function(){
//	// //        if (b64data) {
//	//	// 		bot.reply(message, 
//	//	// 		b64data);
//	//	// 	} else {
//	//	// 		bot.reply(message, 
//	//	// 		'Warning, Error! Autodestruction in 1s...');
//	//	// 	}
//	// //    });
//	//}).end();
//	
//	var reply_with_attachments = {
//    'text': 'This is what is happening in the ping pong room:',
//    'attachments': [
//      {
//        'title': 'Current pp room status',
//        'color': '#7CD197'
//      }
//    ],
//    'image_url': 'http://192.168.1.158:4567/room/pingpong/image/last'
//    }
//
//  //bot.reply(message, reply_with_attachments);
//  var fs = require('fs');
//  fs.writeFile('message.txt', binary);
//  ///// write to file
//	// bot.reply(message, 
//	// 	'As a matter of fact yes, but you probably should check by yourself.');
});
//
controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});


controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});

controller.hears(['time', 'what time is it', 'give me the hour', 'could you tell me what time do we have?'],
    'direct_message,direct_mention,mention', function(bot, message) {
	var currentDate = new Date();
	bot.reply(message, 
		'My dear Master, it is ' + currentDate.getMinutes() + ' past ' + currentDate.getHours() + ' sir.');
});

controller.hears(['Kich the trolls out', 'Evacuate!'], 'direct_message,direct_mention,mention', function(bot, message) {
	var options = {
		host: '192.168.1.158',
		port: 4567,
		path: '/room/pingpong/siren/play',
		method: 'POST'
	};
	http.request(options, function(res) {
		var body = '';
		res.setEncoding('utf8');
		res.on('end', function(){
			bot.reply(message, 
			'The alarm has been fired!');
	    });
	   }).end();	
});

controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}

