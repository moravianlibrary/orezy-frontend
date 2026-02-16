import { defaultColor, editedColor, errorColor, warningColor } from '../app.config';
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

export function clamp(value: number, min: number = 0, max: number = 1): number {
  return Math.min(max, Math.max(min, value));
}


/* ------------------------------
  FORMATTING
------------------------------ */
export function getDate(input: string): string[] {
  const date = new Date(input);
  return date
    .toLocaleString('cs-CZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(/\. /g, '.')
    .split(' ');
}

export function checkEmailValidity(email: string): boolean {
  if (!email) return false;

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(normalizedEmail);
}


/* ------------------------------
  UI
------------------------------ */
export function defer(fn: () => void, delay: number = 0) {
  return setTimeout(fn, delay);
}

export function focusMainWrapper(): void {
  const el = document.querySelector('.main-wrapper') as HTMLElement;
  if (el) defer(() => (el.focus()));
}

export function scrollToSelectedImage(): void {
  const element = document.querySelector('.thumbnail-wrapper.selected') as HTMLElement;
  scrollToElement(element);
}

export function scrollToElement(element: HTMLElement, timeout: number = 100): void {
  defer(() => {
    if (element) (element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, timeout);
}


/* ------------------------------
    PAGES
  ------------------------------ */
export function getColor(page: Page): string {
  if (page.edited) return editedColor;

  const errorFlags = [
    // 'page_count_mismatch',
    // 'no_prediction',
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
