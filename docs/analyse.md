
In every message:

    "msg": "CURRENT-STATE",
    "time": "2020-11-01T11:09:40.000Z",

Only in `CURRENT-STATE`

    "rssi": "-47",
    "channel": "11",
    "fqhp": "100040",
    "fghp": "72232",

Only in `CURRENT-STATE` and `STATE-CHANGE`

    "mode-reason": "RAPP",
    "state-reason": "MODE",

    "scheduler": {
        "srsc": "0000000000000000",
        "dstv": "0001",
        "tzid": "0001"
    },

    "product-state": {
        "fpwr": "ON",
        "auto": "ON",
        "oscs": "IDLE",
        "oson": "ON",
        "nmod": "OFF",
        "rhtm": "ON",
        "fnst": "OFF",
        "ercd": "50S2",
        "wacd": "NONE",
        "nmdv": "0004",
        "fnsp": "AUTO",
        "bril": "0002",
        "corf": "ON",
        "cflr": "INV",
        "hflr": "0100",
        "cflt": "NONE",
        "hflt": "GCOM",
        "sltm": "OFF",
        "osal": "0180",
        "osau": "0180",
        "ancp": "BRZE",
        "hume": "HUMD",
        "haut": "ON",
        "humt": "0060",
        "rect": "0045",
        "msta": "OFF",
        "clcr": "CLNO",
        "cdrr": "0060",
        "cltr": "0675",
        "wath": "0675",
        "psta": "OFF",
        "fdir": "OFF"
    },

Only in `ENVIRONMENTAL-CURRENT-SENSOR-DATA`

    "data": {
        "tact": "2949",
        "hact": "0053",
        "pm25": "0000",
        "pm10": "0000",
        "va10": "0007",
        "noxl": "0007",
        "p25r": "0001",
        "p10r": "0001",
        "sltm": "OFF"
    }

## Results

Settings:

- `sltm`: Timer: OFF, 0 … 540 (min)
- `rhtm`: Continuous Monitoring: OFF, ON

Fan:

- `fpwr`: Global On/Off State: OFF, ON
- `auto`: Auto Mode for Purifying: OFF, ON
- `fnst`: Actual Fan State: OFF, FAN
- `fnsp`: Airflow Speed: AUTO, 1 .. 10 (AUTO is only shown when auto set to ON)
- `nmod`: Night Mode: OFF, ON (Reduces Noise, lowers Air Flow Speed in Auto Modes)

Swing / Oscillator:

- `fdir`: Jet Focus: OFF = Output to the Back, ON = Use Front + Oscillator Current State (oscs)
- `oscs`: Oscillator Current State: IDLE, OFF, ON
- `oson`: Oscillator Enabled: OFF, ON, OION, OIOF - OI* is used when Auto Mode has stopped the Fan and User selects different Oscillation Mode (some kind of "later use this mode")
- `ancp`: Mode of Oszillation: 45, 90, BRZE

Humidifier:

- `haut`: Humidify Automatic: ON, OFF
- `hume`: Humidify Enable: OFF, HUMD
- `msta`: Humidifyer Current State: OFF, HUMD
- `humt`: Target Humidity: 0 … 100 %

Air Quality Sensor Data:

- `tact`: Temperature in Kelvin (int) [[1]]
- `hact`: Rel. Humidity in % (int) [[1]]

- `va10`: 
- `noxl`: 

- `pm25`: µg/m³ ?
- `pm10`: µg/m³ ?
- `p25r`: 
- `p10r`: 

Filter Maintenance:

- `cflr`: INV
- `hflr`: Remaining Filter Life: 0 … 100 (%)
- `cflt`: 
- `hflt`: 
- `cltr`: Deep Clean Cycle: int in hours ?
- `wath`: Deep Clean Cycle: int in hours ?

Unkown:

- `ercd`: 
- `wacd`: 
- `nmdv`: 
- `bril`: 
- `corf`: 
- `osal`: 
- `osau`: 
- `rect`: 
- `clcr`: 
- `cdrr`: 
- `psta`: 


[1]: https://github.com/lukasroegner/homebridge-dyson-pure-cool/blob/47d9ca02d3fad7fb0ec94e1a22d01cb6542db3cc/src/dyson-pure-cool-device.js#L440