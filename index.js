var Service, Characteristic;
var request = require("request");
var pollingToEvent = require("polling-to-event");


module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-er-led-light", "ER Smart Light", ERSmartLightAccessory);
    homebridge.registerAccessory("homebridge-er-auto-mode-toggle", "ER Smart Light Auto Mode Toggle", ERAutoModeToggle);
};

function ERSmartLightAccessory(log, config) {
    this.log = log;

// ==========================================================================================================
    // URL Setup
    this.lights_on_url = config["lights_on_url"];
    this.lights_off_url = config["lights_off_url"];
    this.change_light_temperature_url = config["change_light_temperature_url"];
    this.brightness_level_url = config["brightness_level_url"];
    this.continuous_polling_url = config["continuous_polling_url"];
    this.desired_brightness_level_url = config["desired_brightness_level_url"];

    this.http_method = config["http_method"] || "GET";
    this.statusPollingInterval = config["statusPollingInterval"] || 500;

// ==========================================================================================================

    // Real-time Polling Status
    this.lightState = false;
    this.brightnessLevel = 0.0;
    this.colourTemp = 400;
    this.shutOffControls = false;
    var accessory = this;

    var realTimePollingURL = this.continuous_polling_url;
    var eventPoller = pollingToEvent(function (done) {
        accessory.httpRequest(realTimePollingURL, "", this.http_method, function (error, response, body) {
            if (error) {
                accessory.log("Get continuous polling function failed: %s", error.message);
                try {
                    done(new Error("Network failure that must not stop homebridge!"));
                } catch (err) {
                    accessory.log(err.message);
                }
            } else {
                done(null, body);
            }
        })
    }, { longpolling: true, interval: this.statusPollingInterval, longpollEventName: "eventPoller" });

    eventPoller.on("eventPoller", function(responseBody) {
        accessory.log("Get live status succeeded!");
        var jsonResponse = JSON.parse(responseBody);
        accessory.log(jsonResponse.state);
        var lightStatus = jsonResponse.state > 0;
        accessory.log("Light power state is currently: %s", lightStatus);
        accessory.lightState = lightStatus;

        // Prevent poller from setting state automatically...
        accessory.shutOffControls = true;

        accessory.lightbulbService.getCharacteristic(Characteristic.On)
        .setValue(accessory.lightState);
        accessory.shutOffControls = false;

        var brightnessLevel = jsonResponse.brightness;
        accessory.log("Light brightness level is currently: %s%", brightnessLevel);
        accessory.brightnessLevel = brightnessLevel;

        accessory.shutOffControls = true;
        accessory.lightbulbService.getCharacteristic(Characteristic.Brightness)
        .setValue(accessory.brightnessLevel);
        accessory.shutOffControls = false;

        var colourTemp = 1000000 / jsonResponse.colour_temp_in_kelvin;
        accessory.log("Colour temperature is currently: %sK", jsonResponse.colour_temp_in_kelvin);
        accessory.colourTemp = colourTemp;
        accessory.shutOffControls = true;
        accessory.lightbulbService.getCharacteristic(Characteristic.ColorTemperature)
        .setValue(accessory.colourTemp);
        accessory.shutOffControls = false;
    });
// ==========================================================================================================
}

ERSmartLightAccessory.prototype = {
    httpRequest: function(url, body, method, callback) {
        request({
                url: url,
                body: body,
                method: method,
            },
            function (error, response, body) {
                callback(error, response, body)
            })
    },

    setLightState: function(isPoweredOn, callback) {
        this.log("Power On", isPoweredOn);

        var url;
        var body;

        if (!this.lights_on_url || !this.lights_off_url) {
            this.log.warn("Ignoring request; No power url defined.");
            callback(new Error("No power url defined."));
            return;
        }

        if (isPoweredOn) {
            url = this.lights_on_url;
            body = this.on_body;
            this.log("Setting power state to on");
        } else {
            url = this.lights_off_url;
            body = this.off_body;
            this.log("Setting power state to off");
        }

        if (this.shutOffControls) {
            callback();
        } else {
            this.httpRequest(url, body, this.http_method, function(error, response, responseBody) {
                if (error) {
                    this.log("Light switch function failed: %s", error.message);
                    callback(error);
                } else {
                    this.log("Light switch function succeeded!");
                    callback();
                }
            }.bind(this));
        }
    },

    setBrightnessLevel: function(brightnessLevel, callback) {

        if (!this.desired_brightness_level_url) {
            this.log.warn("Ignoring request; no desired brightness level url defined.");
            callback(new Error("No desired brightness level url defined."));
            return;
        }
        
        var url = this.desired_brightness_level_url.replace("%b", brightnessLevel);
        this.log("Setting brightness to %s", brightnessLevel);

        if (this.shutOffControls) {
            callback();
        } else {
            this.httpRequest(url, "", this.http_method, function(error, response, responseBody) {
                if (error) {
                    this.log("Light desired brightness function failed: %s", error.message);
                    callback(error);
                } else {
                    this.log("Light desired brightness function succeeded!");
                    callback();
                }
            }.bind(this));
        }
    },

    setColourTemperature: function(colourTemp, callback) {
        if (!this.change_light_temperature_url) {
            this.log.warn("Ignoring request; no change light colour temperature url defined.");
            callback(new Error("No change light colour temperature url defined."));
            return;
        }

        var url = this.change_light_temperature_url.replace("%b", colourTemp);
        this.log("Changing colour temperature to %s", colourTemp);
        if (this.shutOffControls) {
            callback();
        } else {
            this.httpRequest(url, "", this.http_method, function (error, response, responseBody) {
                if (error) {
                    this.log("Colour change function failed: %s", error.message);
                    callback(error);
                } else {
                    this.log("Colour change function succeeded!");
                    callback();
                }
            }.bind(this));
        }
    },

    getServices: function() {
        var accessory = this;
        let informationService = new Service.AccessoryInformation();

        informationService
        .setCharacteristic(Characteristic.Manufacturer, "Unknown Chinese manufacturer")
        .setCharacteristic(Characteristic.Model, "66W Remote-Controlled Tri-Colour LED Lights")
        .setCharacteristic(Characteristic.SerialNumber, "000000000001");

        this.lightbulbService = new Service.Lightbulb(this.name);
        this.lightbulbService
        .getCharacteristic(Characteristic.On)
        .on("get", function (callback) {
            callback(null, accessory.lightState)
        })
        .on("set", this.setLightState.bind(this));

        this.lightbulbService
        .addCharacteristic(new Characteristic.Brightness())
        .on("get", function (callback) {
            callback(null, accessory.brightnessLevel)
        })
        .on("set", this.setBrightnessLevel.bind(this));

        this.lightbulbService
        .addCharacteristic(new Characteristic.ColorTemperature())
        .on("get", function (callback) {
            callback(null, accessory.colourTemp)
        })
        .on("set",this.setColourTemperature.bind(this));

        return [informationService, this.lightbulbService];
    }
}

