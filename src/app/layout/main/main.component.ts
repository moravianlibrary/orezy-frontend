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
    const mainContainer = document.getElementById('main-container') as HTMLElement;
    mainContainer.style.width = this.imagesService.mode() === 'full' ? '100%' : 'initial';
    mainContainer.style.height = this.imagesService.mode() === 'full' ? '100%' : 'initial';

    if (this.imagesService.mode() === 'full') this.imagesService.setMainImage(this.imagesService.flaggedImages()[0]);

    const mainImage = document.getElementById('main-image') as HTMLElement;
    mainImage.onclick = (e) => {
      this.imagesService.editable.set(this.imagesService.isCursorInsideRect(e));
      this.imagesService.toggleMainImageOrCanvas();
    }
    mainImage.onmousemove = (e) =>  {
      const isCursorInsideRect = this.imagesService.isCursorInsideRect(e);
      this.imagesService.editable.set(isCursorInsideRect);
      this.imagesService.toggleMainImageOrCanvas();

      const c = document.getElementById('main-canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return;

      if (isCursorInsideRect) {
        ctx.strokeStyle = this.imagesService.rightColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'none';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
}
