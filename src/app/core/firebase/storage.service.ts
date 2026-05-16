import { Injectable, inject } from '@angular/core';
import { Storage, ref, getDownloadURL } from '@angular/fire/storage';
import { Observable, from, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly storage = inject(Storage);

  getDownloadUrl(path: string): Observable<string> {
    if (!path?.trim()) {
      return of('');
    }

    return from(getDownloadURL(ref(this.storage, path))).pipe(
      catchError(() => of(''))
    );
  }
}
