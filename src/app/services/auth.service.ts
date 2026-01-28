import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { EnvironmentService } from './environment.service';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Role, User } from '../app.types';

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

  userFullName = signal<string>('');
  userRole = signal<Role>('user');

  get baseUri(): string {
    return window.location.origin;
  }
  get apiUrl(): string { return this.envService.get('serverBaseUrl') };
  authHeaders(type: string = 'json', contentType: boolean = false): HttpHeaders {
    const authType = 'Bearer';

    return new HttpHeaders({
      accept: type === 'json' ? 'application/json' : '*/*',
      Authorization: `${authType} ${localStorage.getItem('access_token')}`,
      ...(contentType && { 'Content-Type': 'application/json' })
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
        })
      ).subscribe((res: User) => {
        this.userFullName.set(res.full_name ?? 'Neznámé jméno');
        this.userRole.set(res.role ?? 'user');
      });
    }

    this.redirectToLogin();
    return false;
  }

  private verifyToken(): any {
    return this.http.get(`${this.apiUrl}/users/current-user`, { headers: this.authHeaders('json', true) })
  }

  private redirectToLogin(): void {
    this.router.navigate(['/login']);
  }

  login(): void {
    localStorage.removeItem('access_token');
    this.error.set('');

    this.getToken().pipe(
      catchError((err) => {
        console.log('Token fetch failed: ', err);
        return of(null);
      })
    ).subscribe((res: any) => {
      if (!res?.access_token) {
        console.warn('No access_token in response');
        this.error.set('Nesprávný e-mail nebo heslo');
        return;
      }

      localStorage.setItem('access_token', res.access_token);

      this.redirectToStoredUri();
    })
  }

  private getToken(): any {
    const url = `${this.apiUrl}/users/login`;
    const payload = `grant_type=password&username=${this.username()}&password=${this.password()}&scope=&client_id=null&client_secret=null`;

    return this.http.post(url, payload, { headers: this.loginHeaders });
  }

  private redirectToStoredUri(): void {
    this.router.navigate([`${localStorage.getItem('redirectUri') || '/'}`]);
  }

  logout(): void {
    localStorage.removeItem('access_token');
    this.router.navigate(['/login']);
  }
}
