const Mqtt = require('mqtt');
const log = require('yalm');
log.setLevel('debug');

const config = require('yargs')
    .describe('serial-number')
    .describe('password')
    .describe('ip-address')
    .describe('product-type')
    .alias({
        h: 'help',
        p: 'password',
        i: 'ip-address',
        s: 'serial-number',
        t: 'product-type'
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

let data = {};

const dysonClient = Mqtt.connect('mqtt://' + config.ipAddress, {
    username: config.serialNumber,
    password: config.password,
    protocolVersion: 3,
    protocolId: 'MQIsdp'
});
log.debug('dyson > connect');

dysonClient.on('connect', () => {
    log.info('dyson < connected');

    // Subscribes to the status topic to receive updates
    dysonClient.subscribe(config.productType + '/' + config.serialNumber + '/status/current');
    dysonClient.subscribe(config.productType + '/' + config.serialNumber + '/status/faults');
    dysonClient.subscribe(config.productType + '/' + config.serialNumber + '/status/connection');
    dysonClient.subscribe(config.productType + '/' + config.serialNumber + '/status/software');
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

    if (content.msg === 'ENVIRONMENTAL-CURRENT-SENSOR-DATA') {
        data = Object.assign(data, content.data);
    }

    if (content.msg === 'CURRENT-STATE') {
        data = Object.assign(data, content['product-state']);
    }

    if (content.msg === 'STATE-CHANGE') {
        for (const [key, value] of Object.entries(content['product-state'])) {
            data[key] = value[1];
        }
    }

    if (content.msg === 'CURRENT-FAULTS') {
        const keysOfInterest = new Set([
            'product-errors',
            'product-warnings',
            'module-errors',
            'module-warnings'
        ]);

        const result = {};

        for (const category of Object.keys(content).filter(k => keysOfInterest.has(k))) {
            for (const [datapoint, status] of Object.entries(content[category])) {
                if (status !== 'OK') {
                    result[category] = result[category] ?? {};
                    result[category][datapoint] = status;
                }
            }
        }

        data.faults = result;
    }

    log.debug(data);
});
