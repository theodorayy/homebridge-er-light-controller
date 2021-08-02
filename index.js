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
    this.lights_off_url = config["lights_on_url"];
    this.change_light_temperature_url = config["change_light_temperature_url"];


    this.http_method = config["http_method"] || "GET";
}

ERSmartLightAccessory.prototype = {

    httpRequest: function (url, body, method, callback) {
        request({
                url: url,
                body: body,
                method: method,
            },
            function (error, response, body) {
                callback(error, response, body)
            })
    },

    setLightState: function (isPoweredOn, callback) {
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

        this.httpRequest(url, body, this.http_method, function (error, response, responseBody) {
            if (error) {
                this.log("HTTP set power function failed: %s", error.message);
                callback(error);
            } else {
                this.log("HTTP set power function succeeded!");
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
        .on("set", this.setLightState.bind(this));

        this.informationService = informationService;
        this.lightbulbService = lightbulbService;
        return [informationService, lightbulbService];
    }
}