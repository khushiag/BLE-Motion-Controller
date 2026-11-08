// IDs must match the firmware's gatt_uuid128.h (written in normal order here)
const SERVICE_UUID = 'c0de0001-7117-4a7e-b1a5-5e2a9d000000';
const CHAR_UUID    = 'c0de0002-7117-4a7e-b1a5-5e2a9d000000';

const btn     = document.getElementById('connect');
const statusEl = document.getElementById('status');
const rollEl  = document.getElementById('roll');
const pitchEl = document.getElementById('pitch');
const rateEl  = document.getElementById('rate');
const plate   = document.getElementById('plate');

let updates = 0;

btn.addEventListener('click', async () => {
  if (!navigator.bluetooth) {
    statusEl.textContent = 'Web Bluetooth not available. Use Chrome or Edge.';
    return;
  }

  try {
    statusEl.textContent = 'Pick your board in the popup…';
    // 1. Ask the user to choose a device (browser shows a picker)
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'NXP' }],
      optionalServices: [SERVICE_UUID],
    });
    device.addEventListener('gattserverdisconnected', onDisconnected);

    // 2. Connect and find our Tilt service + characteristic
    statusEl.textContent = `Connecting to ${device.name}…`;
    const server  = await device.gatt.connect();
    const service = await server.getPrimaryService(SERVICE_UUID);
    const tiltChar = await service.getCharacteristic(CHAR_UUID);

    // 3. Subscribe to notifications
    tiltChar.addEventListener('characteristicvaluechanged', onTilt);
    await tiltChar.startNotifications();

    statusEl.textContent = `Connected to ${device.name} ✔`;
    btn.disabled = true;
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Error: ${err.message}`;
  }
});

// Called ~50 times per second with 4 bytes: roll*10, pitch*10 (int16, little-endian)
function onTilt(event) {
  const data  = event.target.value;            // a DataView
  const roll  = data.getInt16(0, true) / 10;
  const pitch = data.getInt16(2, true) / 10;

  rollEl.textContent  = roll.toFixed(1);
  pitchEl.textContent = pitch.toFixed(1);
  plate.style.transform = `rotateX(${-pitch}deg) rotateY(${roll}deg)`;
  updates++;
}

function onDisconnected() {
  statusEl.textContent = 'Disconnected';
  btn.disabled = false;
}

// Show how many updates arrive each second
setInterval(() => {
  rateEl.textContent = `${updates} updates/sec`;
  updates = 0;
}, 1000);