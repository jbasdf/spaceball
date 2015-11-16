var https = require('https');

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */
        if (event.session.application.applicationId !== "amzn1.echo-sdk-ams.app.[PUT YOUR APPLICATION ID HERE]") {
            context.fail("Invalid Application ID");
        }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                        context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                     event.session,
                     function callback(sessionAttributes, speechletResponse) {
                         context.succeed(buildResponse(sessionAttributes, speechletResponse));
                     });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
            ", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
            ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
            ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if ("SpaceBall" === intentName) {
        checkNEOs(intent, session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        getWelcomeResponse(callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
            ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Welcome to Space Ball. " +
            "Find out if you are in danger from near earth objects by asking, " +
            "am I in danger";
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    var repromptText = "You can also ask me , " +
            "are we all going to die";
    var shouldEndSession = false;

    callback(sessionAttributes,
             buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

/**
 * Contact Nasa.
 */
function checkNEOs(intent, session, callback) {
    console.log("the provided date is " + intent.slots.Date)
  var cardTitle = intent.name;
  var date = new Date(intent.slots.Date.value).toISOString().split('T')[0];
  
  console.log("The date is " + date);
  var repromptText = "";
  var sessionAttributes = {};
  var shouldEndSession = true;
  var speechOutput = "";

  getNEO(date, date, function(results){
      
    speechOutput = "There are " + results.element_count + " objects in near earth orbit. ";

    for(var neo in results.near_earth_objects){
      var neos = results.near_earth_objects[neo];
      for(var i = 0; i<neos.length; i++){
        var astroid = neos[i];
        speechOutput = speechOutput +
          astroid.name + 
          " is between " + Math.round(astroid.estimated_diameter.meters.estimated_diameter_min) +
          " and " + Math.round(astroid.estimated_diameter.meters.estimated_diameter_max) + " meters in size" +
          " moving at " + Math.round(astroid.close_approach_data[0].relative_velocity.kilometers_per_hour) + " kilometers per hour" +
          " and will miss the earth by " + Math.round(astroid.close_approach_data[0].miss_distance.kilometers) + " kilometers.";
        if(astroid.is_potentially_hazardous_asteroid){
          speechOutput = speechOutput + " It could kill us. Run for the hills. You're all going to die! "
        } else {
          speechOutput = speechOutput + " It poses no threat. ";
        }
      }
    }

    callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
  });

}


// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - " + title,
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}

// Don't use the demo key in production. Get a real key from https://api.nasa.gov/index.html#apply-for-an-api-key
function getNEO(startDate, endDate, callback) {
  return https.get({
    host: 'api.nasa.gov',
    path: '/neo/rest/v1/feed?start_date=' + startDate + '&end_date=' + endDate + '&api_key=DEMO_KEY'
  }, function(response) {
    // Continuously update stream with data
    var body = '';
    response.on('data', function(d) {
      body += d;
    });
    response.on('end', function() {
        console.log(body);
      callback(JSON.parse(body));
    });
  });
}