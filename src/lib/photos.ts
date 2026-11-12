// Our own photos (the same ones as on pacificeliterides.com), bundled with the app.
import type { ImageSourcePropType } from 'react-native';
import type { VehicleKey } from './estimate';

export const CAR_PHOTO: Record<VehicleKey, ImageSourcePropType> = {
  SUV: require('../../assets/car-suv.jpg'),
  Sprinter: require('../../assets/car-sprinter.jpg'),
};
export const FLEET_PHOTO: ImageSourcePropType = require('../../assets/fleet.jpg');
