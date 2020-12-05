#!/usr/bin/env node

const pkg = require('./package.json');
const log = require('yalm');
const MqttSmarthome = require('mqtt-smarthome-connect');
const Mqtt = require('mqtt');
const Yatl = require('yetanothertimerlibrary');

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
    .describe('polling-interval', 'Polling interval (in s) for collecting status updates.')
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
        'mqtt-url': 'mqtt://127.0.0.1',
        'polling-interval': 60
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

const productCapabilities = {
    358: {
        modelName: 'Dyson Pure Humidify+Cool',
        hardwareRevision: 'PH01',
        hasBasicAirQualitySensors: false,
        hasAdvancedAirQualitySensors: true,
        hasHumidifier: true,
        hasJetFocus: true,
        hasHeating: false
    }
    // ,
    // 438: {
    //     modelName: 'Dyson Pure Cool Tower',
    //     hardwareRevision: 'TP04',
    //     hasBasicAirQualitySensors: false,
    //     hasAdvancedAirQualitySensors: true,
    //     hasHumidifier: false,
    //     hasJetFocus: true,
    //     hasHeating: false
    // },
    // 455: {
    //     modelName: 'Dyson Pure Hot+Cool Link',
    //     hardwareRevision: 'HP02',
    //     hasBasicAirQualitySensors: false,
    //     hasAdvancedAirQualitySensors: false,
    //     hasHumidifier: false,
    //     hasJetFocus: true,
    //     hasHeating: true
    // },
    // 469: {
    //     modelName: 'Dyson Pure Cool Link Desk',
    //     hardwareRevision: 'DP01',
    //     hasBasicAirQualitySensors: false,
    //     hasAdvancedAirQualitySensors: false,
    //     hasHumidifier: false,
    //     hasJetFocus: false,
    //     hasHeating: false
    // },
    // 475: {
    //     modelName: 'Dyson Pure Cool Link Tower',
    //     hardwareRevision: 'TP02',
    //     hasBasicAirQualitySensors: false,
    //     hasAdvancedAirQualitySensors: false,
    //     hasHumidifier: false,
    //     hasJetFocus: false,
    //     hasHeating: false
    // },
    // 520: {
    //     modelName: 'Dyson Pure Cool Desk',
    //     hardwareRevision: 'DP04',
    //     hasBasicAirQualitySensors: false,
    //     hasAdvancedAirQualitySensors: true,
    //     hasHumidifier: false,
    //     hasJetFocus: true,
    //     hasHeating: false
    // },
    // 527: {
    //     modelName: 'Dyson Pure Hot+Cool',
    //     hardwareRevision: 'HP04',
    //     hasBasicAirQualitySensors: false,
    //     hasAdvancedAirQualitySensors: true,
    //     hasHumidifier: false,
    //     hasJetFocus: true,
    //     hasHeating: true
    // }
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

    mqsh.subscribe(config.name + '/set/fan/enabled', (_, input) => {
        sendCommand({
            fpwr: input ? 'ON' : 'OFF'
        });
    });
    mqsh.subscribe(config.name + '/set/fan/speed', (_, input) => {
        if (input === 0) {
            sendCommand({
                auto: 'ON'
            });
        } else {
            sendCommand({
                fnsp: mapValue(input, [
                    {in: {min: 1, max: 10}, out: input => String(input).padStart(4, '0')}
                ])
            });
        }
    });
    mqsh.subscribe(config.name + '/set/fan/night-mode', (_, input) => {
        sendCommand({
            nmod: input ? 'ON' : 'OFF'
        });
    });

    mqsh.subscribe(config.name + '/set/fan/direction', (_, input) => {
        sendCommand({
            fpwr: 'ON', // Turn On. Otherwise it grinds the gears to death.
            fdir: mapValue(input, [
                {in: 1, out: 'ON'},
                {in: 0, out: 'OFF'}
            ])
        });
    });
    mqsh.subscribe(config.name + '/set/fan/swing/enabled', (_, input) => {
        if (input) {
            sendCommand({
                fdir: 'ON',
                oson: 'ON'
            });
        } else {
            sendCommand({
                oson: 'OFF'
            });
        }
    });
    mqsh.subscribe(config.name + '/set/fan/swing/mode', (_, input) => {
        // Automatically sets fan/direction to Front
        sendCommand({
            ancp: mapValue(input, [
                {out: '0045', in: 0},
                {out: '0090', in: 1},
                {out: 'BRZE', in: 2}
            ])
        });
    });

    mqsh.subscribe(config.name + '/set/purify/auto-mode', (_, input) => {
        sendCommand({
            auto: input ? 'ON' : 'OFF'
        });
    });

    mqsh.subscribe(config.name + '/set/humidify/enabled', (_, input) => {
        sendCommand({
            hume: input ? 'HUMD' : 'OFF'
        });
    });
    mqsh.subscribe(config.name + '/set/humidify/auto-mode', (_, input) => {
        sendCommand({
            haut: input ? 'ON' : 'OFF'
        });
    });
    mqsh.subscribe(config.name + '/set/humidify/target', (_, input) => {
        sendCommand({
            humt: mapValue(input, [
                {in: {min: 30, max: 70}, out: input => String(input).padStart(4, '0')}
            ])
        });
    });
});

