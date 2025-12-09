import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { MainComponent } from '../../layout/main/main.component';
import { BottomPanelComponent } from '../../layout/bottom-panel/bottom-panel.component';
import { LeftPanelComponent } from '../../layout/left-panel/left-panel.component';
import { RightPanelComponent } from '../../layout/right-panel/right-panel.component';
import { ActivatedRoute } from '@angular/router';
import { catchError, map, of, Subscription, switchMap, tap } from 'rxjs';
import { GridMode, ImageItem, Page } from '../../app.types';
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
  private paramsOnBookId = new Subscription();

  @ViewChild('mainWrapper', { static: true }) mainWrapper!: ElementRef<HTMLElement>;

  ngOnInit() {
    const imgSvc = this.imagesService;
    
    // Subscribe to params
    this.paramsOnBookId = this.activatedRoute.paramMap
      .pipe(
        map(params => params.get('id') || '' ),
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

        imgSvc.gridMode.set(localStorage.getItem('gridMode') as GridMode ?? 'when-rotating');
        imgSvc.gridRadio.set(imgSvc.gridMode());
        imgSvc.selectedFilter = localStorage.getItem('filter') ?? 'flagged';
        imgSvc.selectedPageNumberFilter.set(localStorage.getItem('filterPageNumber') || null);
        imgSvc.setDisplayedImages();
        
        const imageList = imgSvc.displayedImagesFinal();
        if (!imageList.length) imgSvc.loadingMain = false;;
        const newImage = imageList.find(img => img._id === imgSvc.mainImageItem()._id) || imageList[0] || { url: '' };
        imgSvc.setMainImage(newImage);
      });
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.mainWrapper.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.paramsOnBookId.unsubscribe();
  }
}
