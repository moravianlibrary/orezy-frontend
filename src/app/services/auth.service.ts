import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { EnvironmentService } from './environment.service';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private envService = inject(EnvironmentService);

  username = signal<string>('');
  password = signal<string>('');
  error = signal<string>('');

  get baseUri(): string {
    let baseUri = `${window.location.protocol}//${window.location.hostname}`;
    if (window.location.port) baseUri += `:${window.location.port}`;
    return baseUri;
  }
  private get apiUrl(): string { return this.envService.get('serverBaseUrl') };
  private get authHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`
    });
  }
  private get loginHeaders(): HttpHeaders {
    return new HttpHeaders({
      accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    });
  }
    
  canActivate(next: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    localStorage.setItem('redirectUri', state.url);
    const accessToken = localStorage.getItem('access_token');

    // Possible výjimka z loginu
    // if (condition) return true;

    if (accessToken) {
      return this.verifyToken().pipe(
        catchError((err) => {
          localStorage.removeItem('access_token');
          this.router.navigate([localStorage.getItem('url') || '']);

          console.error('Token verification failed: ', err);
          throw err;
        }),
      );
    }

    this.redirectToLogin();
    return false;
  }

  private verifyToken(): any {
    return this.http.get(`${this.apiUrl}/users/current-user`, { headers: this.authHeaders })
  }

  private redirectToLogin(): void {
    window.location.href = `${this.baseUri}/login`;
  }

  login(): any {
    localStorage.removeItem('access_token');
    this.error.set('');

    this.getToken().pipe(
      catchError((err) => {
        console.log('Token fetch failed: ', err);
        return of(null);
      })
    ).subscribe((response: any) => {
      if (!response?.access_token) {
        console.warn('No access_token in response');
        this.error.set('Nesprávný e-mail nebo heslo');
        return;
      }

      localStorage.setItem('access_token', response.access_token);

      this.redirectToStoredUri();
    })
  }

  private getToken(): any {
    const url = `${this.apiUrl}/users/login`;
    const payload = `grant_type=password&username=${this.username()}&password=${this.password()}&scope=&client_id=null&client_secret=null`;

    return this.http.post(url, payload, { headers: this.loginHeaders });
  }

  private redirectToStoredUri(): void {
    window.location.href = `${this.baseUri}${localStorage.getItem('redirectUri') || '/'}`;
  }
}
