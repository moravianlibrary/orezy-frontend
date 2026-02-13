import { Component, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrls: ['./upload.component.scss']
})
export class UploadComponent {
  dashSvc = inject(DashboardService);
  
  h3 = input<string>('Přetáhněte sem');
  formatsAndSizeText = input<string>('');
  btnLabel = input<string>('Vybrat soubory');
  
  filesSelected = output<FileList>();

  isDragging = false;

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.filesSelected.emit(input.files);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;

    if (event.dataTransfer?.files?.length) {
      this.filesSelected.emit(event.dataTransfer.files);
    }
  }
}
