import { Component } from '@angular/core';
import { MainComponent } from './layout/main/main.component';
import { PreviewbarComponent } from './layout/previewbar/previewbar.component';

@Component({
  selector: 'app-root',
  imports: [MainComponent, PreviewbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
}
