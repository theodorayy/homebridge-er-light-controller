var Service, Characteristic;
var request = require("request");


module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-er-light-controller", "ER Bedroom Light", ERSmartLightAccessory);
};

function ERSmartLightAccessory(log, config) {
    this.log = log;

    // URL Setup
    this.lights_on_url = config["lights_on_url"];
    this.lights_off_url = config["lights_off_url"];
    this.light_status_url = config["light_status_url"];
    this.change_light_temperature_url = config["change_light_temperature_url"];
    this.decrease_brightness_url = config["decrease_brightness_url"];
    this.increase_brightness_url = config["increase_brightness_url"];
    this.decrease_colour_temp_url = config["decrease_colour_temp_url"];
    this.increase_colour_temp_url = config["increase_colour_temp_url"];
    this.set_the_mood_url = config["set_the_mood_url"];
    this.set_auto_url = config["set_auto_url"];

    this.http_method = config["http_method"] || "GET";
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

    getLightState: function(callback) {
        if (!this.light_status_url) {
            this.log.warn("Ignoring request; no light status url defined.");
            callback(new Error("No status url defined."));
            return;
        }

        var url = this.light_status_url;
        this.log("Getting power state");

        this.httpRequest(url, "", this.http_method, function(error, response, responseBody) {
            if (error) {
                this.log("Get light switch status failed: %s", error.message);
                callback(error);
            } else {
                this.log("Get light switch status succeeded!");
                var jsonResponse = JSON.parse(responseBody);
                this.log(jsonResponse.state);
                var lightStatus = jsonResponse.state > 0;
                this.log("Light power state is currently: %s", lightStatus);
                callback(null, lightStatus);
            }
        }.bind(this));
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

        this.httpRequest(url, body, this.http_method, function(error, response, responseBody) {
            if (error) {
                this.log("Light switch function failed: %s", error.message);
                callback(error);
            } else {
                this.log("Light switch function succeeded!");
                callback();
            }
        }.bind(this));
    },

    setColourTemperature: function(callback) {
        var url;
        var body;

        if (!this.change_light_temperature_url) {
            this.log.warn("Ignoring request; No change light colour temperature url defined.");
            callback(new Error("No change light colour temperature url defined."));
            return;
        }

        url = this.change_light_temperature_url;
        this.log("Changing colour temperature");

        this.httpRequest(url, body, this.http_method, function (error, response, responseBody) {
            if (error) {
                this.log("Colour change function failed: %s", error.message);
                callback(error);
            } else {
                this.log("Colour change function succeeded!");
                callback();
            }
        }.bind(this));
    },

    getServices: function() {
        let informationService = new Service.AccessoryInformation();

        informationService
        .setCharacteristic(Characteristic.Manufacturer, "Unknown Chinese manufacturer")
        .setCharacteristic(Characteristic.Model, "66W Remote-Controlled Tri-Colour LED Lights")
        .setCharacteristic(Characteristic.SerialNumber, "000000000001");

        let lightbulbService = new Service.Lightbulb(this.name);
        lightbulbService
        .getCharacteristic(Characteristic.On)
        .on("get", this.getLightState.bind(this))
        .on("set", this.setLightState.bind(this));

        this.informationService = informationService;
        this.lightbulbService = lightbulbService;
        return [informationService, lightbulbService];
    }
}