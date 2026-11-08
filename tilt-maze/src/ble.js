// Talks to the FRDM-MCXW71 over Web Bluetooth.
// IDs must match the firmware's gatt_uuid128.h (written in normal order here).
const SERVICE_UUID = 'c0de0001-7117-4a7e-b1a5-5e2a9d000000';
const CHAR_UUID = 'c0de0002-7117-4a7e-b1a5-5e2a9d000000';

export class TiltBoard {
  constructor() {
    this.roll = 0;          // degrees, straight from the board
    this.pitch = 0;
    this.connected = false;
    this.updatesPerSec = 0;
    this.onStatus = () => {};
    this._count = 0;
    this._intervals = [];      // ms between notifications (for the latency test)
    this._lastArrival = 0;
    this.lastArrival = 0;      // performance.now() of the newest notification
    setInterval(() => {
      this.updatesPerSec = this._count;
      this._count = 0;
    }, 1000);
  }

  get supported() {
    return 'bluetooth' in navigator;
  }

  async connect() {
    if (!this.supported) {
      this.onStatus('Web Bluetooth not available. Use Chrome or Edge.');
      return;
    }
    try {
      this.onStatus('Pick your board in the popup…');
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'NXP' }],
        optionalServices: [SERVICE_UUID],
      });
      device.addEventListener('gattserverdisconnected', () => {
        this.connected = false;
        this.onStatus('Board disconnected');
      });

      this.onStatus(`Connecting to ${device.name}…`);
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const ch = await service.getCharacteristic(CHAR_UUID);
      ch.addEventListener('characteristicvaluechanged', (e) => this._onData(e));
      await ch.startNotifications();
      this._char = ch;

      this.connected = true;
      this.onStatus(`Connected to ${device.name}`);
    } catch (err) {
      console.error(err);
      this.onStatus(`Error: ${err.message}`);
    }
  }

  // 4 bytes: roll*10, pitch*10 as little-endian int16
  _onData(event) {
    const now = performance.now();
    if (this._lastArrival) {
      this._intervals.push(now - this._lastArrival);
      if (this._intervals.length > 500) this._intervals.shift();
    }
    this._lastArrival = now;
    this.lastArrival = now;

    const v = event.target.value;
    this.roll = v.getInt16(0, true) / 10;
    this.pitch = v.getInt16(2, true) / 10;
    this._count++;
  }

  // ───────────── Latency test ─────────────
  // 1. Radio round trip: ask the board to read the tilt value back, n times.
  //    One-way radio delay is roughly half of this.
  // 2. Notification spacing: how evenly the 50 Hz updates actually arrive.
  async measureLatency(n = 100) {
    if (!this.connected || !this._char) throw new Error('Connect the board first');
    const rtts = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      await this._char.readValue();
      rtts.push(performance.now() - t0);
    }
    return {
      roundTrip: stats(rtts),
      notifyInterval: stats(this._intervals),
    };
  }
}

function stats(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const pct = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  return {
    samples: s.length,
    min: +s[0].toFixed(1),
    median: +pct(50).toFixed(1),
    p95: +pct(95).toFixed(1),
    max: +s[s.length - 1].toFixed(1),
  };
}