log.debug('mqsh > connect', config.mqttUrl);
mqsh.connect();

const dysonClient = Mqtt.connect('mqtt://' + config.ipAddress, {
    username: config.serialNumber,
    password: config.password,
    protocolVersion: 3,
    protocolId: 'MQIsdp'
});
log.debug('dyson > connect');

const pollingTimer = new Yatl.Timer(() => {
    dysonClient.publish(config.productType + '/' + config.serialNumber + '/command', JSON.stringify({
        msg: 'REQUEST-CURRENT-STATE',
        time: new Date().toISOString()
    }));
}, config.pollingInterval * 1000);

dysonClient.on('connect', () => {
    log.info('dyson < connected');

    mqsh.publish(config.name + '/maintenance/online/fan', true, {retain: true});

    // Subscribes to the status topic to receive updates
    dysonClient.subscribe(config.productType + '/' + config.serialNumber + '/status/current', () => {
        // Sends an initial request for the current state
        pollingTimer.restart().exec();
    });
});
dysonClient.on('error', error => {
    log.error('dyson -', error);
    pollingTimer.stop();
    mqsh.publish(config.name + '/maintenance/online/fan', false, {retain: true});
});
dysonClient.on('reconnect', () => {
    log.debug('dyson - reconnect');
    pollingTimer.stop();
    mqsh.publish(config.name + '/maintenance/online/fan', false, {retain: true});
});
dysonClient.on('close', () => {
    log.debug('dyson - close');
    pollingTimer.stop();
    mqsh.publish(config.name + '/maintenance/online/fan', false, {retain: true});
});
dysonClient.on('offline', () => {
    log.debug('dyson - offline');
    pollingTimer.stop();
    mqsh.publish(config.name + '/maintenance/online/fan', false, {retain: true});
});
dysonClient.on('end', () => {
    log.debug('dyson - end');
    pollingTimer.stop();
    mqsh.publish(config.name + '/maintenance/online/fan', false, {retain: true});
});
dysonClient.on('message', (topic, payload) => {
    const content = JSON.parse(payload);
    log.debug('dyson <', content);
    mqsh.publish(config.name + '/raw', {topic, content});

    const ts = (new Date(content.time)).getTime();

    if (content.msg === 'ENVIRONMENTAL-CURRENT-SENSOR-DATA') {
        const rawTemperature = content.data?.tact;
        if (rawTemperature) {
            mqsh.publish(config.name + '/status/temperature', {
                val: (Number.parseInt(rawTemperature, 10) / 10) - 273.15,
                unit: '°C',
                ts
            }, {retain: true});
        }

        const rawHumidity = content.data?.hact;
        if (rawHumidity) {
            mqsh.publish(config.name + '/status/humidity', {
                val: Number.parseInt(rawHumidity, 10),
                unit: '%',
                range: {min: 0, max: 100, steps: 1},
                ts
            }, {retain: true});
        }

        if (productCapabilities[config.productType].hasAdvancedAirQualitySensors) {
            try {
                mqsh.publish(config.name + '/status/air-quality/pm25', {
                    val: Number.parseInt(content.data?.pm25, 10),
                    unit: 'µg/m³',
                    ts
                }, {retain: true});
            } catch (error) {
                log.error(error);
            }

            try {
                mqsh.publish(config.name + '/status/air-quality/pm10', {
                    val: Number.parseInt(content.data?.pm10, 10),
                    unit: 'µg/m³',
                    ts
                }, {retain: true});
            } catch (error) {
                log.error(error);
            }

            try {
                mqsh.publish(config.name + '/status/air-quality/p25r', {
                    val: Number.parseInt(content.data?.p25r, 10),
                    unit: 'µg/m³',
                    ts
                }, {retain: true});
            } catch (error) {
                log.error(error);
            }

            try {
                mqsh.publish(config.name + '/status/air-quality/p10r', {
                    val: Number.parseInt(content.data?.p10r, 10),
                    unit: 'µg/m³',
                    ts
                }, {retain: true});
            } catch (error) {
                log.error(error);
            }

            try {
                mqsh.publish(config.name + '/status/air-quality/va10', {
                    val: Number.parseInt(content.data?.va10, 10),
                    ts
                }, {retain: true});
            } catch (error) {
                log.error(error);
            }

            try {
                mqsh.publish(config.name + '/status/air-quality/noxl', {
                    val: Number.parseInt(content.data?.noxl, 10),
                    ts
                }, {retain: true});
            } catch (error) {
                log.error(error);
            }
        }
    }

    if (content.msg === 'CURRENT-STATE') {
        processIncomingMessage(content['product-state'], ts);
    }

    if (content.msg === 'STATE-CHANGE') {
        const data = {};
        for (const [key, value] of Object.entries(content['product-state'])) {
            data[key] = value[1];
        }

        processIncomingMessage(data, ts);
    }
});

