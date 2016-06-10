var configFile = 'config.json';

var fs = require('fs');

if (!fs.existsSync(configFile)){
    console.log('Error: config.json is not set');
    process.exit(1);
}

var config = JSON.parse(fs.readFileSync(configFile));
config.json_file_store = config.json_file_store || 'database';

if (!config.token || !config.serverUrl) {
    console.log('Error: Please configure token and serverUrl in config.json');
    process.exit(1);
}

var Botkit = require('botkit');
var os = require('os');
var http = require('http');

var KingClient = require('./lib/king-pong-client.js').client;

var client = new KingClient(config.serverUrl);

var controller = Botkit.slackbot({
    json_file_store: config.json_file_store
});

var bot = controller.spawn({
    token: config.token
});

function userSave(err, id){
    if (err){
        bot.botkit.log('Cannot store user #' + id, err);
    }
}

bot.startRTM(function(err, bot, payload) {
    if (err) {
        throw new Error('Could not connect to Slack');
    } else // Cache users
    {
        payload.users.forEach(function(user){
            controller.storage.users.save(user, userSave)
        })
    }
});

// hears register me so it will register in the API service provider as a player
// TODO: implementation
// 1. check if user exists in local storage
// 2. if yes return if not check if user exists in API
// 3. if not exist in API, then create it
// 4. save the user to local storage
function retrieveUser(bot, message, controller, slackUser){
    client.get('/users/' + slackUser.name, null, null, function(res){
        if (200 === res.statusCode) {
            controller.storage.users.save(slackUser, onUserSave);
            bot.reply(message, mentionUser(slackUser.id, slackUser.name) + ': You are already registered in King Pong system!');
        }
        else { // Probably 404
            client.post('/users', {
                user_name: slackUser.name,
                email: slackUser.profile.email
            }, null, function (res) {
                if (200 === res.statusCode) {
                    bot.reply(mentionUser(slackUser.id) + ': You are now registered in King Pong system!');
                    controller.storage.users.save(slackUser, onUserSave)
                }
                else {
                    bot.reply(message, mentionUser(slackUser.id, slackUser.name) + ': Sorry :( We could not register you to King Pong system!');
                }
            })
        }
    })
}

function bot_add_reaction(bot, message, reaction) {
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: reaction || 'robot_face',
    }, function (err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });
}
function mentionUser(user_id, name){
    return '<@' + user_id + (name ?  '|' + name : '' ) + '>';
}

controller.hears(['register me'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot_add_reaction(bot, message);

    controller.storage.users.get(message.user, function(err, user) {
        controller.storage.users.get(message.user, function(err, slackUser){
            if (err) {
                bot.api.users.info({user: message.user}, function(res){
                    if (200 === res.statusCode) {
                        var data = [];
                        res.on('data', function(chunk){
                            data.push(chunk);
                        })
                        res.on('end', function(){
                            var slackUser = JSON.parse(data.join('')).user;
                            // Check user exists in API
                            retrieveUser(bot, message, controller, slackUser);
                        })
                    }
                });
            }
            else {
                retrieveUser(bot, message, controller, slackUser);
            }
        })

    })
});
controller.hears(['register the player <@(.*)>'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot_add_reaction(bot, message);

    var user_id = message.match[1];

    controller.storage.users.get(user_id, function(err, slackUser) {
        if (slackUser){
            retrieveUser(bot, message, controller, slackUser)
        }
        else {
            bot.api.users.info({user: user_id}, function(err, slackUser){
                if (!err && slackUser) {
                    retrieveUser(bot, message, controller, slackUser);
                }
                else
                {
                    bot.reply(message, 'What???' + mentionUser(user_id) + ' is a ghost!!!')
                }
            });
        }
    })
});

controller.hears('create a tournament called (.*)', 'direct_message,direct_mention,mention', function(bot, message){
    bot_add_reaction(bot, message);

    var tournament = {
        name: message.match[1]
    };

    client.post('/tournaments', tournament, null, function(res){
        if (200 === res.statusCode)
        {
            var data = [];
            res.on('data', function(chunk){
                data.push(chunk);
            });

            res.on('end', function(){
                tournament = JSON.parse(data.join(''));
                bot.reply(message, '<!channel|channel>:  Tournament ' + tournament.name + ' has been created with the ID #' + tournament.id)
            });
        }
        else
        {
            bot.reply(message, '<!channel|channel>: Ooops it seems that someone does not want you to play ping pong!')
        }
    }, function(err){
        bot.reply(message, '<!channel|channel>: Ooops it seems that someone does not want you to play ping pong!')
    });
});

