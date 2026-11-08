# Tilt Controller

An NXP FRDM-MCXW71 board used as a Bluetooth tilt controller for two browser games.

## Folders

- `tilt_ble` – board firmware (sends tilt over Bluetooth)
- `tilt_reader` – simple accelerometer test
- `tilt-maze` – the two web games

## Run the games

```
cd tilt-maze
npm install
npm run dev
```

Open in Chrome or Edge:

- Marble maze: http://localhost:5173/
- Car game: http://localhost:5173/drive.html

Click **Connect board**, hold the board flat, click **Calibrate**, then tilt to play.
No board? Use the arrow keys.