import { serverBaseUrl } from '../app.config';

export function getImageUrl(imageName: string): string {
  return serverBaseUrl + '/images/' + imageName;
}

export function degreeToRadian(angle: number): number {
  return (angle * Math.PI) / 180;
}

export function defer(fn: () => void, delay: number = 0) {
  return setTimeout(fn, delay);
}
