import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-bottom-panel',
  imports: [],
  templateUrl: './bottom-panel.component.html',
  styleUrl: './bottom-panel.component.scss'
})
export class BottomPanelComponent {
  imagesService = inject(ImagesService);

  /* ------------------------------
    ZOOMS & FIT TO SCREEN
  ------------------------------ */
  fitToScreen(): void {
    const imgSvc = this.imagesService;
    const img = imgSvc.displayedImages().find(img => img._id === imgSvc.mainImageItem()._id);
    if (!img) return;
    imgSvc.setMainImage(img);
  }
}
