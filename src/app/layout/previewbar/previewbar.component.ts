import { Component, inject } from '@angular/core';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-previewbar',
  imports: [],
  templateUrl: './previewbar.component.html',
  styleUrl: './previewbar.component.scss'
})
export class PreviewbarComponent {
  imagesService = inject(ImagesService);
  toggledMore: boolean = false;

  becomeMainImage(imageUrl: string): void {
    this.imagesService.mainImageUrl.set(imageUrl);
  }

  toggleMorePreview(): void {
    this.toggledMore = !this.toggledMore;
  }

  ngAfterViewInit(): void {
    // console.log(this.imagesService.leftTransformations());
    // console.log(this.imagesService.rightTransformations());
    // console.log(this.imagesService.avgSideRation);
    // console.log(this.imagesService.flaggedImages());
    // console.log(this.imagesService.notFlaggedImages().length);
  }
}
