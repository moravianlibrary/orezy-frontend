import { Component, ElementRef, inject, QueryList, ViewChildren } from '@angular/core';
import { EditorService } from '../../services/editor.service';
import { ImageItem } from '../../app.types';
import { LoaderComponent } from '../../components/loader/loader.component';
import { NgClass } from '../../../../node_modules/@angular/common';
import { MenuComponent } from "../../components/menu/menu.component";
import { flagMessages } from '../../app.config';
// import { Subscription } from 'rxjs';

@Component({
  selector: 'app-left-panel-editor',
  imports: [LoaderComponent, NgClass, MenuComponent],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.scss'
})
export class LeftPanelComponent {
  edtSvc = inject(EditorService);

  pageImagesNumber(number: number): number {
    return this.edtSvc.displayedImages().filter(img => img.pages.length === number).length;
  }


  /* ------------------------------
    LAZY IMAGES LOADING
  ------------------------------ */
  @ViewChildren('lazyImg') images!: QueryList<ElementRef<HTMLImageElement>>;

  // private imagesSub?: Subscription;
  private observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const img = entry.target as HTMLImageElement;
      const id = img.dataset['id']!;
      const targetImg = this.edtSvc.images().find(img => img._id === id);

      if (targetImg?.thumbnailUrl) {
        img.src = targetImg.thumbnailUrl;
        this.observer.unobserve(img);
        return;
      }

      this.edtSvc.fetchThumbnail(id).subscribe(thumbnail => {
        const thumbnailUrl = URL.createObjectURL(thumbnail);

        img.src = thumbnailUrl;

        this.edtSvc.images.update(prev =>
          prev.map(img =>
            img._id === id
              ? {
                  ...img,
                  thumbnailUrl: thumbnailUrl
                }
              : img
          )
        );

        this.observer.unobserve(img);
      });
    });
  });

  ngAfterViewInit(): void {
    // this.observeNewImages();
    /* this.imagesSub =  */this.images.changes.subscribe(() => this.observeNewImages());
  }

  ngOnDestroy(): void {
    // this.imagesSub?.unsubscribe();
    this.observer.disconnect();
  }

  private observeNewImages(): void {
    this.images.forEach(img => this.observer.observe(img.nativeElement));
  }


  /* ------------------------------
    CLICKS
  ------------------------------ */
  clickThumbnail(image: ImageItem): void {
    const edtSvc = this.edtSvc;
    if (image._id === edtSvc.mainImageItem()._id) return;
    
    edtSvc.updateImagesByCurrentPages();
    edtSvc.setMainImage(image);
  }

  getStatus(image: ImageItem): 'edited' | 'error' | 'warning' | 'success' {
    if (image.edited) return 'edited';

    const errorFlags = [
      'page_count_mismatch',
      'no_prediction',
      'prediction_overlap',
    ];
    if (image.flags.some(f => errorFlags.includes(f))) {
      return 'error';
    }

    const warningFlags = [
      'low_confidence',
      'odd_dimensions',
    ];
    if (image.flags.some(f => warningFlags.includes(f))) {
      return 'warning';
    }

    return 'success';
  }


  getStatusIconTooltip(image: ImageItem): string {
    if (image.edited) {
      return 'Upraveno';
    }

    const flags = image.flags;

    let matchedMessages = Object.entries(flagMessages)
      .filter(([flag]) => flags.includes(flag))
      .map(([, message]) => message);

    if (matchedMessages.length === 0) {
      return 'OK';
    }

    if (matchedMessages.length > 1 && flags.includes('low_confidence')) {
      matchedMessages = matchedMessages.filter(msg => msg !== flagMessages['low_confidence']);
    }

    if (matchedMessages.length === 1) {
      return matchedMessages[0];
    }

    const messages = [...matchedMessages];

    if (messages.length === 2) {
      return messages.join(' a ');
    }

    const last = messages[messages.length - 1];
    const secondLast = messages[messages.length - 2];

    return `${messages.join(', ')}, ${secondLast} a ${last}`;
  }
}
