const log = require('yalm');
const config = require('yargs')
    .describe('verbosity', 'Possible Values: \'error\', \'warn\', \'info\', \'debug\'')
    .describe('email')
    .describe('password')
    .describe('country')
    .alias({
        h: 'help',
        v: 'verbosity',
        e: 'email',
        p: 'password',
        c: 'country'
    })
    .default({
        country: 'DE'
    })
    .demandOption([
        'email',
        'password'
    ])
    .version()
    .help('help')
    .argv;

log.setLevel(config.verbosity);
log.debug('loaded config:', config);

const rp = require('request-promise-native');
const crypto = require('crypto');

(async () => {
    try {
        const login = await rp({
            method: 'POST',
            uri: 'https://appapi.cp.dyson.com/v1/userregistration/authenticate',
            qs: {
                country: config.country
            },
            body: {
                Email: config.email,
                Password: config.password
            },
            json: true,
            rejectUnauthorized: false
        });

        log.debug(login);

        const devices = await rp({
            uri: 'https://appapi.cp.dyson.com/v2/provisioningservice/manifest',
            auth: {
                user: login.Account,
                password: login.Password
            },
            json: true,
            rejectUnauthorized: false
        });

        log.debug(devices);

        for (const device of devices) {
            log.info({
                Name: device.Name,
                'Product Type': device.ProductType,
                'Serial / Username': device.Serial,
                Password: decryptPassword(device.LocalCredentials).apPasswordHash
            });
        }
    } catch (error) {
        log.error(error);
    }
})();

function decryptPassword(encryptedPassword) {
    const key = Uint8Array.from(new Array(32), (_, index) => index + 1);
    const initVector = new Uint8Array(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, initVector);
    let decryptedPassword = decipher.update(encryptedPassword, 'base64', 'utf8');
    decryptedPassword += decipher.final('utf8');

    return JSON.parse(decryptedPassword);
}