function ERAutoModeToggle(log, config) {
    this.log = log;

    // ==========================================================================================================
    // URL Setup
    this.set_auto_url = config["set_auto_url"];
    this.continuous_polling_url = config["continuous_polling_url"];

    this.http_method = config["http_method"] || "GET";
    this.statusPollingInterval = config["statusPollingInterval"] || 500;

    // ==========================================================================================================
    // Real-time Polling Status
    this.autoControlsMode = 1;
    this.shutOffControls = false;
    var accessory = this;

    var realTimePollingURL = this.continuous_polling_url;

    var eventPoller = pollingToEvent(function (done) {
        accessory.httpRequest(realTimePollingURL, "", this.http_method, function (error, response, body) {
            if (error) {
                accessory.log("Get continuous polling function failed: %s", error.message);
                try {
                    done(new Error("Network failure that must not stop homebridge!"));
                } catch (err) {
                    accessory.log(err.message);
                }
            } else {
                done(null, body);
            }
        })
    }, { longpolling: true, interval: this.statusPollingInterval, longpollEventName: "eventPoller" });

    eventPoller.on("eventPoller", function(responseBody) {
        accessory.log("Get live status succeeded!");
        var jsonResponse = JSON.parse(responseBody);

        var autoControlsMode = jsonResponse.is_manual == "false" ? 1 : 0;
        accessory.log("is_manual is currently: %s", jsonResponse.is_manual);
        accessory.autoControlsMode = autoControlsMode;
        accessory.shutOffControls = true;
        accessory.switchService.getCharacteristic(Characteristic.On)
        .setValue(accessory.autoControlsMode);
        accessory.shutOffControls = false;
    });

}

ERAutoModeToggle.prototype = {
    httpRequest: function(url, body, method, callback) {
        request({
                url: url,
                body: body,
                method: method,
            },
            function (error, response, body) {
                callback(error, response, body)
            })
    },

    setAutoMode: function(switchMode, callback) {
        if (!this.set_auto_url) {
            this.log.warn("Ignoring request; no auto mode url defined.");
            callback(new Error("No auto mode url defined."));
            return;
        }

        this.log("Auto Mode Switch: ", switchMode == 0 ? "false" : "true");

        var url = this.set_auto_url.replace("%b", switchMode == 0 ? "false" : "true");
        this.log(url);

        if (this.shutOffControls) {
            callback();
        } else {
            this.httpRequest(url, "", this.http_method, function (error, response, responseBody) {
                if (error) {
                    this.log("Set auto mode function failed: %s", error.message);
                    callback(error);
                } else {
                    this.log("Set auto mode function succeeded!");
                    callback();
                }
            }.bind(this));
        }
    },

    getServices: function() {
        var accessory = this;
        let informationService = new Service.AccessoryInformation();

        informationService
        .setCharacteristic(Characteristic.Manufacturer, "Emmanuel Rayendra")
        .setCharacteristic(Characteristic.Model, "Auto Mode Switch Toggle")
        .setCharacteristic(Characteristic.SerialNumber, "000000000001");

        this.switchService = new Service.Switch("Auto Lights Control");
    
        this.switchService
        .getCharacteristic(Characteristic.On)
        .on("get", function (callback) {
            callback(null, accessory.autoControlsMode)
        })
        .on("set", this.setAutoMode.bind(this));

        return [informationService, this.switchService];
    }
}