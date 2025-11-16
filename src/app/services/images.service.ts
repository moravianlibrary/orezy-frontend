import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { AvgRect, ImageItem, Rect, Transformation } from '../app.types';
import { Observable } from 'rxjs';
import { books } from '../app.config';
import { degreeToRadian, findFirstMissing } from '../utils/utils';
import { EnvironmentService } from './environment.service';

@Injectable({
  providedIn: 'root'
})
export class ImagesService {
  private http = inject(HttpClient);
  private envService = inject(EnvironmentService);
  
  private get serverBaseUrl(): string {
    // Because envService might not be initialized at construction time
    return this.envService.get('serverBaseUrl') as string;
  }

  // ---------- STATE ----------
  books: string[] = books;
  modes: string[] = ['single', 'full'];

  book = signal<string>(books[2]);
  mode = signal<string>(this.modes[0]);
  selectedFilter: string = 'flagged';
  editable = signal<boolean>(false);

  images = signal<ImageItem[]>([]);
  displayedImages = signal<ImageItem[]>([]);
  // croppedImages = signal<ImageItem[]>([]);
  originalImages = signal<ImageItem[]>([]);
  originalTransformations = signal<Transformation[]>([]);

  mainImageItem = signal<ImageItem>({ url: 'https://media.tenor.com/WX_LDjYUrMsAAAAi/loading.gif' });
  wasEdited: boolean = false;

  c!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D;

  mainImage: HTMLImageElement | null = null;
  lastBook: string = '';
  lastMode: string = '';
  loading: boolean = false;

  currentRects: Rect[] = [];
  // shouldUpdateCroppedImages: boolean = false;
  selectedRect: Rect | null = null;
  lastSelectedRect: Rect | null = null;
  lastLeftInput: number = 0;
  lastTopInput: number = 0;
  lastWidthInput: number = 0;
  lastHeightInput: number = 0;
  lastAngleInput: number = 0;
  lastRectCursorIsInside: Rect | null = null;
  isDragging: boolean = false;
  mouseDownCurPos: { x: number, y: number } = { x: -1, y: -1 };
  startRectPos: { x_center: number; y_center: number;
    left: number; right: number; top: number; bottom: number; } = { x_center: -1, y_center: -1, left: -1, right: -1, top: -1, bottom: -1 };

  leftColor: string = '#00BFFF';
  rightColor: string = '#FF10F0';
  confidenceThreshold: number = .9;
  sideRatioThreshold: number = .02;
  avgSideRatio: number = 0;
  maxRects: number = 2;
  avgRect!: AvgRect;
  toggledMore: boolean = false;


