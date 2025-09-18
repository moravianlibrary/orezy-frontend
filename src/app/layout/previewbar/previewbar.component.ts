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
}
