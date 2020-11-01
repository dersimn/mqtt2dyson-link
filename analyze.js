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

    log.debug(data);
});