function processIncomingMessage(input, ts = Date.now()) {
    const fanEnabled = input.fpwr === 'ON';
    const fanActualState = input.fnst === 'FAN';
    const rawFanSpeed = input.fnsp;

    mqsh.publish(config.name + '/status/fan/enabled', {
        val: fanEnabled,
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/fan/actual-state', {
        val: fanActualState,
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/fan/speed', {
        val: (rawFanSpeed === 'AUTO') ? 0 : Number.parseInt(rawFanSpeed, 10),
        enum: ['Auto', ...Array.from({length: 10}, (v, k) => String(k + 1))],
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/fan/night-mode', {
        val: input.nmod === 'ON',
        ts
    }, {retain: true});

    mqsh.publish(config.name + '/status/fan/direction', {
        val: mapValue(input.fdir, [
            {in: 'ON', out: 1},
            {in: 'OFF', out: 0}
        ]),
        enum: ['Back', 'Front'],
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/fan/swing/enabled', {
        val: mapValue(input.oson, [
            {in: 'ON', out: true},
            {in: 'OFF', out: false},
            {in: 'OION', out: true},
            {in: 'OIOF', out: false}
        ]),
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/fan/swing/actual-state', {
        val: mapValue(input.oscs, [
            {in: 'ON', out: 1},
            {in: 'OFF', out: 0},
            {in: 'IDLE', out: 2}
        ]),
        enum: ['Off', 'On', 'Idle'],
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/fan/swing/mode', {
        val: mapValue(input.ancp, [
            {in: '0045', out: 0},
            {in: '0090', out: 1},
            {in: 'BRZE', out: 2}
        ]),
        enum: ['45°', '90°', 'Breeze'],
        ts
    }, {retain: true});

    mqsh.publish(config.name + '/status/purify/auto-mode', {
        val: input.auto === 'ON',
        ts
    }, {retain: true});

    mqsh.publish(config.name + '/status/humidify/enabled', {
        val: mapValue(input.hume, [
            {in: 'OFF', out: false},
            {in: 'HUMD', out: true}
        ]),
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/humidify/actual-state', {
        val: mapValue(input.msta, [
            {in: 'OFF', out: false},
            {in: 'HUMD', out: true}
        ]),
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/humidify/target', {
        val: Number.parseInt(input.humt, 10),
        unit: '%',
        ts
    }, {retain: true});
    mqsh.publish(config.name + '/status/humidify/auto-mode', {
        val: input.haut === 'ON',
        ts
    }, {retain: true});

    mqsh.publish(config.name + '/maintenance/filter-life', {
        val: Number.parseInt(input.hflr, 10),
        unit: '%',
        ts
    }, {retain: true});
}

function sendCommand(data) {
    log.debug('dyson >', data);

    dysonClient.publish(config.productType + '/' + config.serialNumber + '/command', JSON.stringify({
        msg: 'STATE-SET',
        time: new Date().toISOString(),
        data
    }));
}

function mapValue(input, range) {
    for (const candidate of range) {
        if (typeof candidate.in === 'object') {
            if ((input >= candidate.in.min) && (input <= candidate.in.max)) {
                return (typeof candidate.out === 'function') ? candidate.out(input) : candidate.out;
            }
        } else if (input === candidate.in) {
            return (typeof candidate.out === 'function') ? candidate.out(input) : candidate.out;
        }
    }
}
