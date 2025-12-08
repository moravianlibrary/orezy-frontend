import { Component, inject, signal } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { Router } from '@angular/router';
import { catchError, of, tap } from 'rxjs';
import { ExampleBook } from '../../app.types';

@Component({
  selector: 'app-examples',
  imports: [],
  templateUrl: './examples.component.html',
  styleUrl: './examples.component.scss'
})
export class ExamplesComponent {
  private router = inject(Router);
  imageService = inject(ImagesService);
  
  examples = signal<ExampleBook[]>([]);
  loading = signal<boolean>(true);
  
  ngOnInit(): void {
    this.imageService.fetchAllTitleIds().pipe(
      tap(() => this.loading.set(true)),
      catchError(err => {
        console.error('Fetch error:', err);
        return of([]);
      })
    )
    .subscribe(r => {
      this.examples.set(r as ExampleBook[]);
      this.loading.set(false);
    });
  }

  onClick(example: string): void {
    this.router.navigate(['/book', example]);
  }
}
