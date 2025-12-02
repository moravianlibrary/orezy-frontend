import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { MainComponent } from '../../layout/main/main.component';
import { BottomPanelComponent } from '../../layout/bottom-panel/bottom-panel.component';
import { LeftPanelComponent } from '../../layout/left-panel/left-panel.component';
import { RightPanelComponent } from '../../layout/right-panel/right-panel.component';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, of, Subscription, switchMap, tap } from 'rxjs';
import { ImageItem, Page } from '../../app.types';
import { roundToDecimals } from '../../utils/utils';

@Component({
  selector: 'app-editor',
  imports: [MainComponent, BottomPanelComponent, LeftPanelComponent, RightPanelComponent],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss'
})
export class EditorComponent {
  imagesService = inject(ImagesService);
  private activatedRoute = inject(ActivatedRoute);
  private queryParamsOnBookId = new Subscription();

  @ViewChild('mainWrapper', { static: true }) mainWrapper!: ElementRef<HTMLElement>;

  ngOnInit() {
    const imgSvc = this.imagesService;
    
    // Subscribe to URL queryParams
    this.queryParamsOnBookId = this.activatedRoute.queryParams
      .pipe(
        map(params => params['id'] || '' ),
        switchMap(id => id === '' ? imgSvc.fetchAllTitleIds(): of([id])),
        tap((idArr: string[]) => {
          imgSvc.book.set(idArr[0]);
          imgSvc.loadingLeft = true;
          imgSvc.loadingMain = true;
        }),
        switchMap(() => imgSvc.fetchScans(imgSvc.book())),
        map((imgItems: ImageItem[]) => {
          
          const enrichedImgItems = imgItems.map(imgItem => {
            const newPages: Page[] = [];
            
            imgItem.pages.forEach(p => {
              newPages.push({ 
                ...p,
                angle: roundToDecimals(p.angle, 2)
              });
            });

            return {
              ...imgItem,
              pages: newPages
            }
          })
          
          return enrichedImgItems
        }),
        catchError(err => {
          console.error('Fetch error:', err);
          return of([]);
        })
      )
      .subscribe((imgItems: ImageItem[]) => {
        imgSvc.loadingLeft = false;
        imgSvc.images.set(imgItems);
        imgSvc.originalImages.set(imgItems);
        imgSvc.displayedImages.set(imgSvc.flaggedImages());
        if (!imgSvc.displayedImages().length) imgSvc.loadingMain = false;;
        const [firstFlagged] = imgSvc.flaggedImages();
        if (firstFlagged) imgSvc.setMainImage(firstFlagged);
      });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.mainWrapper.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.queryParamsOnBookId.unsubscribe();
  }
}
