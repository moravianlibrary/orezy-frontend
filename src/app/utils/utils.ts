import { defaultColor, editedColor, errorColor, transparentColor, warningColor } from '../app.config';
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
  if (page.edited) return editedColor;

  const errorFlags = [
    'page_count_mismatch',
    'no_prediction',
    'prediction_overlap',
  ];
  if (page.flags.some(f => errorFlags.includes(f))) {
    return errorColor;
  }

  const warningFlags = [
    'low_confidence',
    'odd_dimensions',
  ];
  if (page.flags.some(f => warningFlags.includes(f))) {
    return warningColor;
  }

  return defaultColor;
}
