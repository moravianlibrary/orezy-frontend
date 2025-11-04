
export function getImageUrl(serverBaseUrl: string, imageName: string): string {
  return serverBaseUrl + '/' + imageName;
}

export function degreeToRadian(angle: number): number {
  return (angle * Math.PI) / 180;
}

export function defer(fn: () => void, delay: number = 0) {
  return setTimeout(fn, delay);
}

export function findFirstMissing(arr: number[]) {
  const set = new Set(arr);
  let i = 1;
  while (set.has(i)) i++;
  return i;
}

export function scrollToSelectedImage(timeout: number = 100): void {
  setTimeout(() => {
    const element = document.querySelector('.thumbnail-wrapper.selected');
    if (element) (element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, timeout);
}
