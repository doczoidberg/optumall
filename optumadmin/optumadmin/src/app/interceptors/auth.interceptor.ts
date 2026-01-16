import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'jwt_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  // Only add auth headers for requests to our API
  if (!req.url.startsWith(environment.licenseManagementApiUrl)) {
    return next(req);
  }

  const token = localStorage.getItem(TOKEN_KEY);

  let modifiedReq = req;

  // Add JWT token if available
  if (token) {
    modifiedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // For OptumAdmin endpoints, also add API key
  if (req.url.includes('/api/optumadmin/')) {
    modifiedReq = modifiedReq.clone({
      setHeaders: {
        ...modifiedReq.headers.keys().reduce((acc, key) => {
          acc[key] = modifiedReq.headers.get(key) || '';
          return acc;
        }, {} as Record<string, string>),
        'X-Api-Key': environment.apiKey
      }
    });
  }

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('auth_user');
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
