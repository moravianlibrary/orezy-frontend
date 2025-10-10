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
    if (this.imagesService.mode() === 'full') this.imagesService.setMainImage(this.imagesService.flaggedImages()[0]);

    const mainImage = document.getElementById('main-image') as HTMLElement;
    mainImage.onclick = (e) => {
      const rectCursorIsInside = this.imagesService.isCursorInsideRect(e);
      this.imagesService.editable.set(Boolean(rectCursorIsInside));
      this.imagesService.toggleMainImageOrCanvas();
      this.imagesService.selectedRect = this.imagesService.rects.find(r => r.id === rectCursorIsInside) ?? null;
    }
    mainImage.onmousemove = (e) =>  {
      const rectCursorIsInside = this.imagesService.isCursorInsideRect(e);
      this.imagesService.editable.set(Boolean(rectCursorIsInside));
      this.imagesService.toggleMainImageOrCanvas();
      this.imagesService.hoveringRect(rectCursorIsInside);
    }

    const mainCanvas = document.getElementById('main-canvas') as HTMLElement;
    mainCanvas.onclick = (e) => {
      const rectCursorIsInside = this.imagesService.isCursorInsideRect(e);
      this.imagesService.editable.set(Boolean(rectCursorIsInside));
      this.imagesService.toggleMainImageOrCanvas();
      this.imagesService.selectedRect = this.imagesService.rects.find(r => r.id === rectCursorIsInside) ?? null;
    }
    mainCanvas.onmousemove = (e) =>  {
      const rectCursorIsInside = this.imagesService.isCursorInsideRect(e);
      this.imagesService.editable.set(Boolean(rectCursorIsInside));
      this.imagesService.toggleMainImageOrCanvas();
      this.imagesService.hoveringRect(rectCursorIsInside);
    }
  }
}