  // ---------- DERIVED STATE ----------
  flaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.edited && (img.low_confidence || img.bad_sides_ratio)));
  notFlaggedImages = computed<ImageItem[]>(() => this.images().filter(img => !img.edited && (!img.low_confidence && !img.bad_sides_ratio)));
  editedImages = computed<ImageItem[]>(() => this.images().filter(img => img.edited));
  // flaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => img.low_confidence || img.bad_sides_ratio));
  // notFlaggedCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => !img.low_confidence && !img.bad_sides_ratio));
  // customCroppedImages = computed<ImageItem[]>(() => this.croppedImages().filter(img => img.edited));


  // ---------- INITIAL FETCHING ----------
  fetchTransformations(): Observable<Transformation[]> {
    return this.http.get<Transformation[]>(`${this.serverBaseUrl}/${this.book()}/transformations.json`);
  }

  // setCroppedImgs(tfs: Transformation[]): void {
  //   this.loading = true;
  //   Promise.all(this.buildCroppedImagePromises(tfs)).then((imgs: ImageItem[]) => { 
  //     this.croppedImages.set(imgs);
  //     if (this.mode() === 'single') {
  //       const [firstFlagged] = this.flaggedCroppedImages();
  //       if (firstFlagged) this.setMainImage(firstFlagged);
  //     }
  //     this.loading = false;
  //   });
  // }

  // private buildCroppedImagePromises(tfs: Transformation[]): Promise<ImageItem>[] {
  //   return tfs.map(t => {
  //     return new Promise<ImageItem>(resolve => {
  //       const c = document.createElement('canvas');
  //       const ctx = c.getContext('2d');
  //       if (!ctx) return resolve({});

  //       const img = new Image();
  //       img.crossOrigin = 'anonymous';
  //       img.src = getImageUrl(this.serverBaseUrl, t.image_path);

  //       img.onload = () => {
  //         const centerX = t.x_center * img.width;
  //         const centerY = t.y_center * img.height;
  //         const angle = degreeToRadian(t.angle);

  //         c.width = t.width * img.width;
  //         c.height = t.height * img.height;

  //         ctx.save();
  //         ctx.translate(c.width / 2, c.height / 2);
  //         ctx.rotate(-angle);
  //         ctx.drawImage(img, -centerX, -centerY);
  //         ctx.restore();

  //         resolve({
  //           name: t.image_path,
  //           url: c.toDataURL('image/jpeg'),
  //           crop_part: t.crop_part,
  //           low_confidence: t.low_confidence,
  //           bad_sides_ratio: t.bad_sides_ratio,
  //           edited: false
  //         });
  //       };

  //       img.onerror = () => console.error('Failed to load image.');
  //     });
  //   });
  // }


  // ---------- DISPLAYED IMAGES ----------
  setDisplayedImages(): void {
    switch (this.selectedFilter) {
      case 'all':
        this.displayedImages.set(this.images());
        break;
      case 'flagged':
        this.displayedImages.set(this.flaggedImages());
        break;
      case 'edited':
        this.displayedImages.set(this.editedImages());
        break;
      case 'ok':
        this.displayedImages.set(this.notFlaggedImages());
        break;
    }
  }


  // ---------- MAIN IMAGE LOGIC ----------
  setMainImage(img: ImageItem): void {
    // if (this.shouldUpdateCroppedImages) {
    //   this.updateCroppedImages(this.mainImageItem());
    // }
    const rects = img.rects?.map(r => {
      const bounds = this.computeBounds(r.x_center, r.y_center, r.width, r.height, r.angle);
      return {
        ...r,
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom
      }
    });
    const finalImg = { ...img, rects: rects };

    this.selectedRect = null;
    this.editable.set(false);
    this.toggleMainImageOrCanvas();
    // if (this.mode() === 'full') {
      this.renderFullImageAndCanvas(finalImg)
    // } else {
    //   this.mainImageItem.set(img);
    // }
  }

  private renderFullImageAndCanvas(img: ImageItem): void {
    ['image', 'canvas'].forEach(type =>
      this.setMainFullImageOrCanvas(type as 'image' | 'canvas', img)
    );
  }

  toggleMainImageOrCanvas(): void {
    const mainImage = document.getElementById('main-image') as HTMLElement;
    const mainCanvas = this.c;

    const showCanvas = this.editable() || !!this.selectedRect;
    if (mainImage) mainImage.style.zIndex = showCanvas ? '5' : '10';
    if (mainCanvas) mainCanvas.style.zIndex = showCanvas ? '10' : '5';
  }


  // ---------- FULL IMAGE DRAWING ----------
  private setMainFullImageOrCanvas(type: 'image' | 'canvas', imgItem: ImageItem): void {
    const mainImage = (document.getElementById('main-image') as HTMLElement).style;
    const mainCanvas =(document.getElementById('main-canvas') as HTMLElement).style;
    
    if (imgItem.url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imgItem.url;
      this.mainImage = img;

      img.onload = () => this.fitAndDrawImage(img, imgItem, type);
      img.onerror = () => console.error('Failed to load image.');

      mainImage.visibility = 'visible';
      mainCanvas.visibility = 'visible';
      return;
    }

    mainImage.visibility = 'hidden';
    mainCanvas.visibility = 'hidden';
  }

  private fitAndDrawImage(
    img: HTMLImageElement,
    imgItem: ImageItem,
    type: 'image' | 'canvas'
  ): void {
    const { c, ctx } = this;
    if (!ctx) return;

    const appMain = document.querySelector('app-main') as HTMLElement;
    const appStyle = getComputedStyle(appMain);
    const appRect = appMain.getBoundingClientRect();

    const widthAvail =
      appRect.width -
      (parseFloat(appStyle.paddingLeft) +
        parseFloat(appStyle.paddingRight) +
        parseFloat(appStyle.borderLeftWidth) +
        parseFloat(appStyle.borderRightWidth));

    const heightAvail =
      appRect.height -
      (parseFloat(appStyle.paddingTop) +
        parseFloat(appStyle.paddingBottom) +
        parseFloat(appStyle.borderTopWidth) +
        parseFloat(appStyle.borderBottomWidth));

    const imgRatio = img.width / img.height;
    const appRectRatio = appRect.width / appRect.height;

    c.width = widthAvail;
    c.height = heightAvail;

    imgRatio > appRectRatio
      ? c.height = (img.height / img.width) * c.width
      : c.width = imgRatio * c.height;

    ctx.drawImage(img, 0, 0, c.width, c.height);
    this.currentRects = [];

    this.images()
      .find(img => img.name === imgItem.name)
      ?.rects
      ?.forEach(r => {
        const bounds = this.computeBounds(r.x_center, r.y_center, r.width, r.height, r.angle);
        const finalR = {
          ...r,
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom
        }
        this.currentRects.push(finalR);
        this.drawRectangle(finalR);
      });
    
    if (type === 'image') {
      const lastMainImageItemName = this.mainImageItem().name;

      this.mainImageItem.set({ ...imgItem, url: c.toDataURL('image/jpeg') });

      if (imgItem.name && lastMainImageItemName && imgItem.name !== lastMainImageItemName && this.wasEdited) {
        this.updateImagesByEdited(lastMainImageItemName);
      }
    }
  }

  private drawRectangle(r: Rect): void {
    const { c, ctx } = this;
    if (!ctx) return;
    
    const [centerX, centerY] = [c.width * r.x_center, c.height * r.y_center];
    const [width, height] = [c.width * r.width, c.height * r.height];
    const angle = degreeToRadian(r.angle);
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle);

    ctx.fillStyle = r.color + '10';
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
  }


  // ---------- RECTANGLE LOGIC ----------
  computeBounds(x_center: number, y_center: number, width: number, height: number, angle: number): { 
    left: number,
    right: number,
    top: number,
    bottom: number
  } {
    const rad = degreeToRadian(angle);
    const cw = this.c.width;
    const ch = this.c.height;
    const hw = (width * cw) / 2;
    const hh = (height * ch) / 2;
    const corners = [
      { x: -hw, y: -hh },
      { x: hw,  y: -hh },
      { x: hw,  y: hh  },
      { x: -hw, y: hh  },
    ];
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const rotated = corners.map(pt => ({
      x: x_center * cw + pt.x * cos - pt.y * sin,
      y: y_center * ch + pt.x * sin + pt.y * cos,
    }));
    const xs = rotated.map(p => p.x);
    const ys = rotated.map(p => p.y);

    return {
      left: Math.min(...xs) / cw,
      right: Math.max(...xs) / cw,
      top: Math.min(...ys) / ch,
      bottom: Math.max(...ys) / ch
    }
  }
  
  drawRect(c: HTMLCanvasElement, ctx: CanvasRenderingContext2D, r: Rect, hoveredId?: string): void {
    const [centerX, centerY] = [c.width * r.x_center, c.height * r.y_center];
    const [width, height] = [c.width * r.width, c.height * r.height];
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(degreeToRadian(r.angle));

    ctx.fillStyle = r.color + '10';
    ctx.fillRect(-width / 2, -height / 2, width, height);

    if (r.id === hoveredId || this.selectedRect?.id === r.id) {
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(-width / 2, -height / 2, width, height);
    }

    ctx.restore();
  }
  
  addRect(): void {
    if (this.currentRects.length >= this.maxRects) return;
    
    const cropPart = findFirstMissing(this.currentRects.map(r => r.crop_part));
    const addedRect = {
      id: `${this.mainImageItem().name}-${cropPart}`,
      x_center: .5,
      y_center: .5,
      left: .5 - this.avgRect.width / 2,
      right: .5 + this.avgRect.width / 2,
      top: .5 - this.avgRect.height / 2,
      bottom: .5 + this.avgRect.height / 2,
      width: this.avgRect.width,
      height: this.avgRect.height,
      angle: 0,
      crop_part: cropPart,
      color: cropPart === 1 ? this.leftColor : this.rightColor,
      edited: true
    };
    this.currentRects.push(addedRect);
    
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r));
    this.updateMainImageItemAndImages();
    this.selectedRect = this.currentRects[this.currentRects.length - 1];
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r));
    // this.shouldUpdateCroppedImages = true;
    this.wasEdited = true;
  }

  removeRect(): void {
    this.currentRects = this.currentRects.filter(r => r !== this.selectedRect);
    this.redrawImage();
    this.currentRects.forEach(r => this.drawRect(this.c, this.ctx, r));
    this.updateMainImageItemAndImages();
    // this.croppedImages.update(prev => prev.filter(img => `${img.name}-${img.crop_part}` !== this.selectedRect?.id));
    this.selectedRect = null;
    this.wasEdited = true;
  }

  redrawImage(): void {
    const { c, ctx } = this;
    ctx.clearRect(0, 0, c.width, c.height);
    if (this.mainImage) ctx.drawImage(this.mainImage, 0, 0, c.width, c.height);
  }

  updateMainImageItemAndImages(): void {
    this.mainImageItem.set({ ...this.mainImageItem(), url: this.c.toDataURL('image/jpeg') });
    this.images.update(prev =>
      prev.map(img => img.name === this.mainImageItem().name
        ? { 
            ...img,
            rects: this.currentRects
          }
        : img
      )
    );
  }

  updateImagesByEdited(imgName: string): void {
    this.images.update(prev =>
      prev.map(img => img.name === imgName
        ? { 
            ...img,
            edited: true
          }
        : img
      )
    );
    this.wasEdited = false;
  }

  // updateCroppedImages(mainImageItem: ImageItem): void {
  // //   let cropPart = 0;
  // //   const promises = this.currentRects
  // //     .filter(r => r.edited)
  // //     .map(r => {
  // //       cropPart = r.crop_part;
  // //       return new Promise<ImageItem>(resolve => {
  // //         const c = document.createElement('canvas');
  // //         const ctx = c.getContext('2d');
  // //         if (!ctx) return resolve({});

  // //         const img = new Image();
  // //         img.crossOrigin = 'anonymous';
  // //         img.src = getImageUrl(this.serverBaseUrl, mainImageItem.name ?? '');

  // //         img.onload = () => {
  // //           const centerX = r.x_center * img.width;
  // //           const centerY = r.y_center * img.height;
  // //           const angle = degreeToRadian(r.angle);

  // //           c.width = r.width * img.width;
  // //           c.height = r.height * img.height;

  // //           ctx.save();
  // //           ctx.translate(c.width / 2, c.height / 2);
  // //           ctx.rotate(-angle);
  // //           ctx.drawImage(img, -centerX, -centerY);
  // //           ctx.restore();

  // //           resolve({
  // //             name: mainImageItem.name,
  // //             url: c.toDataURL('image/jpeg'),
  // //             crop_part: r.crop_part,
  // //             edited: true
  // //           });
  // //         };

  // //         img.onerror = () => console.error('Failed to load image.');
  // //       });
  // //   });
    
  // //   this.croppedImages.update(prev => prev
  // //     .filter(img => img.name !== mainImageItem.name || img.crop_part !== cropPart));

  // //   Promise.all(promises).then(imgArr => imgArr.forEach(img => this.croppedImages.update(prev => [...prev, img])));

  // //   this.shouldUpdateCroppedImages = false;
  // // }


  // ---------- KEYBOARD SHORTCUTS ----------
  onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    if (!this.isHandledKey(key) || (event.target as HTMLElement).tagName === 'INPUT') return;

    switch (key) {
      case 'Backspace':
        if (this.selectedRect) this.removeRect();
        break;
      case 'Delete':
        if (this.selectedRect) this.removeRect();
        break;
      case 'r':
        if (this.currentRects.length < this.maxRects) this.addRect();
        break;
    }
  }

  private isHandledKey(key: string): boolean {
    return [
      'Backspace', 'Delete',
      'r'
    ].includes(key);
  }
}