controller.hears('delete the tournament #(.*)', 'direct_message,direct_mention,mention', function(bot, message){
    bot_add_reaction(bot, message);

    var tournament = {
        id: message.match[1]
    };

    client.delete('/tournaments/' + tournament.id, null, null, function(res){
        if (200 === res.statusCode)
        {
            var data = [];
            res.on('data', function(chunk){
                data.push(chunk);
            });

            res.on('end', function(){
                tournament = JSON.parse(data.join(''));
                console.log(tournament);
                bot.reply(message, '<!channel|channel>: Tournament #' + tournament.id + ' has been removed!')
            });
        }
        else
        {
            bot.reply(message, mentionUser(message.user) + ': Ooops it seems that someone does not want you to play ping pong!')
        }
    }, function(err){
        bot.reply(message, '<!channel|channel>: Ooops it seems that someone does not want you to play ping pong!')
    });
});

controller.hears('<@(.*)> wins (.*)/(.*) against <@(.*)> in tournament #(.*)', 'direct_message,direct_mention,mention', function(bot, message){
    bot_add_reaction(bot, message);

    var slackWinner, slackLoser;
    var user_winner_id = message.match[1];
    var user_loser_id = message.match[4];
    var winner_score =message.match[2];
    var loser_score = message.match[3];

    controller.storage.users.get(user_winner_id, function(err, user) {
        if (user){
            slackWinner = user;
        }
        else {
            bot.api.users.info({user: user_winner_id}, function(err, slackUser){
                if (!err && slackUser) {
                    slackWinner = slackUser;
                }
                else
                {
                    bot.reply(message, 'What???' + mentionUser(user_winner_id) + ' is a ghost!!!')
                }
            });
        }
        if (slackWinner) {
            controller.storage.users.get(user_loser_id, function(err, user) {
                if (user){
                    slackLoser = user;
                }
                else {
                    bot.api.users.info({user: user_loser_id}, function(err, slackUser){
                        if (!err && slackUser) {
                            slackWinner = slackUser;
                        }
                        else
                        {
                            bot.reply(message, 'What???' + mentionUser(user_loser_id) + ' is a ghost!!!')
                        }
                    });
                }
                if (!slackLoser) {
                    bot.reply(message, 'What???' + mentionUser(user_loser_id) + ' is a ghost!!!')
                }
                else {
                    var game = {
                        winner: slackWinner.name,
                        winner_score: winner_score,
                        loser_score: loser_score,
                        loser: slackLoser.name,
                        tournament_id: message.match[5]
                    };

                    client.post('/games', game, null, function(res){
                        if (200 === res.statusCode)
                        {
                            var data = [];
                            res.on('data', function(chunk){
                                data.push(chunk);
                            });

                            res.on('end', function(){
                                tournament = JSON.parse(data.join(''));
                                console.log(tournament);
                                bot.reply(message, 'Owosome! ' + mentionUser(game.winner) + ' it seems you played well. Wanna :beer:?')
                                bot.reply(message, mentionUser(game.loser) + ' keep practicing dude! Or maybe give up on :pp:')
                            });
                        }
                        else
                        {
                            bot.reply(message, mentionUser(message.user) + ': Ooops it seems that someone does not want you to play ping pong!')
                        }
                    }, function(err){
                        bot.reply(message, '<!channel|channel>: Ooops it seems that someone does not want you to play ping pong!')
                    });
                }
            });
        }
    });
});

controller.hears('leaderboard for tournament #(.*)', 'direct_message,direct_mention,mention', function(bot, message){
    bot_add_reaction(bot, message);

    client.get('/leaderboards/' + message.match[1], null, null, function(res){
        if (200 === res.statusCode){
            var data = [];
            res.on('data', function(chunk){ data.push(chunk )});
            res.on('end', function(){
                // var list = JSON.parse(data.join(''));
                bot.reply(message, "<!channel>: Here is the ranking for the tournament \n\n```\n" + data.join('') + "\n```");
            });
        }
        else {
            bot.reply(message, 'Sorry, I could not find any ranking for this tournament!');
        }
    })
})
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

