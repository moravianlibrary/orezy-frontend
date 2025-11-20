import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';

@Component({
  selector: 'app-more-bubble',
  imports: [],
  templateUrl: './more-bubble.component.html',
  styleUrl: './more-bubble.component.scss'
})
export class MoreBubbleComponent {
  
  @ViewChild('bubbleRoot', { static: true }) bubbleRoot!: ElementRef;
  show = false;

  toggleBubble(): void {
    this.show = !this.show;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.bubbleRoot.nativeElement.contains(event.target)) this.show = false;
  }
}
