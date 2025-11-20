import { Component, ElementRef, inject, QueryList, ViewChildren } from '@angular/core';
import { ImagesService } from '../../services/images.service';
import { ImageItem } from '../../app.types';
import { scrollToSelectedImage } from '../../utils/utils';
import { LoaderComponent } from '../../components/loader/loader.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-left-panel',
  imports: [LoaderComponent],
  templateUrl: './left-panel.component.html',
  styleUrl: './left-panel.component.scss'
})
export class LeftPanelComponent {
  imagesService = inject(ImagesService);


  /* ------------------------------
    LAZY IMAGES LOADING
  ------------------------------ */
  @ViewChildren('lazyImg') images!: QueryList<ElementRef>;

  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const img = entry.target as HTMLImageElement;
      const id = img.dataset['id']!;
      const targetImg = this.imagesService.images().find(x => x._id === id);

      if (targetImg?.thumbnailUrl) {
        img.src = targetImg.thumbnailUrl;
        this.observer.unobserve(img);
        return;
      }

      // forkJoin({
      //   thumbnail: this.imagesService.fetchThumbnail(id),
      //   full: this.imagesService.fetchImage(id)
      // }).subscribe(({ thumbnail, full }) => {
      this.imagesService.fetchThumbnail(id).subscribe(thumbnail => {
        const thumbnailUrl = URL.createObjectURL(thumbnail);
        // const imageUrl = URL.createObjectURL(full);

        img.src = thumbnailUrl;

        this.imagesService.images.update(prev =>
          prev.map(img =>
            img._id === id
              ? {
                  ...img,
                  thumbnailUrl: thumbnailUrl,
                  // url: imageUrl
                }
              : img
          )
        );

        this.observer.unobserve(img);
      });
    });
  });

  ngAfterViewInit(): void {
    this.images.changes.subscribe(() => this.observeNewImages());
  }

  private observeNewImages(): void {
    this.images.forEach(img => this.observer.observe(img.nativeElement));
  }


  /* ------------------------------
    CLICKS
  ------------------------------ */
  clickFilter(filter: string): void {
    const imgSvc = this.imagesService;
    imgSvc.selectedFilter = filter;
    
    const mainImageItemName = imgSvc.mainImageItem()._id;
    if (imgSvc.imgWasEdited) {
      imgSvc.updateImagesByEdited(mainImageItemName ?? '');
    }

    imgSvc.setDisplayedImages();

    const newImage = imgSvc.displayedImages().find(img => img._id === mainImageItemName)
      || imgSvc.displayedImages()[0]
      || { url: '' };
    imgSvc.setMainImage(newImage);

    scrollToSelectedImage();
  }

  clickThumbnail(image: ImageItem): void {
    this.imagesService.setMainImage(image);
  }

  getStatusIconTooltip(image: ImageItem): string {
    if (image.edited) {
      return 'Upraveno';
    }

    const flags = image.flags;
    const flagMessages: Record<string, string> = {
      low_confidence: 'Nejistota',
      odd_dimensions: 'Podezřelý rozměr',
      page_count_mismatch: 'Chybějící strana',
      prediction_overlap: 'Výřezy se překrývají',
    };

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

    console.log(matchedMessages);
    console.log(`${messages.join(', ')}, ${secondLast} a ${last}`);

    return `${messages.join(', ')}, ${secondLast} a ${last}`;
  }
}
