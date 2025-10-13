import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImagesService } from '../../services/images.service';
import { ButtonGroupComponent } from '../../components/button-group/button-group.component';

@Component({
  selector: 'app-main',
  imports: [RouterOutlet, ButtonGroupComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  imagesService = inject(ImagesService);

  ngAfterViewInit(): void {
    if (this.imagesService.mode() === 'full') {
      const [firstFlagged] = this.imagesService.flaggedImages();
      if (firstFlagged) this.imagesService.setMainImage(firstFlagged);
    }

    this.attachImageEvents('main-container');
    this.attachImageEvents('main-image');
    this.attachImageEvents('main-canvas');
  }

  private attachImageEvents(elementId: string): void {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.onclick = (e) => this.handleInteraction(e, true);
    element.onmousemove = (e) => this.handleInteraction(e, false);
  }

  private handleInteraction(e: MouseEvent, isClick: boolean): void {
    const rectId = this.imagesService.rectIdCursorInside(e);
    const insideRect = Boolean(rectId);
    const { lastRectCursorIsInside, selectedRect } = this.imagesService;
    const sameState = lastRectCursorIsInside === insideRect && (isClick ? selectedRect?.id === rectId : false);
    if (sameState) return;

    if (isClick) this.imagesService.selectedRect = this.imagesService.rects.find((r) => r.id === rectId) || null;

    this.imagesService.lastRectCursorIsInside = insideRect;
    this.imagesService.editable.set(insideRect);
    this.imagesService.toggleMainImageOrCanvas();
    this.imagesService.hoveringRect(rectId);
  }
}
