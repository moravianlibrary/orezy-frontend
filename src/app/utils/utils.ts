import { defaultColor, editedColor, warningColor } from '../app.config';
import { Page } from '../app.types';

/* ------------------------------
  MATH
------------------------------ */
export function degreeToRadian(angle: number): number {
  return (angle * Math.PI) / 180;
}

export function radianToDegree(angle: number): number {
  return (angle * 180) / Math.PI;
}

export function roundToDecimals(value: number, decimals: number = 2): number {
  return Number(value.toFixed(decimals));
}


/* ------------------------------
  UI
------------------------------ */
export function defer(fn: () => void, delay: number = 0) {
  return setTimeout(fn, delay);
}

export function scrollToSelectedImage(timeout: number = 100): void {
  defer(() => {
    const element = document.querySelector('.thumbnail-wrapper.selected');
    if (element) (element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, timeout);
}

/* ------------------------------
    PAGES
  ------------------------------ */
export function getColor(page: Page): string {
  return page.edited ? editedColor : (page.flags.length ? warningColor : defaultColor);
}
