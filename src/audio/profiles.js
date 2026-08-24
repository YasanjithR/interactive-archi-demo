/* Duck profiles. The Web Audio API cannot detect what the output device is,
   so this has to be a visible control rather than a guess.

   Note the laptop inversion: floorDb goes DOWN (harder gain duck) but fmin goes
   UP. A small driver reproduces almost nothing below ~500 Hz, so filtering that
   low deletes the ducked bed instead of recessing it. */
export const PROFILES = {
  head: { id:'head', label:'Phones', floorDb:-16, k:1.0, fmin:900,  fmax:18000 },
  room: { id:'room', label:'Room',   floorDb:-20, k:1.3, fmin:700,  fmax:18000 },
  lap:  { id:'lap',  label:'Laptop', floorDb:-24, k:1.6, fmin:1400, fmax:16000 }
};
export const DEFAULT_PROFILE = 'room';
