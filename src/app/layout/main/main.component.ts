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
    mainContainer.style.width = this.imagesService.mode() === 'final-full' ? '100%' : 'initial';
    mainContainer.style.height = this.imagesService.mode() === 'final-full' ? '100%' : 'initial';
    
    if (this.imagesService.mode() === 'final-full') this.imagesService.setMainImage(this.imagesService.flaggedImages()[0]);
  }
}
