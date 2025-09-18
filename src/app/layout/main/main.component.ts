import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-main',
  imports: [RouterOutlet],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss'
})
export class MainComponent {
  imagesService = inject(ImagesService);

  ngOnInit(): void {
    this.imagesService.mainImageUrl.set(this.imagesService.imageUrls()[0]);
  }
}
