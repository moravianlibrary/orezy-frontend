import { Component, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-not-found',
  imports: [],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss'
})
export class NotFoundComponent {
  private authSvc = inject(AuthService);
  
  goHome(): void {
    window.location.href = this.authSvc.baseUri;
  }
}
