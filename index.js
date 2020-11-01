#!/usr/bin/env node

const pkg = require('./package.json');
const log = require('yalm');
const MqttSmarthome = require('mqtt-smarthome-connect');
const Mqtt = require('mqtt');
const shortid = require('shortid');

const environmentVariablesPrefix = pkg.name.replace(/[^a-zA-Z\d]/, '_').toUpperCase();
const config = require('yargs')
    .env(environmentVariablesPrefix)
    .usage(pkg.name + ' ' + pkg.version + '\n' + pkg.description + '\n\nUsage: $0 [options]')
    .describe('verbosity', 'possible values: "error", "warn", "info", "debug"')
    .describe('name', 'instance name. used as mqtt client id and as prefix for connected topic')
    .describe('mqtt-url', 'mqtt broker url. See https://github.com/mqttjs/MQTT.js#connect-using-a-url')
    .describe('serial-number')
    .describe('password')
    .describe('ip-address')
    .describe('product-type')
    .alias({
        h: 'help',
        v: 'verbosity',
        m: 'mqtt-url',
        p: 'password',
        i: 'ip-address',
        s: 'serial-number',
        t: 'product-type'
    })
    .default({
        name: 'dyson',
        'mqtt-url': 'mqtt://127.0.0.1'
    })
    .demandOption([
        'ip-address',
        'serial-number',
        'password',
        'product-type'
    ])
    .version()
    .help('help')
    .argv;

log.setLevel(config.verbosity);
log.info(pkg.name + ' ' + pkg.version + ' starting');
log.debug('loaded config:', config);
log.debug('ENV Prefix:', environmentVariablesPrefix);

let model;
let hardwareRevision;
let hasHeating;
let hasHumidifier;
let hasJetFocus;
let hasAdvancedAirQualitySensors;

const productCapabilities = {
    358: {
        modelName: 'Dyson Pure Humidify+Cool',
        hardwareRevision: 'PH01',
        hasBasicAirQualitySensors: false,
        hasAdvancedAirQualitySensors: true,
        hasHumidifier: true,
        hasJetFocus: true,
        hasHeating: false
    },
    438: {
        modelName: 'Dyson Pure Cool Tower',
        hardwareRevision: 'TP04',
        hasBasicAirQualitySensors: false,
        hasAdvancedAirQualitySensors: true,
        hasHumidifier: false,
        hasJetFocus: true,
        hasHeating: false
    },
    455: {
        modelName: 'Dyson Pure Hot+Cool Link',
        hardwareRevision: 'HP02',
        hasBasicAirQualitySensors: false,
        hasAdvancedAirQualitySensors: false,
        hasHumidifier: false,
        hasJetFocus: true,
        hasHeating: true
    },
    469: {
        modelName: 'Dyson Pure Cool Link Desk',
        hardwareRevision: 'DP01',
        hasBasicAirQualitySensors: false,
        hasAdvancedAirQualitySensors: false,
        hasHumidifier: false,
        hasJetFocus: false,
        hasHeating: false
    },
    475: {
        modelName: 'Dyson Pure Cool Link Tower',
        hardwareRevision: 'TP02',
        hasBasicAirQualitySensors: false,
        hasAdvancedAirQualitySensors: false,
        hasHumidifier: false,
        hasJetFocus: false,
        hasHeating: false
    },
    520: {
        modelName: 'Dyson Pure Cool Desk',
        hardwareRevision: 'DP04',
        hasBasicAirQualitySensors: false,
        hasAdvancedAirQualitySensors: true,
        hasHumidifier: false,
        hasJetFocus: true,
        hasHeating: false
    },
    527: {
        modelName: 'Dyson Pure Hot+Cool',
        hardwareRevision: 'HP04',
        hasBasicAirQualitySensors: false,
        hasAdvancedAirQualitySensors: true,
        hasHumidifier: false,
        hasJetFocus: true,
        hasHeating: true
    }
};

if (!Object.keys(productCapabilities).includes(String(config.productType))) {
    log.error(`Product Type '${config.productType}' is currently not supported. Supported devices are:`, Object.keys(productCapabilities));
    process.exit(1);
}

const mqsh = new MqttSmarthome(config.mqttUrl, {
    logger: log,
    will: {topic: config.name + '/maintenance/online', payload: 'false', retain: true}
});

mqsh.on('connect', () => {
    log.info('mqsh < connected', config.mqttUrl);
    mqsh.publish(config.name + '/maintenance/online', true, {retain: true});
});

const dysonClient = Mqtt.connect('mqtt://' + config.ipAddress, {
    username: config.serialNumber,
    password: config.password,
    protocolVersion: 3,
    protocolId: 'MQIsdp'
});
log.debug('dyson > connect');

dysonClient.on('connect', () => {
    log.info('dyson < connected');

    log.debug('mqsh > connect', config.mqttUrl);
    mqsh.connect();

    // Subscribes to the status topic to receive updates
    dysonClient.subscribe(config.productType + '/' + config.serialNumber + '/status/current', () => {
        // Sends an initial request for the current state
        dysonClient.publish(config.productType + '/' + config.serialNumber + '/command', JSON.stringify({
            msg: 'REQUEST-CURRENT-STATE',
            time: new Date().toISOString()
        }));
    });
});
dysonClient.on('error', error => {
    log.error('dyson -', error);
});
dysonClient.on('reconnect', () => {
    log.debug('dyson - reconnect');
});
dysonClient.on('close', () => {
    log.debug('dyson - close');
});
dysonClient.on('offline', () => {
    log.debug('dyson - offline');
});
dysonClient.on('end', () => {
    log.debug('dyson - end');
});
dysonClient.on('message', (topic, payload) => {
    const content = JSON.parse(payload);
    log.debug('dyson <', content);
    mqsh.publish(config.name + '/raw', content);

    const ts = (new Date(content.time)).getTime();

    if (content.msg === 'ENVIRONMENTAL-CURRENT-SENSOR-DATA') {

    }

    if (content.msg === 'CURRENT-STATE') {

    }

    if (content.msg === 'STATE-CHANGE') {

    }
});

